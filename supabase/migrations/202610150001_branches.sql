BEGIN;

CREATE TABLE public.branches (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK (name=trim(name) AND length(name) BETWEEN 2 AND 80),
 order_phone text NOT NULL CHECK (order_phone ~ '^[0-9]{8,15}$')
);
INSERT INTO public.branches VALUES
 ('00000000-0000-4000-8000-000000000001','Açaí Tropical 1','59171661241'),
 ('00000000-0000-4000-8000-000000000002','Açaí Tropical 2','59171661241');
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.branches TO anon,authenticated;
CREATE POLICY branches_read ON public.branches FOR SELECT USING(true);

ALTER TABLE public.profiles ADD COLUMN branch_id uuid REFERENCES public.branches(id);
UPDATE public.profiles SET branch_id='00000000-0000-4000-8000-000000000001' WHERE role='cashier';
ALTER TABLE public.profiles ADD CONSTRAINT cashier_branch_required CHECK (role<>'cashier' OR NOT active OR branch_id IS NOT NULL);

-- A header selects the workspace, but never grants access. Cashiers are checked
-- against their CURRENT database profile, including active/deleted status.
CREATE FUNCTION public.selected_branch() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE requested uuid; staff public.profiles%rowtype;
BEGIN
 requested:=nullif(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-branch-id','')::uuid;
 IF auth.uid() IS NOT NULL THEN
  SELECT * INTO staff FROM public.profiles WHERE id=auth.uid();
  IF NOT FOUND OR NOT staff.active OR staff.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
  IF staff.role='cashier' THEN
   IF requested IS NOT NULL AND requested IS DISTINCT FROM staff.branch_id THEN RETURN NULL; END IF;
   RETURN staff.branch_id;
  END IF;
 END IF;
 requested:=coalesce(requested,'00000000-0000-4000-8000-000000000001');
 RETURN (SELECT id FROM public.branches WHERE id=requested);
END $$;
REVOKE ALL ON FUNCTION public.selected_branch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.selected_branch() TO anon,authenticated,service_role;

-- Realtime evaluates SELECT with JWT claims and no HTTP request headers.
-- Its subscription filters choose the branch; cashier authorization still
-- comes from their profile. REST clients always send x-branch-id.
CREATE FUNCTION public.branch_readable(p_branch uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb = '{}'::jsonb
    AND (auth.uid() IS NULL OR public.is_admin()) THEN RETURN true; END IF;
 RETURN p_branch=public.selected_branch();
END $$;
REVOKE ALL ON FUNCTION public.branch_readable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.branch_readable(uuid) TO anon,authenticated;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','sales','sale_items','cash_shifts','audit_events','payment_settings','inventory_items','inventory_movements','inventory_groups'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN branch_id uuid NOT NULL DEFAULT %L REFERENCES public.branches(id)',t,'00000000-0000-4000-8000-000000000001');
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN branch_id SET DEFAULT public.selected_branch()',t);
  EXECUTE format('CREATE INDEX %I ON public.%I(branch_id)',t||'_branch_idx',t);
  EXECUTE format('CREATE POLICY branch_scope_read ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(public.branch_readable(branch_id))',t);
  EXECUTE format('CREATE POLICY branch_scope_insert ON public.%I AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(branch_id=(SELECT public.selected_branch()))',t);
  EXECUTE format('CREATE POLICY branch_scope_update ON public.%I AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(branch_id=(SELECT public.selected_branch())) WITH CHECK(branch_id=(SELECT public.selected_branch()))',t);
  EXECUTE format('CREATE POLICY branch_scope_delete ON public.%I AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(branch_id=(SELECT public.selected_branch()))',t);
 END LOOP;
END $$;

-- Category/group names and payment singleton are independent in each branch.
ALTER TABLE public.products DROP CONSTRAINT products_category_fk;
ALTER TABLE public.categories DROP CONSTRAINT categories_name_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_branch_name_key UNIQUE(branch_id,name);
ALTER TABLE public.products ADD CONSTRAINT products_category_fk FOREIGN KEY(branch_id,category) REFERENCES public.categories(branch_id,name) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_group_fk;
ALTER TABLE public.inventory_groups DROP CONSTRAINT inventory_groups_pkey;
ALTER TABLE public.inventory_groups ADD PRIMARY KEY(branch_id,name);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_group_fk FOREIGN KEY(branch_id,category) REFERENCES public.inventory_groups(branch_id,name) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.payment_settings DROP CONSTRAINT payment_settings_pkey;
ALTER TABLE public.payment_settings ADD PRIMARY KEY(branch_id,id);
DROP INDEX public.one_open_shift_per_cashier;
CREATE UNIQUE INDEX one_open_shift_per_cashier ON public.cash_shifts(branch_id,cashier_id) WHERE status='open';
CREATE INDEX sales_branch_created ON public.sales(branch_id,created_at DESC);
CREATE INDEX audit_branch_created ON public.audit_events(branch_id,created_at DESC);
INSERT INTO public.inventory_groups(branch_id,name) VALUES('00000000-0000-4000-8000-000000000002','General');

-- Preserve the existing RPC validation/transactions, but run business RPCs as
-- a NOLOGIN, NOBYPASSRLS role instead of the table owner. RLS now applies to
-- their reads/writes too, including aggregates and idempotency retries.
CREATE ROLE acai_branch_executor NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT acai_branch_executor TO postgres;
GRANT USAGE,CREATE ON SCHEMA public TO acai_branch_executor;
GRANT USAGE ON SCHEMA auth,storage TO acai_branch_executor;
GRANT EXECUTE ON FUNCTION auth.uid(),public.is_admin(),public.is_staff(),public.selected_branch() TO acai_branch_executor;
GRANT SELECT ON public.profiles,public.branches,storage.objects TO acai_branch_executor;
CREATE POLICY branch_executor_profiles ON public.profiles FOR SELECT TO acai_branch_executor USING(true);
CREATE POLICY branch_executor_storage ON storage.objects FOR SELECT TO acai_branch_executor USING(bucket_id IN ('product-images','payment-qr'));
GRANT USAGE,SELECT ON SEQUENCE public.order_number_seq TO acai_branch_executor;
DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','sales','sale_items','cash_shifts','audit_events','payment_settings','inventory_items','inventory_movements','inventory_groups'] LOOP
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO acai_branch_executor',t);
  EXECUTE format('CREATE POLICY branch_executor ON public.%I FOR ALL TO acai_branch_executor USING(branch_id=(SELECT public.selected_branch())) WITH CHECK(branch_id=(SELECT public.selected_branch()))',t);
 END LOOP;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[
  'complete_sale','void_sale','dashboard_summary','sales_collection_totals','product_sales_ranking','search_audit',
  'open_cash_shift','close_cash_shift','cash_shift_balance','enforce_cash_shift',
  'delete_category','delete_product','toggle_product_availability','audit_product_change','audit_category','record_sign_in',
  'inventory_save','inventory_move','inventory_snapshot','inventory_group_save','inventory_group_delete','inventory_delete',
  'public_payment_qr','configure_payment_qr'
 ]) LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO acai_branch_executor',f.signature); END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM acai_branch_executor;

