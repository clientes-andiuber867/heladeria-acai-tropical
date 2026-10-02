import {sql} from './admin-session.mjs';
await sql(`BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE role='cashier' AND active LIMIT 1),true);
CREATE FUNCTION pg_temp.reject(q text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'Expected rejection: %',q; END $$;
DO $$ DECLARE sh uuid; p products; sale uuid; items jsonb; result jsonb; BEGIN
UPDATE cash_shifts SET status='closed' WHERE cashier_id=auth.uid() AND status='open';
SELECT * INTO p FROM products WHERE available AND NOT archived LIMIT 1;items=jsonb_build_array(jsonb_build_object('id',p.id,'qty',1,'expected_price',p.price));
PERFORM pg_temp.reject(format('select complete_sale(%L,%L,%L,1000)',gen_random_uuid(),items,'Efectivo'));
sh=open_cash_shift(50);IF open_cash_shift(50)<>sh THEN RAISE EXCEPTION 'Duplicate opening'; END IF;
sale=complete_sale(gen_random_uuid(),items,'Efectivo',1000);
IF NOT EXISTS(select 1 from sales where id=sale and shift_id=sh) THEN RAISE EXCEPTION 'Missing shift';END IF;
result=cash_shift_balance(sh);IF (result->>'expected_cash')::numeric<>50+p.price THEN RAISE EXCEPTION 'Cash change calculation';END IF;
PERFORM pg_temp.reject(format('select close_cash_shift(%L,0)',sh));
result=close_cash_shift(sh,50+p.price);IF (result->>'difference')::numeric<>0 THEN RAISE EXCEPTION 'Close balance';END IF;
PERFORM pg_temp.reject(format('select complete_sale(%L,%L,%L,1000)',gen_random_uuid(),items,'Efectivo'));
UPDATE sales SET created_at=now()-interval '2 days' WHERE id=sale;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF EXISTS(select 1 from sales where cashier_id<>auth.uid() OR (created_at AT TIME ZONE 'America/La_Paz')::date<>(now() AT TIME ZONE 'America/La_Paz')::date) THEN RAISE EXCEPTION 'Cashier reads old sales';END IF;
IF EXISTS(select 1 from sale_items i where NOT EXISTS(select 1 from sales s where s.id=i.sale_id)) THEN RAISE EXCEPTION 'Items leaked';END IF;
END $$;
ROLLBACK;`);console.log('PASS no sale without open shift, unique opening, net cash balance, discrepancy validation, closing, closed sale block, daily RLS and item isolation (rolled back).');

