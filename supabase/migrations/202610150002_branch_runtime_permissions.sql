BEGIN;
-- Supabase's auth schema is owned by supabase_auth_admin. Its existing
-- authenticated role already has USAGE; postgres cannot grant it directly
-- to a newly created role on hosted projects. Inherit that existing grant.
GRANT authenticated TO acai_branch_executor;
ALTER ROLE acai_branch_executor INHERIT;
COMMIT;
