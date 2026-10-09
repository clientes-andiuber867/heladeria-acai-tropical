BEGIN;
-- The public menu needs only the current payment QR, never staff or sales data.
CREATE FUNCTION public.public_payment_qr() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('qr_path',qr_path,'recipient',recipient,'version',version)
 FROM public.payment_settings WHERE id=1;
$$;
REVOKE ALL ON FUNCTION public.public_payment_qr() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_payment_qr() TO anon,authenticated;
COMMIT;
