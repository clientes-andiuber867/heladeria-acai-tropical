BEGIN;
CREATE FUNCTION public.dashboard_summary(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Rango de fechas inválido'; END IF;
 start_at=p_from::timestamp AT TIME ZONE 'America/La_Paz'; end_at=(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz';
 WITH filtered AS (SELECT * FROM public.sales WHERE created_at>=start_at AND created_at<end_at), completed AS (SELECT * FROM filtered WHERE status='completed')
 SELECT jsonb_build_object(
 'revenue',coalesce((SELECT sum(total) FROM completed),0),'orders',(SELECT count(*) FROM completed),
 'cash',coalesce((SELECT sum(total) FROM completed WHERE payment_method='Efectivo'),0),'qr',coalesce((SELECT sum(total) FROM completed WHERE payment_method='QR'),0),
 'voided',(SELECT count(*) FROM filtered WHERE status='voided'),
 'series',coalesce((SELECT jsonb_agg(t ORDER BY label) FROM (SELECT CASE WHEN p_from=p_to THEN to_char(created_at AT TIME ZONE 'America/La_Paz','HH24:00') ELSE to_char(created_at AT TIME ZONE 'America/La_Paz','YYYY-MM-DD') END AS label,sum(total) AS total FROM completed GROUP BY 1) t),'[]'::jsonb),
 'popular',coalesce((SELECT jsonb_agg(t) FROM (SELECT i.product_name AS name,sum(i.quantity) AS quantity,sum(i.quantity*i.unit_price) AS total FROM public.sale_items i JOIN completed s ON s.id=i.sale_id GROUP BY i.product_id,i.product_name ORDER BY sum(i.quantity) DESC LIMIT 5) t),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(t) FROM (SELECT s.*, (SELECT coalesce(jsonb_agg(i),'[]'::jsonb) FROM public.sale_items i WHERE i.sale_id=s.id) AS sale_items FROM filtered s ORDER BY s.created_at DESC LIMIT 5) t),'[]'::jsonb)
 ) INTO result; RETURN result;
END; $$;
CREATE FUNCTION public.search_audit(p_from date,p_to date,p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS TABLE(id uuid,created_at timestamptz,actor_name text,action text,entity_id uuid,detail jsonb,total_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 THEN RAISE EXCEPTION 'Filtro inválido'; END IF;
 RETURN QUERY SELECT a.id,a.created_at,a.actor_name,a.action,a.entity_id,a.detail,count(*) OVER() FROM public.audit_events a
 WHERE a.created_at>=p_from::timestamp AT TIME ZONE 'America/La_Paz' AND a.created_at<(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz'
 AND (coalesce(p_search,'')='' OR (a.actor_name||' '||a.action||' '||a.detail::text) ILIKE '%'||p_search||'%') ORDER BY a.created_at DESC LIMIT 25 OFFSET p_offset;
END; $$;
CREATE FUNCTION public.record_sign_in() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_staff() THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.audit_events WHERE actor_id=auth.uid() AND action='Inicio de sesión' AND created_at>now()-interval '1 minute') THEN RETURN; END IF;
 INSERT INTO public.audit_events(actor_id,actor_name,action,entity_id,detail) VALUES(auth.uid(),(SELECT display_name FROM public.profiles WHERE id=auth.uid()),'Inicio de sesión',auth.uid(),'{}');
END; $$;
REVOKE ALL ON FUNCTION public.dashboard_summary(date,date),public.search_audit(date,date,text,integer),public.record_sign_in() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(date,date),public.search_audit(date,date,text,integer),public.record_sign_in() TO authenticated;
COMMIT;
