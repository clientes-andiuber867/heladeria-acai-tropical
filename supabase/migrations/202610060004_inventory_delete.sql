BEGIN;
-- Movement records retain the original item identity even after catalog deletion.
ALTER TABLE public.inventory_movements ADD COLUMN item_name text, ADD COLUMN item_unit text;
UPDATE public.inventory_movements m SET item_name=i.name,item_unit=i.unit FROM public.inventory_items i WHERE i.id=m.item_id;
ALTER TABLE public.inventory_movements ALTER COLUMN item_name SET NOT NULL, ALTER COLUMN item_unit SET NOT NULL;
ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_item_id_fkey;
CREATE FUNCTION public.inventory_movement_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 SELECT name,unit INTO NEW.item_name,NEW.item_unit FROM public.inventory_items WHERE id=NEW.item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'El artículo ya no existe'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_movement_snapshot BEFORE INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.inventory_movement_snapshot();
REVOKE ALL ON FUNCTION public.inventory_movement_snapshot() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.inventory_delete(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item public.inventory_items%rowtype;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 DELETE FROM public.inventory_items WHERE id=p_id RETURNING * INTO v_item;
 IF NOT FOUND THEN RAISE EXCEPTION 'El artículo ya no existe'; END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail)
 VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inventario: artículo eliminado',p_id,
 jsonb_build_object('inventory_name',v_item.name,'quantity',v_item.quantity,'unit',v_item.unit));
END $$;
REVOKE ALL ON FUNCTION public.inventory_delete(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_delete(uuid) TO authenticated;
COMMIT;
