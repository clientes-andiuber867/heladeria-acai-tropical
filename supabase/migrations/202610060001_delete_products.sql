BEGIN;
-- Sale items retain their immutable product identifier, name and unit price as
-- historical snapshots, independently of the current editable catalog.
ALTER TABLE public.sale_items DROP CONSTRAINT sale_items_product_id_fkey;
CREATE OR REPLACE FUNCTION public.delete_product(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_product public.products%rowtype;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 DELETE FROM public.products WHERE id=p_id RETURNING * INTO old_product;
 IF NOT FOUND THEN RAISE EXCEPTION 'El producto ya no existe'; END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail)
 VALUES(auth.uid(),coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Administrador'),
 'Producto eliminado',p_id,jsonb_build_object('before',to_jsonb(old_product)));
END; $$;
REVOKE ALL ON FUNCTION public.delete_product(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.product_sales_ranking(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Rango de fechas inválido'; END IF;
 WITH sold AS (
 SELECT i.product_id,(array_agg(i.product_name ORDER BY s.created_at DESC, i.id))[1] name,sum(i.quantity) quantity,sum(i.quantity*i.unit_price) total
 FROM sale_items i JOIN sales s ON s.id=i.sale_id
 WHERE s.status='completed' AND s.created_at>=p_from::timestamp AT TIME ZONE 'America/La_Paz' AND s.created_at<(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz'
 GROUP BY i.product_id
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',coalesce(p.id,s.product_id),'name',coalesce(p.name,s.name),'quantity',coalesce(s.quantity,0),'total',coalesce(s.total,0)) ORDER BY coalesce(s.quantity,0) DESC,coalesce(s.total,0) DESC,coalesce(p.name,s.name),coalesce(p.id,s.product_id)),'[]'::jsonb)
 INTO result FROM products p FULL JOIN sold s ON s.product_id=p.id WHERE NOT p.archived OR s.quantity>0;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.product_sales_ranking(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_sales_ranking(date,date) TO authenticated;

COMMIT;