-- Function owner changes retain the original function's execute ACLs.
-- No login/service role is a member of the executor role (except postgres).
CREATE OR REPLACE FUNCTION public.configure_payment_qr(p_path text,p_recipient text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='payment-qr' AND name=p_path) THEN RAISE EXCEPTION 'Sube primero la imagen del QR'; END IF;
 INSERT INTO payment_settings(id,qr_path,recipient) VALUES(1,p_path,trim(p_recipient)) ON CONFLICT(branch_id,id) DO UPDATE SET qr_path=excluded.qr_path,recipient=excluded.recipient,version=gen_random_uuid(),updated_at=now();
 INSERT INTO audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM profiles WHERE id=auth.uid()),'QR de cobro actualizado',NULL,jsonb_build_object('recipient',trim(p_recipient),'path',p_path));
END $$;

-- A cashier cannot move branches with an open till. Historical sales keep
-- their original branch; changing the user's assignment never moves history.
CREATE FUNCTION public.guard_profile_branch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.branch_id IS DISTINCT FROM OLD.branch_id AND EXISTS(SELECT 1 FROM public.cash_shifts WHERE cashier_id=OLD.id AND status='open') THEN
  RAISE EXCEPTION 'Cierra la caja del usuario antes de cambiar su sucursal';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_branch BEFORE UPDATE OF branch_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_branch();
