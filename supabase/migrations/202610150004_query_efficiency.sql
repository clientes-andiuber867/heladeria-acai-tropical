BEGIN;
-- Compute authorized branches once per SQL statement, not once per row.
-- Keep exactly the same REST and Realtime authorization as branch_readable.
CREATE FUNCTION public.readable_branch_ids() RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb = '{}'::jsonb
    AND (auth.uid() IS NULL OR public.is_admin()) THEN
  RETURN ARRAY(SELECT id FROM public.branches);
 END IF;
 RETURN ARRAY[public.selected_branch()];
END $$;
REVOKE ALL ON FUNCTION public.readable_branch_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.readable_branch_ids() TO anon,authenticated;
DO $$ DECLARE t text; p record; expression text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','sales','sale_items','cash_shifts','audit_events','payment_settings','inventory_items','inventory_movements','inventory_groups'] LOOP
  EXECUTE format('ALTER POLICY branch_scope_read ON public.%I USING(branch_id = ANY ((SELECT public.readable_branch_ids())::uuid[]))',t);
 END LOOP;
 -- Identity helpers have no row arguments and are STABLE. InitPlans preserve
 -- their result while removing redundant profile lookups during table scans.
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' LOOP
  IF p.qual ~ '(is_admin|is_staff|auth[.]uid)[(][)]' THEN
   expression:=regexp_replace(p.qual,'(public[.])?is_admin[(][)]','(SELECT public.is_admin())','g');
   expression:=regexp_replace(expression,'(public[.])?is_staff[(][)]','(SELECT public.is_staff())','g');
   expression:=regexp_replace(expression,'auth[.]uid[(][)]','(SELECT auth.uid())','g');
   EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',p.policyname,p.tablename,expression);
  END IF;
  IF p.with_check ~ '(is_admin|is_staff|auth[.]uid)[(][)]' THEN
   expression:=regexp_replace(p.with_check,'(public[.])?is_admin[(][)]','(SELECT public.is_admin())','g');
   expression:=regexp_replace(expression,'(public[.])?is_staff[(][)]','(SELECT public.is_staff())','g');
   expression:=regexp_replace(expression,'auth[.]uid[(][)]','(SELECT auth.uid())','g');
   EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',p.policyname,p.tablename,expression);
  END IF;
 END LOOP;
END $$;
-- Match actual scoped sort/pagination patterns; avoid indexing every column.
CREATE INDEX sales_branch_order ON public.sales(branch_id,order_number);
CREATE INDEX products_branch_catalog ON public.products(branch_id,created_at) WHERE NOT archived;
CREATE INDEX inventory_movements_branch_date ON public.inventory_movements(branch_id,created_at DESC,id DESC);
CREATE INDEX profiles_branch_active ON public.profiles(branch_id,display_name) WHERE deleted_at IS NULL;
NOTIFY pgrst,'reload schema';
COMMIT;
