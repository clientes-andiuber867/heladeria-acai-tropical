import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";

export async function createTestDatabase({ migrate = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE PUBLICATION supabase_realtime;
  `);
  const files = (await fs.readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (!migrate && file.startsWith("20261015")) continue;
    try {
      await db.exec(await fs.readFile(`supabase/migrations/${file}`, "utf8"));
    } catch (e) {
      throw new Error(`${file}: ${e.message}`, { cause: e });
    }
  }
  return db;
}
export const B1 = "00000000-0000-4000-8000-000000000001";
export const B2 = "00000000-0000-4000-8000-000000000002";
export const ADMIN = "10000000-0000-4000-8000-000000000001";
export const CASHIER = "10000000-0000-4000-8000-000000000002";
export async function seedUsers(db) {
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${ADMIN}','admin@test.local'),('${CASHIER}','cashier@test.local');
  UPDATE public.profiles SET active=true,must_change_password=false,role='admin' WHERE id='${ADMIN}';
  UPDATE public.profiles SET active=true,must_change_password=false,branch_id='${B1}' WHERE id='${CASHIER}';`);
}
export async function asUser(
  db,
  user,
  branch,
  query,
  params = [],
  role = user ? "authenticated" : "anon",
) {
  return db.transaction(async (tx) => {
    await tx.query(
      `SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.headers',$2,true)`,
      [user || "", JSON.stringify(branch ? { "x-branch-id": branch } : {})],
    );
    await tx.exec(`SET LOCAL ROLE ${role}`);
    return tx.query(query, params);
  });
}
