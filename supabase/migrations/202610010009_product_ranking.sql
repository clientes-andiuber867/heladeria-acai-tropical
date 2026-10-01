BEGIN;
CREATE FUNCTION public.product_sales_ranking(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Rango de fechas inválido'; END IF;
 WITH sold AS (
 SELECT i.product_id,sum(i.quantity) quantity,sum(i.quantity*i.unit_price) total
 FROM sale_items i JOIN sales s ON s.id=i.sale_id
 WHERE s.status='completed' AND s.created_at>=p_from::timestamp AT TIME ZONE 'America/La_Paz' AND s.created_at<(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz'
 GROUP BY i.product_id
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'quantity',coalesce(s.quantity,0),'total',coalesce(s.total,0)) ORDER BY coalesce(s.quantity,0) DESC,coalesce(s.total,0) DESC,p.name,p.id),'[]'::jsonb)
 INTO result FROM products p LEFT JOIN sold s ON s.product_id=p.id WHERE NOT p.archived OR s.quantity>0;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.product_sales_ranking(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_sales_ranking(date,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.dashboard_summary(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Rango de fechas inválido'; END IF;
 start_at=p_from::timestamp AT TIME ZONE 'America/La_Paz'; end_at=(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz';
 WITH filtered AS (SELECT * FROM public.sales WHERE created_at>=start_at AND created_at<end_at), completed AS (SELECT * FROM filtered WHERE status='completed')
 SELECT jsonb_build_object(
 'revenue',coalesce((SELECT sum(total) FROM completed),0),'orders',(SELECT count(*) FROM completed),
 'cash',coalesce((SELECT sum(cash_amount) FROM completed),0),'qr',coalesce((SELECT sum(qr_amount) FROM completed),0),
 'voided',(SELECT count(*) FROM filtered WHERE status='voided'),
 'series',coalesce((SELECT jsonb_agg(t ORDER BY label) FROM (SELECT CASE WHEN p_from=p_to THEN to_char(created_at AT TIME ZONE 'America/La_Paz','HH24:00') ELSE to_char(created_at AT TIME ZONE 'America/La_Paz','YYYY-MM-DD') END AS label,sum(total) AS total FROM completed GROUP BY 1) t),'[]'::jsonb),
 'popular',coalesce((SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(public.product_sales_ranking(p_from,p_to)) x WHERE (x->>'quantity')::numeric>0 LIMIT 3) t),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(t) FROM (SELECT s.*, (SELECT coalesce(jsonb_agg(i),'[]'::jsonb) FROM public.sale_items i WHERE i.sale_id=s.id) AS sale_items FROM filtered s ORDER BY s.created_at DESC LIMIT 3) t),'[]'::jsonb)
 ) INTO result; RETURN result;
END; $$;
COMMIT;
