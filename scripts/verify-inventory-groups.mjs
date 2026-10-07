import fs from 'node:fs';
import { sql } from './admin-session.mjs';
const migration = process.argv.includes('--dry-migration')
  ? fs.readFileSync('supabase/migrations/202610060003_inventory_groups.sql','utf8').replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,'') : '';
await sql(`BEGIN;
${migration}
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='admin' AND active LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE a text:='QA '||gen_random_uuid(); b text:='QA '||gen_random_uuid(); renamed text:='QA '||gen_random_uuid(); item uuid;
BEGIN
 PERFORM public.inventory_group_save(a);
 PERFORM public.inventory_group_save(b);
 item:=public.inventory_save(NULL,jsonb_build_object('name','QA group item','unit','unidades','category',a,'quantity',12));
 PERFORM public.inventory_group_save(renamed,a);
 IF NOT EXISTS(SELECT 1 FROM public.inventory_items WHERE id=item AND category=renamed AND quantity=12) THEN RAISE EXCEPTION 'Rename did not preserve item'; END IF;
 BEGIN
  PERFORM public.inventory_group_delete(renamed);
  RAISE EXCEPTION 'Nonempty group deleted without replacement';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Este grupo tiene%' THEN RAISE; END IF; END;
 PERFORM public.inventory_group_delete(renamed,b);
 IF NOT EXISTS(SELECT 1 FROM public.inventory_items WHERE id=item AND category=b AND quantity=12) THEN RAISE EXCEPTION 'Transfer changed stock'; END IF;
 PERFORM public.inventory_group_save(a);
 PERFORM public.inventory_group_delete(a);
 IF EXISTS(SELECT 1 FROM public.inventory_groups WHERE name=a) THEN RAISE EXCEPTION 'Empty group still exists'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM public.inventory_groups) THEN RAISE EXCEPTION 'Unauthorized read'; END IF;
 BEGIN
  PERFORM public.inventory_group_save(a);
  RAISE EXCEPTION 'Unauthorized save';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Solo administradores' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.inventory_group_delete(b);
  RAISE EXCEPTION 'Unauthorized delete';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Solo administradores' THEN RAISE; END IF; END;
END $$;
ROLLBACK;`);
console.log('PASS: custom group creation, rename cascade, safe deletion and transfer, preserved stock, admin-only permissions. Rolled back.');
