begin;
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(name=trim(name) and length(name) between 2 and 50 and name <> 'Todos'),
 sort_order integer not null default 0
);
insert into public.categories(name,sort_order) values ('Açaí bowls',1),('Helados',2),('Comida',3),('Postres',4),('Bebidas',5);
insert into public.categories(name) select distinct category from public.products on conflict(name) do nothing;
alter table public.products add constraint products_category_fk foreign key(category) references public.categories(name) on update cascade on delete restrict;
create index if not exists products_category_idx on public.products(category);
alter table public.categories enable row level security;
grant select on public.categories to anon,authenticated;
grant insert,update,delete on public.categories to authenticated;
create policy categories_read on public.categories for select using(true);
create policy categories_write on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create function public.audit_category() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into audit_events(actor_id,actor_name,action,entity_id,detail) values(auth.uid(),coalesce((select display_name from profiles where id=auth.uid()),'Sistema'),
 case TG_OP when 'INSERT' then 'Sección creada' when 'UPDATE' then 'Sección editada' else 'Sección eliminada' end,
 case when TG_OP='DELETE' then OLD.id else NEW.id end,
 jsonb_build_object('name',case when TG_OP='DELETE' then OLD.name else NEW.name end,'before',case when TG_OP='INSERT' then null else OLD.name end));
 return null;
end;$$;
create trigger category_audit after insert or update or delete on public.categories for each row execute function public.audit_category();
create function public.delete_category(p_name text,p_replacement text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Solo administradores'; end if;
 perform 1 from categories where name in (p_name,p_replacement) order by name for update;
 if not exists(select 1 from categories where name=p_name) then raise exception 'La sección ya no existe'; end if;
 if p_replacement is not null then
  if p_replacement=p_name or not exists(select 1 from categories where name=p_replacement) then raise exception 'Elige otra sección válida'; end if;
  update products set category=p_replacement where category=p_name;
 elsif exists(select 1 from products where category=p_name) then
  raise exception 'Esta sección contiene productos. Elige una sección de destino para conservarlos.';
 end if;
 delete from categories where name=p_name;
end;$$;
revoke all on function public.delete_category(text,text) from public,anon;
grant execute on function public.delete_category(text,text) to authenticated;
alter publication supabase_realtime add table public.categories;
commit;

