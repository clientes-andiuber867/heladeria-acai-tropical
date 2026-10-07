BEGIN;
CREATE TABLE public.inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 category text NOT NULL DEFAULT 'General' CHECK(length(category)<=60),
 unit text NOT NULL CHECK(length(trim(unit)) BETWEEN 1 AND 30),
 location text NOT NULL DEFAULT '' CHECK(length(location)<=100),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantity>=0 AND quantity<1000000000),
 minimum numeric(14,3) NOT NULL DEFAULT 0 CHECK(minimum>=0 AND minimum<1000000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inventory_movements (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES public.inventory_items(id),
 kind text NOT NULL CHECK(kind IN ('initial','in','out','count')),
 quantity_before numeric(14,3) NOT NULL, quantity_after numeric(14,3) NOT NULL,
 delta numeric(14,3) NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 actor_id uuid NOT NULL REFERENCES public.profiles(id), actor_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX inventory_movements_item_date ON public.inventory_movements(item_id,created_at DESC);
CREATE INDEX inventory_movements_date ON public.inventory_movements(created_at DESC,id);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_items,public.inventory_movements FROM anon,authenticated;
GRANT SELECT ON public.inventory_items,public.inventory_movements TO authenticated;
CREATE POLICY inventory_admin_read ON public.inventory_items FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY inventory_movements_admin_read ON public.inventory_movements FOR SELECT TO authenticated USING(public.is_admin());

CREATE FUNCTION public.inventory_save(p_id uuid,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_qty numeric; v_min numeric; v_old public.inventory_items%rowtype;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 v_qty:=coalesce((p_data->>'quantity')::numeric,0); v_min:=coalesce((p_data->>'minimum')::numeric,0);
 IF v_qty<0 OR v_qty>=1000000000 OR v_min<0 OR v_min>=1000000000 OR v_qty<>round(v_qty,3) OR v_min<>round(v_min,3) THEN RAISE EXCEPTION 'Revisa las cantidades (máximo tres decimales)'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.inventory_items(name,category,unit,location,note,quantity,minimum)
  VALUES(trim(p_data->>'name'),coalesce(nullif(trim(p_data->>'category'),''),'General'),trim(p_data->>'unit'),coalesce(trim(p_data->>'location'),''),coalesce(p_data->>'note',''),v_qty,v_min) RETURNING id INTO v_id;
  INSERT INTO public.inventory_movements(id,item_id,kind,quantity_before,quantity_after,delta,note,actor_id,actor_name)
  VALUES(gen_random_uuid(),v_id,'initial',0,v_qty,v_qty,'Inventario inicial',auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()));
 ELSE
  SELECT * INTO v_old FROM public.inventory_items WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El artículo ya no existe'; END IF;
  IF p_data->>'unit' IS DISTINCT FROM v_old.unit THEN RAISE EXCEPTION 'La unidad no se puede cambiar para conservar el historial'; END IF;
  UPDATE public.inventory_items SET name=trim(p_data->>'name'),category=coalesce(nullif(trim(p_data->>'category'),''),'General'),location=coalesce(trim(p_data->>'location'),''),note=coalesce(p_data->>'note',''),minimum=v_min,updated_at=now() WHERE id=p_id;
  v_id:=p_id;
 END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail)
 VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inventario: artículo guardado',v_id,jsonb_build_object('inventory_name',p_data->>'name'));
 RETURN v_id;
END $$;

CREATE FUNCTION public.inventory_move(p_request uuid,p_item uuid,p_kind text,p_quantity numeric,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item public.inventory_items%rowtype; v_after numeric; v_existing public.inventory_movements%rowtype;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_request IS NULL OR p_kind IS NULL OR p_kind NOT IN ('in','out','count') OR p_quantity IS NULL OR p_quantity<0 OR p_quantity>=1000000000 OR p_quantity<>round(p_quantity,3) OR (p_kind<>'count' AND p_quantity=0) THEN RAISE EXCEPTION 'Cantidad o movimiento inválido'; END IF;
 IF p_note IS NULL OR length(trim(p_note))=0 OR length(p_note)>500 THEN RAISE EXCEPTION 'Indica el motivo del movimiento'; END IF;
 SELECT * INTO v_item FROM public.inventory_items WHERE id=p_item FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'El artículo ya no existe'; END IF;
 SELECT * INTO v_existing FROM public.inventory_movements WHERE id=p_request;
 IF FOUND THEN
  IF v_existing.item_id<>p_item OR v_existing.actor_id<>auth.uid() OR v_existing.kind<>p_kind OR v_existing.note<>trim(p_note)
    OR (CASE WHEN p_kind='count' THEN v_existing.quantity_after ELSE abs(v_existing.delta) END)<>p_quantity
  THEN RAISE EXCEPTION 'Solicitud ya utilizada para otro movimiento'; END IF;
  RETURN;
 END IF;
 v_after:=CASE p_kind WHEN 'count' THEN p_quantity WHEN 'in' THEN v_item.quantity+p_quantity ELSE v_item.quantity-p_quantity END;
 IF v_after<0 THEN RAISE EXCEPTION 'No hay existencias suficientes para esa salida'; END IF;
 UPDATE public.inventory_items SET quantity=v_after,updated_at=clock_timestamp() WHERE id=p_item;
 INSERT INTO public.inventory_movements(id,item_id,kind,quantity_before,quantity_after,delta,note,actor_id,actor_name)
 VALUES(p_request,p_item,p_kind,v_item.quantity,v_after,v_after-v_item.quantity,trim(p_note),auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()));
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail)
 VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inventario: movimiento registrado',p_item,
 jsonb_build_object('inventory_name',v_item.name,'before_quantity',v_item.quantity,'after_quantity',v_after,'unit',v_item.unit,'note',trim(p_note)));
END $$;

CREATE FUNCTION public.inventory_snapshot(p_date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.name),'[]'::jsonb) INTO v_result FROM (
  SELECT i.id,i.name,i.category,i.unit,i.location,i.note,i.minimum,i.created_at,i.updated_at,
   CASE WHEN p_date IS NULL THEN i.quantity ELSE coalesce(m.quantity_after,0) END quantity
  FROM public.inventory_items i LEFT JOIN LATERAL (
   SELECT quantity_after FROM public.inventory_movements WHERE item_id=i.id
    AND created_at<(p_date+1)::timestamp AT TIME ZONE 'America/La_Paz'
   ORDER BY created_at DESC,id DESC LIMIT 1
  ) m ON p_date IS NOT NULL
  WHERE p_date IS NULL OR i.created_at<(p_date+1)::timestamp AT TIME ZONE 'America/La_Paz'
 ) t;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.inventory_save(uuid,jsonb),public.inventory_move(uuid,uuid,text,numeric,text),public.inventory_snapshot(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_save(uuid,jsonb),public.inventory_move(uuid,uuid,text,numeric,text),public.inventory_snapshot(date) TO authenticated;
COMMIT;
