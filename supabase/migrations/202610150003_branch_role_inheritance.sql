BEGIN;
-- PostgreSQL 16+ stores inheritance on each membership. Changing the role's
-- INHERIT flag alone does not update a membership created while NOINHERIT.
GRANT authenticated TO acai_branch_executor WITH INHERIT TRUE;
COMMIT;
