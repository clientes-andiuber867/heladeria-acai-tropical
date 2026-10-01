BEGIN;
DROP FUNCTION public.search_audit(date,date,text,integer);
CREATE FUNCTION public.search_audit(p_from date,p_to date,p_search text DEFAULT '',p_offset integer DEFAULT 0,p_scope text DEFAULT 'changes') RETURNS TABLE(id uuid,created_at timestamptz,actor_name text,action text,entity_id uuid,detail jsonb,total_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 THEN RAISE EXCEPTION 'Filtro inválido'; END IF;
 RETURN QUERY SELECT a.id,a.created_at,a.actor_name,a.action,a.entity_id,a.detail,count(*) OVER() FROM public.audit_events a
 WHERE a.created_at>=p_from::timestamp AT TIME ZONE 'America/La_Paz' AND a.created_at<(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz'
 AND (p_scope='all' OR
 (p_scope='changes' AND a.action NOT IN ('Venta registrada','Inicio de sesión')) OR
 (p_scope='voids' AND a.action='Venta anulada') OR
 (p_scope='catalog' AND (a.action LIKE 'Producto%' OR a.action LIKE 'Sección%')) OR
 (p_scope='access' AND (a.action LIKE 'Usuario%' OR a.action LIKE 'Acceso%' OR a.action LIKE 'Credenciales%' OR a.action='Inicio de sesión')) OR
 (p_scope='payments' AND a.action='QR de cobro actualizado'))
 AND (coalesce(p_search,'')='' OR (a.actor_name||' '||a.action||' '||a.detail::text) ILIKE '%'||p_search||'%') ORDER BY a.created_at DESC LIMIT 25 OFFSET p_offset;
END; $$;

REVOKE ALL ON FUNCTION public.search_audit(date,date,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_audit(date,date,text,integer,text) TO authenticated;
CREATE FUNCTION public.sales_collection_totals(p_from date,p_to date,p_method text DEFAULT '',p_status text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object('collected',coalesce(sum(total) FILTER(WHERE status='completed'),0),'cash',coalesce(sum(cash_amount) FILTER(WHERE status='completed'),0),'qr',coalesce(sum(qr_amount) FILTER(WHERE status='completed'),0),'voided',count(*) FILTER(WHERE status='voided'))
FROM public.sales WHERE created_at>=p_from::timestamp AT TIME ZONE 'America/La_Paz' AND created_at<(p_to+1)::timestamp AT TIME ZONE 'America/La_Paz' AND (p_method='' OR payment_method=p_method) AND (p_status='' OR status=p_status);
$$;
REVOKE ALL ON FUNCTION public.sales_collection_totals(date,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_collection_totals(date,date,text,text) TO authenticated;
COMMIT;
