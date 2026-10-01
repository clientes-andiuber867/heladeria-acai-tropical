-- Propuesta inicial. Aplicar solamente en un proyecto nuevo, tras revisión.
-- El frontend demo aún NO consume estas tablas.
begin;
create type public.app_role as enum ('admin','cashier');
create table public.profiles (
 id uuid primary key references auth.users(id),
 display_name text not null,
 role public.app_role not null default 'cashier'
);
create function public.is_admin() returns boolean language sql stable security definer
set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create table public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 80),
 description text not null default '',
 price numeric(12,2) not null check(price>0),
 category text not null,
 image text,
 available boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.sales (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 cashier_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 payment_method text not null check(payment_method in ('Efectivo','QR')),
 total numeric(12,2) not null check(total>0),
 cash_received numeric(12,2),
 note text not null default ''
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.sales(id),
 product_id uuid not null references public.products(id),
 product_name text not null,
 quantity integer not null check(quantity between 1 and 999),
 unit_price numeric(12,2) not null check(unit_price>0)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 action text not null,
 entity_id uuid,
 detail jsonb not null
);
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.audit_events enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- No client may insert/update roles, including their own.
create policy public_catalog on public.products for select to anon,authenticated using(true);
create policy admin_catalog_insert on public.products for insert to authenticated with check(public.is_admin());
create policy admin_catalog_update on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy sales_read on public.sales for select to authenticated using(public.is_admin() or cashier_id=auth.uid());
create policy items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id and (public.is_admin() or s.cashier_id=auth.uid())));
create policy audit_read on public.audit_events for select to authenticated using(public.is_admin());
-- Sales/audit are append-only through trusted functions, never client inserts.
revoke all on public.profiles,public.products,public.sales,public.sale_items,public.audit_events from anon,authenticated;
grant select on public.products to anon,authenticated;
grant select on public.profiles,public.sales,public.sale_items,public.audit_events to authenticated;
grant insert,update on public.products to authenticated;

create function public.audit_product_change() returns trigger language plpgsql security definer
set search_path = public as $$
begin
 insert into public.audit_events(actor_id,action,entity_id,detail)
 values(auth.uid(),case when TG_OP='INSERT' then 'Producto agregado' else 'Producto editado' end,new.id,
 jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end; $$;
create trigger product_audit after insert or update on public.products for each row execute function public.audit_product_change();

create function public.complete_sale(p_request_id uuid,p_items jsonb,p_method text,p_cash numeric default null,p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
 v_sale uuid;
 v_total numeric(12,2):=0;
 v_item jsonb;
 v_product public.products%rowtype;
 v_qty integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Unauthorized'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 -- Serialize retries before checking the idempotency key.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select id into v_sale from public.sales where request_id=p_request_id and cashier_id=auth.uid();
 if found then return v_sale; end if;
 if p_method is null or p_method not in ('Efectivo','QR') then raise exception 'Invalid payment'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid items'; end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'Invalid item count'; end if;
 if length(coalesce(p_note,''))>300 then raise exception 'Note too long'; end if;
 -- Lock products in stable order so availability/prices cannot change mid-sale.
 perform 1 from public.products where id in(select (x->>'id')::uuid from jsonb_array_elements(p_items) x) order by id for share;
 for v_item in select * from jsonb_array_elements(p_items) loop
  if coalesce(v_item->>'qty','') !~ '^[0-9]{1,3}$' then raise exception 'Invalid quantity'; end if;
  v_qty:=(v_item->>'qty')::integer;
  if v_qty<1 then raise exception 'Invalid quantity'; end if;
  select * into v_product from public.products where id=(v_item->>'id')::uuid and available;
  if not found then raise exception 'Product unavailable'; end if;
  v_total:=v_total+v_product.price*v_qty;
 end loop;
 if p_method='Efectivo' and (p_cash is null or p_cash::text in ('NaN','Infinity','-Infinity') or p_cash<v_total) then raise exception 'Insufficient cash'; end if;
 insert into public.sales(request_id,cashier_id,payment_method,total,cash_received,note)
 values(p_request_id,auth.uid(),p_method,v_total,case when p_method='Efectivo' then p_cash end,coalesce(p_note,'')) returning id into v_sale;
 for v_item in select * from jsonb_array_elements(p_items) loop
  select * into strict v_product from public.products where id=(v_item->>'id')::uuid;
  insert into public.sale_items(sale_id,product_id,product_name,quantity,unit_price)
  values(v_sale,v_product.id,v_product.name,(v_item->>'qty')::integer,v_product.price);
 end loop;
 insert into public.audit_events(actor_id,action,entity_id,detail)
 values(auth.uid(),'Venta registrada',v_sale,jsonb_build_object('total',v_total,'payment',p_method,'note',p_note,'items',(select jsonb_agg(to_jsonb(i)) from public.sale_items i where i.sale_id=v_sale)));
 return v_sale;
end; $$;
revoke all on function public.complete_sale(uuid,jsonb,text,numeric,text) from public,anon;
grant execute on function public.complete_sale(uuid,jsonb,text,numeric,text) to authenticated;
revoke all on function public.audit_product_change() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
commit;

-- Create Auth users first, then seed profiles using the SQL Editor as project owner.
-- insert into public.profiles(id,display_name,role) values ('AUTH_USER_UUID','Nombre','admin');
-- Image Storage bucket/policies and remote UI integration are a separate next step.
