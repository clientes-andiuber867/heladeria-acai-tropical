BEGIN;
CREATE TABLE public.payment_settings(id integer PRIMARY KEY CHECK(id=1),qr_path text NOT NULL,recipient text NOT NULL CHECK(length(trim(recipient)) between 2 and 100),version uuid NOT NULL DEFAULT gen_random_uuid(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_settings TO authenticated;
CREATE POLICY payments_read ON public.payment_settings FOR SELECT TO authenticated USING(public.is_staff());
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('payment-qr','payment-qr',true,5242880,ARRAY['image/png','image/jpeg','image/webp']);
CREATE POLICY payment_qr_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='payment-qr' AND public.is_admin());
CREATE POLICY payment_qr_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='payment-qr' AND public.is_staff());
CREATE FUNCTION public.configure_payment_qr(p_path text,p_recipient text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='payment-qr' AND name=p_path) THEN RAISE EXCEPTION 'Sube primero la imagen del QR'; END IF;
 INSERT INTO payment_settings(id,qr_path,recipient) VALUES(1,p_path,trim(p_recipient)) ON CONFLICT(id) DO UPDATE SET qr_path=excluded.qr_path,recipient=excluded.recipient,version=gen_random_uuid(),updated_at=now();
 INSERT INTO audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM profiles WHERE id=auth.uid()),'QR de cobro actualizado',NULL,jsonb_build_object('recipient',trim(p_recipient),'path',p_path));
END; $$;
REVOKE ALL ON FUNCTION public.configure_payment_qr(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_payment_qr(text,text) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_settings;
ALTER TABLE public.sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check CHECK(payment_method IN ('Efectivo','QR','Mixto'));
ALTER TABLE public.sales ADD COLUMN cash_amount numeric(12,2),ADD COLUMN qr_amount numeric(12,2),ADD COLUMN qr_version uuid,ADD COLUMN qr_recipient text,ADD COLUMN qr_path text;
UPDATE public.sales SET cash_amount=CASE WHEN payment_method='Efectivo' THEN total ELSE 0 END,qr_amount=CASE WHEN payment_method='QR' THEN total ELSE 0 END;
ALTER TABLE public.sales ALTER COLUMN cash_amount SET NOT NULL,ALTER COLUMN qr_amount SET NOT NULL;
ALTER TABLE public.sales ADD CONSTRAINT sale_payment_totals CHECK(cash_amount>=0 AND qr_amount>=0 AND cash_amount+qr_amount=total);
DROP FUNCTION public.complete_sale(uuid,jsonb,text,numeric,text);
CREATE OR REPLACE FUNCTION public.complete_sale(p_request_id uuid,p_items jsonb,p_method text,p_cash numeric DEFAULT NULL,p_note text DEFAULT '',p_cash_amount numeric DEFAULT NULL,p_qr_amount numeric DEFAULT NULL,p_qr_version uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sale uuid; v_total numeric(12,2):=0; v_item jsonb; v_product public.products%rowtype; v_qty integer; v_name text; v_cash numeric(12,2); v_qr numeric(12,2); v_config public.payment_settings%rowtype;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador requerido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT id INTO v_sale FROM public.sales WHERE request_id=p_request_id AND cashier_id=auth.uid(); IF FOUND THEN RETURN v_sale; END IF;
 IF p_method IS NULL OR p_method NOT IN ('Efectivo','QR','Mixto') THEN RAISE EXCEPTION 'Forma de pago inválida'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN RAISE EXCEPTION 'Pedido inválido'; END IF;
 IF jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>100 THEN RAISE EXCEPTION 'Cantidad de productos inválida'; END IF;
 IF length(coalesce(p_note,''))>300 THEN RAISE EXCEPTION 'Nota demasiado larga'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x) THEN RAISE EXCEPTION 'Productos duplicados'; END IF;
 PERFORM 1 FROM public.products WHERE id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY id FOR SHARE;
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  IF coalesce(v_item->>'qty','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  v_qty=(v_item->>'qty')::integer; IF v_qty<1 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id=(v_item->>'id')::uuid AND available AND NOT archived;
  IF NOT FOUND THEN RAISE EXCEPTION 'Un producto ya no está disponible. Actualiza el pedido.'; END IF;
  IF v_item->>'expected_price' IS NULL OR (v_item->>'expected_price')::numeric<>v_product.price THEN RAISE EXCEPTION 'El precio cambió. Actualiza el pedido antes de cobrar.'; END IF;
  v_total=v_total+v_product.price*v_qty;
 END LOOP;
 v_cash=CASE WHEN p_method='Efectivo' THEN v_total WHEN p_method='QR' THEN 0 ELSE p_cash_amount END;
v_qr=CASE WHEN p_method='QR' THEN v_total WHEN p_method='Efectivo' THEN 0 ELSE p_qr_amount END;
IF v_cash IS NULL OR v_qr IS NULL OR v_cash::text IN ('NaN','Infinity','-Infinity') OR v_qr::text IN ('NaN','Infinity','-Infinity') OR v_cash<0 OR v_qr<0 OR v_cash+v_qr<>v_total THEN RAISE EXCEPTION 'Los importes deben sumar exactamente el total'; END IF;
IF p_method='Mixto' AND (v_cash<=0 OR v_qr<=0 OR p_cash_amount<>round(p_cash_amount,2) OR p_qr_amount<>round(p_qr_amount,2)) THEN RAISE EXCEPTION 'Indica importes positivos con máximo dos decimales'; END IF;
IF v_cash>0 AND (p_cash IS NULL OR p_cash::text IN ('NaN','Infinity','-Infinity') OR p_cash<v_cash OR p_cash>1000000 OR p_cash<>round(p_cash,2)) THEN RAISE EXCEPTION 'Efectivo insuficiente o inválido'; END IF;
IF v_qr>0 THEN
 SELECT * INTO v_config FROM payment_settings WHERE id=1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El administrador debe configurar el QR de cobro'; END IF;
 IF p_qr_version IS DISTINCT FROM v_config.version THEN RAISE EXCEPTION 'El QR cambió. Revisa el QR actualizado y verifica el pago nuevamente'; END IF;
END IF;
SELECT display_name INTO v_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.sales(request_id,cashier_id,cashier_name,payment_method,total,cash_received,note,cash_amount,qr_amount,qr_version,qr_recipient,qr_path) VALUES(p_request_id,auth.uid(),v_name,p_method,v_total,CASE WHEN v_cash>0 THEN round(p_cash,2) END,coalesce(p_note,''),v_cash,v_qr,v_config.version,v_config.recipient,v_config.qr_path) RETURNING id INTO v_sale;
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO STRICT v_product FROM public.products WHERE id=(v_item->>'id')::uuid;
  INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price) VALUES(v_sale,v_product.id,v_product.name,(v_item->>'qty')::integer,v_product.price);
 END LOOP;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),v_name,'Venta registrada',v_sale,jsonb_build_object('total',v_total,'payment',p_method,'cash_amount',v_cash,'qr_amount',v_qr,'qr_version',v_config.version,'qr_recipient',v_config.recipient,'note',p_note,'items',(SELECT jsonb_agg(to_jsonb(i)) FROM public.sale_items i WHERE i.sale_id=v_sale)));
 RETURN v_sale;
