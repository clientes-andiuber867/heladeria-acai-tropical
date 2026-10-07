import { sql } from './admin-session.mjs';
await sql(`BEGIN;
DO $$
DECLARE actor uuid; marker text:=gen_random_uuid()::text;
BEGIN
 SELECT id INTO actor FROM public.profiles WHERE role='admin' AND active LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('test.marker',marker,true);
 INSERT INTO public.audit_events(actor_id,actor_name,action,detail)
 SELECT actor,marker,'Inventario: movimiento registrado',jsonb_build_object('inventory_name','QA artículo','after_quantity',n) FROM generate_series(1,26) n;
 INSERT INTO public.audit_events(actor_id,actor_name,action,detail)
 SELECT actor,marker,action,'{}'::jsonb FROM unnest(ARRAY['Venta anulada','Producto editado','Caja abierta']) action;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE d date:=(now() AT TIME ZONE 'America/La_Paz')::date; m text:=current_setting('test.marker');
BEGIN
 IF (SELECT count(*) FROM public.search_audit(d,d,m,0,'inventory'))<>25 THEN RAISE EXCEPTION 'Wrong first page'; END IF;
 IF (SELECT count(*) FROM public.search_audit(d,d,m,25,'inventory'))<>1 THEN RAISE EXCEPTION 'Wrong second page'; END IF;
 IF EXISTS(SELECT 1 FROM public.search_audit(d,d,m,0,'inventory') WHERE action NOT LIKE 'Inventario:%' OR total_count<>26) THEN RAISE EXCEPTION 'Wrong inventory results/count'; END IF;
 IF (SELECT count(*) FROM public.search_audit(d,d,m,0,'changes'))<>3 OR EXISTS(SELECT 1 FROM public.search_audit(d,d,m,0,'changes') WHERE action LIKE 'Inventario:%') THEN RAISE EXCEPTION 'Inventory leaked into changes'; END IF;
 IF (SELECT count(*) FROM public.search_audit(d,d,m,0,'voids'))<>1 OR (SELECT count(*) FROM public.search_audit(d,d,m,0,'catalog'))<>1 OR (SELECT count(*) FROM public.search_audit(d,d,m,0,'cash'))<>1 THEN RAISE EXCEPTION 'Other scopes changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.search_audit(d,d,m,0,'all') WHERE total_count<>29) THEN RAISE EXCEPTION 'All activity count incorrect'; END IF;
 IF EXISTS(SELECT 1 FROM public.search_audit(d-1,d-1,m,0,'inventory')) THEN RAISE EXCEPTION 'Dates ignored'; END IF;
END $$;
ROLLBACK;`);
console.log('PASS: inventory isolated, changes exclude inventory, other scopes preserved, dates/search/counts/pagination correct. Fixtures rolled back.');
