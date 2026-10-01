BEGIN;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.profiles ADD CONSTRAINT deleted_access_inactive CHECK (deleted_at IS NULL OR NOT active);
COMMIT;
