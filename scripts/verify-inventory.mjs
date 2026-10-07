import fs from 'node:fs';
import { sql } from './admin-session.mjs';
const migration = process.argv.includes('--dry-migration')
  ? fs.readFileSync('supabase/migrations/202610060002_inventory.sql', 'utf8').replace(/^BEGIN;/, '').replace(/COMMIT;\s*$/, '')
  : '';
await sql(`BEGIN;
${migration}
DO $$
DECLARE v_admin uuid; v_cashier uuid; v_item uuid;
BEGIN
 SELECT id INTO v_admin FROM public.profiles WHERE role='admin' AND active LIMIT 1;
 SELECT id INTO v_cashier FROM public.profiles WHERE role='cashier' AND active LIMIT 1;
 IF v_admin IS NULL OR v_cashier IS NULL THEN RAISE EXCEPTION 'Missing verification roles'; END IF;
 PERFORM set_config('test.admin',v_admin::text,true);
 PERFORM set_config('test.cashier',v_cashier::text,true);
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 v_item:=public.inventory_save(NULL,'{"name":"QA vasos","unit":"unidades","quantity":100,"minimum":20}');
 PERFORM set_config('test.item',v_item::text,true);
 UPDATE public.inventory_items SET created_at=now()-interval '2 days' WHERE id=v_item;
 UPDATE public.inventory_movements SET created_at=now()-interval '2 days' WHERE item_id=v_item;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_item uuid:=current_setting('test.item')::uuid; v_request uuid:=gen_random_uuid(); v_snapshot jsonb;
BEGIN
 PERFORM public.inventory_move(gen_random_uuid(),v_item,'out',30,'Consumo');
 PERFORM public.inventory_move(gen_random_uuid(),v_item,'count',65,'Conteo mensual');
 PERFORM public.inventory_move(v_request,v_item,'in',5.5,'Reposición');
 PERFORM public.inventory_move(v_request,v_item,'in',5.5,'Reposición');
 IF (SELECT quantity FROM public.inventory_items WHERE id=v_item)<>70.5 THEN RAISE EXCEPTION 'Incorrect or duplicated balance'; END IF;
 IF (SELECT count(*) FROM public.inventory_movements WHERE item_id=v_item)<>4 THEN RAISE EXCEPTION 'Incorrect movement count'; END IF;
 BEGIN
  PERFORM public.inventory_move(gen_random_uuid(),v_item,'out',1000,'Invalid output');
  RAISE EXCEPTION 'Negative inventory allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'No hay existencias%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.inventory_save(v_item,'{"name":"QA vasos","unit":"kg"}');
  RAISE EXCEPTION 'Unit mutation allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'La unidad%' THEN RAISE; END IF; END;
 PERFORM public.inventory_save(v_item,'{"name":"QA vasos editado","unit":"unidades","quantity":999,"minimum":10}');
 IF (SELECT quantity FROM public.inventory_items WHERE id=v_item)<>70.5 THEN RAISE EXCEPTION 'Metadata edit changed stock'; END IF;
 v_snapshot:=public.inventory_snapshot((now() AT TIME ZONE 'America/La_Paz')::date-1);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_snapshot) r WHERE r->>'id'=v_item::text AND (r->>'quantity')::numeric=100) THEN RAISE EXCEPTION 'Historical snapshot incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.inventory_snapshot(NULL)) r WHERE r->>'id'=v_item::text AND (r->>'quantity')::numeric=70.5) THEN RAISE EXCEPTION 'Current snapshot incorrect'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.cashier'),true);
 IF EXISTS(SELECT 1 FROM public.inventory_items) OR EXISTS(SELECT 1 FROM public.inventory_movements) THEN RAISE EXCEPTION 'Cashier can read inventory'; END IF;
 BEGIN
  PERFORM public.inventory_snapshot(NULL);
  RAISE EXCEPTION 'Cashier snapshot allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Solo administradores' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.inventory_move(gen_random_uuid(),v_item,'in',1,'Forbidden');
  RAISE EXCEPTION 'Cashier movement allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Solo administradores' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.inventory_save(NULL,'{"name":"Forbidden","unit":"unidades"}');
  RAISE EXCEPTION 'Cashier creation allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Solo administradores' THEN RAISE; END IF; END;
 IF has_table_privilege('authenticated','public.inventory_items','UPDATE') THEN RAISE EXCEPTION 'Direct modification allowed'; END IF;
 IF has_function_privilege('anon','public.inventory_snapshot(date)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access allowed'; END IF;
END $$;
ROLLBACK;`);
console.log('PASS: creation, decimal stock, output, physical count, idempotency, metadata edit, date snapshots and admin-only access. Fixtures rolled back.');
