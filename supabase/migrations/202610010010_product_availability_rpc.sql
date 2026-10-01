-- Migration: Allow active staff (cashiers) to toggle product availability safely
-- without allowing them to modify product prices, names, or categories.

CREATE OR REPLACE FUNCTION public.toggle_product_availability(p_id uuid, p_available boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_product public.products%rowtype;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_id AND NOT archived;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  UPDATE public.products
  SET available = p_available, updated_at = now()
  WHERE id = p_id;

  SELECT coalesce(display_name, 'Sistema') INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.audit_events(actor_id, actor_name, action, entity_id, detail)
  VALUES (
    auth.uid(),
    v_name,
    CASE WHEN p_available THEN 'Producto marcado disponible' ELSE 'Producto marcado agotado' END,
    p_id,
    jsonb_build_object(
      'product_name', v_product.name,
      'available', p_available,
      'previous_available', v_product.available
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_product_availability(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_product_availability(uuid, boolean) TO authenticated;
