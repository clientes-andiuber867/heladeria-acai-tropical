import {sql} from './admin-session.mjs';
console.log(await sql('select p.role,p.active,p.must_change_password,u.raw_app_meta_data from public.profiles p join auth.users u on u.id=p.id',true));
console.log(await sql("select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='products'",true));
