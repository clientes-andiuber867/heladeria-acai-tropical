import fs from 'node:fs';
import { sql } from './admin-session.mjs';

// All fixtures, deletions and audit events are rolled back, including a dry-run migration.
const migration = process.argv.includes('--dry-migration')
  ? fs.readFileSync('supabase/migrations/202610060001_delete_products.sql', 'utf8')
      .replace(/^BEGIN;/, '').replace(/COMMIT;\s*$/, '')
  : '';
await sql(`BEGIN;
${migration}
DO $$
DECLARE admin_id uuid; product_id uuid; sale_id uuid; item_id uuid; category_name text;
BEGIN
 SELECT id INTO admin_id FROM public.profiles WHERE role='admin' AND active LIMIT 1;
 IF admin_id IS NULL THEN RAISE EXCEPTION 'No active admin for verification'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM set_config('test.admin_id',admin_id::text,true);
 SELECT name INTO category_name FROM public.categories LIMIT 1;
 INSERT INTO public.products(name,price,category) VALUES('QA deletion rollback',12,category_name) RETURNING id INTO product_id;
 SELECT id INTO sale_id FROM public.sales WHERE status='completed' ORDER BY created_at DESC LIMIT 1;
 IF sale_id IS NULL THEN RAISE EXCEPTION 'No completed sale for historical verification'; END IF;
 INSERT INTO public.sale_items(sale_id,product_id,product_name,quantity,unit_price)
 VALUES(sale_id,product_id,'QA deletion rollback',2,12) RETURNING id INTO item_id;
 PERFORM set_config('test.product_id',product_id::text,true);
 PERFORM set_config('test.item_id',item_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
#variable_conflict use_variable
DECLARE product_id uuid := current_setting('test.product_id')::uuid; ranking jsonb; sale_date date;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.delete_product(product_id);
  RAISE EXCEPTION 'Unauthorized deletion was accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Solo administradores' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.admin_id'),true);
 PERFORM public.delete_product(product_id);
 IF EXISTS(SELECT 1 FROM public.products WHERE id=product_id) THEN RAISE EXCEPTION 'Product still exists'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sale_items i WHERE i.id=current_setting('test.item_id')::uuid
  AND i.product_id=product_id AND i.product_name='QA deletion rollback' AND i.quantity=2 AND i.unit_price=12)
 THEN RAISE EXCEPTION 'Historical sale item changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity_id=product_id AND action='Producto eliminado')
 THEN RAISE EXCEPTION 'Missing audit event'; END IF;
 SELECT (s.created_at AT TIME ZONE 'America/La_Paz')::date INTO sale_date
 FROM public.sales s JOIN public.sale_items i ON i.sale_id=s.id WHERE i.id=current_setting('test.item_id')::uuid;
 ranking := public.product_sales_ranking(sale_date,sale_date);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ranking) r WHERE r->>'id'=product_id::text AND (r->>'quantity')::int=2)
 THEN RAISE EXCEPTION 'Deleted product missing from historical ranking'; END IF;
 IF has_function_privilege('anon','public.delete_product(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous deletion permission'; END IF;
END $$;
ROLLBACK;`);
console.log('PASS: admin deletion, unauthorized rejection, preserved sale detail, audit and ranking. All fixtures rolled back.');
