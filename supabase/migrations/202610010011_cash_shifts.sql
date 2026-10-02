BEGIN;
DROP POLICY sales_read ON public.sales;
CREATE POLICY sales_read ON public.sales FOR SELECT TO authenticated USING(public.is_admin() OR (public.is_staff() AND cashier_id=auth.uid() AND created_at>=((now() AT TIME ZONE 'America/La_Paz')::date::timestamp AT TIME ZONE 'America/La_Paz') AND created_at<(((now() AT TIME ZONE 'America/La_Paz')::date+1)::timestamp AT TIME ZONE 'America/La_Paz')));
CREATE TABLE public.cash_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cashier_id uuid NOT NULL REFERENCES profiles(id), opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 opening_cash numeric(12,2) NOT NULL CHECK(opening_cash>=0 AND opening_cash<=1000000), counted_cash numeric(12,2), expected_cash numeric(12,2), cash_sales numeric(12,2), qr_sales numeric(12,2), difference numeric(12,2), closing_note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))
);
CREATE UNIQUE INDEX one_open_shift_per_cashier ON cash_shifts(cashier_id) WHERE status='open';
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON cash_shifts TO authenticated;
CREATE POLICY shift_read ON cash_shifts FOR SELECT TO authenticated USING(public.is_admin() OR (public.is_staff() AND cashier_id=auth.uid() AND (status='open' OR (opened_at AT TIME ZONE 'America/La_Paz')::date=(now() AT TIME ZONE 'America/La_Paz')::date)));
ALTER TABLE sales ADD COLUMN shift_id uuid REFERENCES cash_shifts(id);
CREATE INDEX sales_shift_idx ON sales(shift_id);
CREATE FUNCTION public.open_cash_shift(p_opening numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT is_staff() THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cash-shift-'||auth.uid()::text,0));
 SELECT id INTO result FROM cash_shifts WHERE cashier_id=auth.uid() AND status='open'; IF FOUND THEN RETURN result; END IF;
 IF p_opening IS NULL OR p_opening::text IN ('NaN','Infinity','-Infinity') OR p_opening<0 OR p_opening>1000000 OR p_opening<>round(p_opening,2) THEN RAISE EXCEPTION 'Fondo inicial inválido'; END IF;
 INSERT INTO cash_shifts(cashier_id,opening_cash) VALUES(auth.uid(),p_opening) RETURNING id INTO result;
 INSERT INTO audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM profiles WHERE id=auth.uid()),'Caja abierta',result,jsonb_build_object('opening_cash',p_opening)); RETURN result;
END; $$;
CREATE FUNCTION public.cash_shift_balance(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE shift cash_shifts; c numeric; q numeric; n bigint;
BEGIN
 SELECT * INTO shift FROM cash_shifts WHERE id=p_id;
 IF NOT FOUND OR NOT (is_admin() OR (is_staff() AND shift.cashier_id=auth.uid() AND (shift.status='open' OR (shift.opened_at AT TIME ZONE 'America/La_Paz')::date=(now() AT TIME ZONE 'America/La_Paz')::date))) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 SELECT coalesce(sum(cash_amount),0),coalesce(sum(qr_amount),0),count(*) INTO c,q,n FROM sales WHERE shift_id=p_id AND status='completed';
 RETURN to_jsonb(shift)||jsonb_build_object('cash_sales',c,'qr_sales',q,'orders',n,'expected_cash',shift.opening_cash+c);
END; $$;
CREATE FUNCTION public.close_cash_shift(p_id uuid,p_counted numeric,p_note text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE shift cash_shifts; c numeric; q numeric; expected numeric;
BEGIN
 SELECT * INTO shift FROM cash_shifts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT (is_admin() OR (is_staff() AND shift.cashier_id=auth.uid())) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 IF shift.status='closed' THEN RETURN to_jsonb(shift); END IF;
 IF p_counted IS NULL OR p_counted::text IN ('NaN','Infinity','-Infinity') OR p_counted<0 OR p_counted>1000000 OR p_counted<>round(p_counted,2) OR length(coalesce(p_note,''))>300 THEN RAISE EXCEPTION 'Importe o nota inválidos'; END IF;
 SELECT coalesce(sum(cash_amount),0),coalesce(sum(qr_amount),0) INTO c,q FROM sales WHERE shift_id=p_id AND status='completed';expected=shift.opening_cash+c;
 IF p_counted<>expected AND length(trim(coalesce(p_note,'')))<5 THEN RAISE EXCEPTION 'Explica la diferencia entre el efectivo contado y el esperado'; END IF;
 UPDATE cash_shifts SET status='closed',closed_at=now(),counted_cash=p_counted,expected_cash=expected,cash_sales=c,qr_sales=q,difference=p_counted-expected,closing_note=coalesce(p_note,'') WHERE id=p_id RETURNING * INTO shift;
 INSERT INTO audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM profiles WHERE id=auth.uid()),'Caja cerrada',p_id,to_jsonb(shift));RETURN to_jsonb(shift);
END; $$;
CREATE FUNCTION public.enforce_cash_shift() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE shift cash_shifts;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO shift FROM cash_shifts WHERE cashier_id=NEW.cashier_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abre caja antes de registrar ventas'; END IF;
  IF (shift.opened_at AT TIME ZONE 'America/La_Paz')::date<>(now() AT TIME ZONE 'America/La_Paz')::date THEN RAISE EXCEPTION 'Cierra la caja pendiente y abre una caja para hoy'; END IF;
  NEW.shift_id=shift.id;
 ELSIF OLD.shift_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
  SELECT * INTO shift FROM cash_shifts WHERE id=OLD.shift_id FOR UPDATE;
  IF shift.status='closed' THEN RAISE EXCEPTION 'La caja ya está cerrada. No se puede anular una venta de ese cierre'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER sales_cash_shift BEFORE INSERT OR UPDATE OF status ON public.sales FOR EACH ROW EXECUTE FUNCTION public.enforce_cash_shift();
REVOKE ALL ON FUNCTION public.open_cash_shift(numeric),public.close_cash_shift(uuid,numeric,text),public.cash_shift_balance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_cash_shift(numeric),public.close_cash_shift(uuid,numeric,text),public.cash_shift_balance(uuid) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_shifts;
COMMIT;
