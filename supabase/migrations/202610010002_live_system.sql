BEGIN;
ALTER TABLE public.profiles ADD COLUMN email text NOT NULL DEFAULT '', ADD COLUMN active boolean NOT NULL DEFAULT true, ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN archived boolean NOT NULL DEFAULT false, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.products ADD CONSTRAINT finite_price CHECK (price < 1000000);
ALTER TABLE public.sales ADD COLUMN status text NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','voided')), ADD COLUMN void_reason text, ADD COLUMN voided_at timestamptz, ADD COLUMN voided_by uuid REFERENCES public.profiles(id), ADD COLUMN cashier_name text NOT NULL DEFAULT '';
ALTER TABLE public.audit_events ADD COLUMN actor_name text NOT NULL DEFAULT '';
CREATE INDEX sales_created_at_idx ON public.sales(created_at DESC);
CREATE INDEX sales_cashier_idx ON public.sales(cashier_id,created_at DESC);
CREATE INDEX sale_items_sale_id_idx ON public.sale_items(sale_id);
CREATE INDEX audit_created_idx ON public.audit_events(created_at DESC);
CREATE INDEX products_category_idx ON public.products(category) WHERE NOT archived;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND active); $$;
CREATE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active); $$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
DROP POLICY public_catalog ON public.products;
CREATE POLICY public_catalog ON public.products FOR SELECT TO anon,authenticated USING (NOT archived OR public.is_admin());
-- is_admin must be callable by anon because it appears in the public catalog policy; auth.uid is null, so it returns false.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
DROP POLICY sales_read ON public.sales;
CREATE POLICY sales_read ON public.sales FOR SELECT TO authenticated USING (public.is_admin() OR (public.is_staff() AND cashier_id=auth.uid()));
DROP POLICY items_read ON public.sale_items;
CREATE POLICY items_read ON public.sale_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.sales s WHERE s.id=sale_id));
CREATE FUNCTION public.stamp_product() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
CREATE TRIGGER product_timestamp BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.stamp_product();
CREATE OR REPLACE FUNCTION public.audit_product_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Sistema'),CASE WHEN TG_OP='INSERT' THEN 'Producto agregado' WHEN NEW.archived AND NOT OLD.archived THEN 'Producto archivado' ELSE 'Producto editado' END,NEW.id,jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE null END,'after',to_jsonb(NEW)));
 RETURN NEW; END; $$;
CREATE FUNCTION public.handle_new_staff() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO public.profiles(id,email,display_name,role,active,must_change_password)
 VALUES(NEW.id,coalesce(NEW.email,''),coalesce(nullif(NEW.raw_user_meta_data->>'display_name',''),split_part(NEW.email,'@',1)),CASE WHEN NEW.raw_app_meta_data->>'role'='admin' THEN 'admin'::public.app_role ELSE 'cashier'::public.app_role END,true,true);
 RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.handle_new_staff() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER new_staff_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff();
CREATE OR REPLACE FUNCTION public.complete_sale(p_request_id uuid,p_items jsonb,p_method text,p_cash numeric DEFAULT NULL,p_note text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sale uuid; v_total numeric(12,2):=0; v_item jsonb; v_product public.products%rowtype; v_qty integer; v_name text;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador requerido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT id INTO v_sale FROM public.sales WHERE request_id=p_request_id AND cashier_id=auth.uid(); IF FOUND THEN RETURN v_sale; END IF;
 IF p_method IS NULL OR p_method NOT IN ('Efectivo','QR') THEN RAISE EXCEPTION 'Forma de pago inválida'; END IF;
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
 IF p_method='Efectivo' AND (p_cash IS NULL OR p_cash::text IN ('NaN','Infinity','-Infinity') OR p_cash<v_total OR p_cash>1000000) THEN RAISE EXCEPTION 'Efectivo insuficiente o inválido'; END IF;
 SELECT display_name INTO v_name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.sales(request_id,cashier_id,cashier_name,payment_method,total,cash_received,note) VALUES(p_request_id,auth.uid(),v_name,p_method,v_total,CASE WHEN p_method='Efectivo' THEN round(p_cash,2) END,coalesce(p_note,'')) RETURNING id INTO v_sale;
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO STRICT v_product FROM public.products WHERE id=(v_item->>'id')::uuid;
  INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price) VALUES(v_sale,v_product.id,v_product.name,(v_item->>'qty')::integer,v_product.price);
 END LOOP;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),v_name,'Venta registrada',v_sale,jsonb_build_object('total',v_total,'payment',p_method,'note',p_note,'items',(SELECT jsonb_agg(to_jsonb(i)) FROM public.sale_items i WHERE i.sale_id=v_sale)));
 RETURN v_sale;
END; $$;
CREATE FUNCTION public.void_sale(p_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sale public.sales%rowtype; BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF length(trim(coalesce(p_reason,'')))<5 OR length(p_reason)>300 THEN RAISE EXCEPTION 'Indica un motivo de entre 5 y 300 caracteres'; END IF;
 SELECT * INTO v_sale FROM public.sales WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_sale.status='voided' THEN RAISE EXCEPTION 'Venta inexistente o ya anulada'; END IF;
 UPDATE public.sales SET status='voided',void_reason=trim(p_reason),voided_at=now(),voided_by=auth.uid() WHERE id=p_id;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Venta anulada',p_id,jsonb_build_object('reason',trim(p_reason),'total',v_sale.total));
END; $$;
CREATE FUNCTION public.update_team_member(p_id uuid,p_name text,p_role public.app_role,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row jsonb; BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_id=auth.uid() AND (p_role<>'admin' OR NOT p_active) THEN RAISE EXCEPTION 'No puedes desactivar o quitar permisos a tu propia cuenta'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 80 OR p_role IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Datos inválidos'; END IF;
 SELECT to_jsonb(p) INTO before_row FROM public.profiles p WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuario inexistente'; END IF;
 UPDATE public.profiles SET display_name=trim(p_name),role=p_role,active=p_active WHERE id=p_id;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Usuario actualizado',p_id,jsonb_build_object('before',before_row,'name',trim(p_name),'role',p_role,'active',p_active));
END; $$;
CREATE FUNCTION public.finish_password_setup() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.profiles SET must_change_password=false WHERE id=auth.uid() AND active; $$;
REVOKE ALL ON FUNCTION public.void_sale(uuid,text),public.update_team_member(uuid,text,public.app_role,boolean),public.finish_password_setup() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid,text),public.update_team_member(uuid,text,public.app_role,boolean),public.finish_password_setup() TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('product-images','product-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY product_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='product-images' AND public.is_admin());
CREATE POLICY product_images_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='product-images' AND public.is_admin()) WITH CHECK(bucket_id='product-images' AND public.is_admin());
CREATE POLICY product_images_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='product-images' AND public.is_admin());
CREATE POLICY product_images_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='product-images');
-- Realtime broadcasts are filtered by the same SELECT policies.
ALTER PUBLICATION supabase_realtime ADD TABLE public.products,public.sales,public.profiles;
COMMIT;