REVOKE ALL ON FUNCTION public.guard_profile_branch() FROM PUBLIC,anon,authenticated;

DROP FUNCTION public.update_team_member(uuid,text,public.app_role,boolean);
CREATE FUNCTION public.update_team_member(p_id uuid,p_name text,p_role public.app_role,p_active boolean,p_branch_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row jsonb; target_branch uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_id=auth.uid() AND (p_role<>'admin' OR NOT p_active) THEN RAISE EXCEPTION 'No puedes desactivar o quitar permisos a tu propia cuenta'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 80 OR p_role IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Datos inválidos'; END IF;
 IF p_role='cashier' AND (p_branch_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=p_branch_id)) THEN RAISE EXCEPTION 'Selecciona una sucursal válida para el cajero'; END IF;
 target_branch:=CASE WHEN p_role='cashier' THEN p_branch_id ELSE NULL END;
 -- Same lock as open_cash_shift: reassignment and opening cannot race.
 PERFORM pg_advisory_xact_lock(hashtextextended('cash-shift-'||p_id::text,0));
 SELECT to_jsonb(p) INTO before_row FROM public.profiles p WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuario inexistente'; END IF;
 UPDATE public.profiles SET display_name=trim(p_name),role=p_role,active=p_active,branch_id=target_branch WHERE id=p_id;
 INSERT INTO public.audit_events(branch_id,actor_id,actor_name,action,entity_id,detail)
 VALUES(coalesce(target_branch,public.selected_branch()),auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Usuario actualizado',p_id,jsonb_build_object('before',before_row,'name',trim(p_name),'role',p_role,'active',p_active,'branch_id',target_branch));
END $$;
REVOKE ALL ON FUNCTION public.update_team_member(uuid,text,public.app_role,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_team_member(uuid,text,public.app_role,boolean,uuid) TO authenticated;

-- Keep the currently published single-branch client working until it is
-- upgraded. Legacy edits preserve the existing assignment, never clear it.
CREATE FUNCTION public.update_team_member(p_id uuid,p_name text,p_role public.app_role,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM public.update_team_member(p_id,p_name,p_role,p_active,coalesce((SELECT branch_id FROM public.profiles WHERE id=p_id),public.selected_branch()));
END $$;
REVOKE ALL ON FUNCTION public.update_team_member(uuid,text,public.app_role,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_team_member(uuid,text,public.app_role,boolean) TO authenticated;

CREATE FUNCTION public.update_branch(p_id uuid,p_name text,p_phone text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 SELECT to_jsonb(b) INTO old_row FROM public.branches b WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sucursal inexistente'; END IF;
 UPDATE public.branches SET name=trim(p_name),order_phone=trim(p_phone) WHERE id=p_id;
 INSERT INTO public.audit_events(branch_id,actor_id,actor_name,action,entity_id,detail) VALUES(p_id,auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Sucursal actualizada',p_id,jsonb_build_object('before',old_row,'name',trim(p_name),'order_phone',trim(p_phone)));
END $$;
REVOKE ALL ON FUNCTION public.update_branch(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_branch(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