END; $$;
REVOKE ALL ON FUNCTION public.complete_sale(uuid,jsonb,text,numeric,text,numeric,numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_sale(uuid,jsonb,text,numeric,text,numeric,numeric,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.dashboard_summary(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Rango de fechas inválido'; END IF;
 start_at=p_from::timestamp AT TIME ZONE 'America/La_Paz'; end_at=(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz';
 WITH filtered AS (SELECT * FROM public.sales WHERE created_at>=start_at AND created_at<end_at), completed AS (SELECT * FROM filtered WHERE status='completed')
 SELECT jsonb_build_object(
 'revenue',coalesce((SELECT sum(total) FROM completed),0),'orders',(SELECT count(*) FROM completed),
 'cash',coalesce((SELECT sum(cash_amount) FROM completed),0),'qr',coalesce((SELECT sum(qr_amount) FROM completed),0),
 'voided',(SELECT count(*) FROM filtered WHERE status='voided'),
 'series',coalesce((SELECT jsonb_agg(t ORDER BY label) FROM (SELECT CASE WHEN p_from=p_to THEN to_char(created_at AT TIME ZONE 'America/La_Paz','HH24:00') ELSE to_char(created_at AT TIME ZONE 'America/La_Paz','YYYY-MM-DD') END AS label,sum(total) AS total FROM completed GROUP BY 1) t),'[]'::jsonb),
 'popular',coalesce((SELECT jsonb_agg(t) FROM (SELECT i.product_name AS name,sum(i.quantity) AS quantity,sum(i.quantity*i.unit_price) AS total FROM public.sale_items i JOIN completed s ON s.id=i.sale_id GROUP BY i.product_id,i.product_name ORDER BY sum(i.quantity) DESC LIMIT 5) t),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(t) FROM (SELECT s.*, (SELECT coalesce(jsonb_agg(i),'[]'::jsonb) FROM public.sale_items i WHERE i.sale_id=s.id) AS sale_items FROM filtered s ORDER BY s.created_at DESC LIMIT 5) t),'[]'::jsonb)
 ) INTO result; RETURN result;
END; $$;
COMMIT;
