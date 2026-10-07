BEGIN;
CREATE TABLE public.inventory_groups (
 name text PRIMARY KEY CHECK(name=trim(name) AND length(name) BETWEEN 1 AND 60)
);
INSERT INTO public.inventory_groups(name) SELECT DISTINCT category FROM public.inventory_items;
INSERT INTO public.inventory_groups(name) VALUES('General') ON CONFLICT DO NOTHING;
ALTER TABLE public.inventory_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_groups FROM anon,authenticated;
GRANT SELECT ON public.inventory_groups TO authenticated;
CREATE POLICY inventory_groups_admin_read ON public.inventory_groups FOR SELECT TO authenticated USING(public.is_admin());
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_group_fk
 FOREIGN KEY(category) REFERENCES public.inventory_groups(name) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE FUNCTION public.inventory_group_save(p_name text,p_previous text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 p_name:=trim(p_name);
 IF p_name IS NULL OR length(p_name) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Escribe un nombre de entre 1 y 60 caracteres'; END IF;
 IF p_previous IS NULL THEN
  INSERT INTO public.inventory_groups(name) VALUES(p_name);
 ELSE
  UPDATE public.inventory_groups SET name=p_name WHERE name=p_previous;
  IF NOT FOUND THEN RAISE EXCEPTION 'El grupo ya no existe. Actualiza la lista'; END IF;
 END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,action,detail)
 VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inventario: grupo guardado',jsonb_build_object('inventory_name',p_name,'previous',p_previous));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Ya existe un grupo con ese nombre';
END $$;

CREATE FUNCTION public.inventory_group_delete(p_name text,p_replacement text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM 1 FROM public.inventory_groups WHERE name=p_name FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El grupo ya no existe. Actualiza la lista'; END IF;
 IF p_replacement IS NOT NULL THEN
  IF p_replacement=p_name THEN RAISE EXCEPTION 'Elige un grupo diferente'; END IF;
  PERFORM 1 FROM public.inventory_groups WHERE name=p_replacement FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El grupo de destino no existe'; END IF;
  UPDATE public.inventory_items SET category=p_replacement,updated_at=now() WHERE category=p_name;
 ELSIF EXISTS(SELECT 1 FROM public.inventory_items WHERE category=p_name) THEN
  RAISE EXCEPTION 'Este grupo tiene artículos. Elige otro grupo para trasladarlos';
 END IF;
 DELETE FROM public.inventory_groups WHERE name=p_name;
 INSERT INTO public.audit_events(actor_id,actor_name,action,detail)
 VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inventario: grupo eliminado',jsonb_build_object('inventory_name',p_name,'replacement',p_replacement));
END $$;
REVOKE ALL ON FUNCTION public.inventory_group_save(text,text),public.inventory_group_delete(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_group_save(text,text),public.inventory_group_delete(text,text) TO authenticated;
COMMIT;
