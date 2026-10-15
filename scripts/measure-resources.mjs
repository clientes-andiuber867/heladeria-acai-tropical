import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { sql, url, anon, secret } from "./admin-session.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const origin = process.env.ACAI_TEST_URL || "http://localhost:5176";
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const [{ email }] = await sql(
  "SELECT email FROM profiles WHERE role='admin' AND active AND deleted_at IS NULL ORDER BY id LIMIT 1",
  true,
);
const { data: link, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (error) throw error;
const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: login, error: authError } = await client.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: "magiclink",
});
if (authError) throw authError;
const browser = await chromium.launch();
const result = {};
try {
  const page = await browser.newPage();
  let calls = [];
  const errors = [];
  page.on("request", (r) => {
    if (r.url().startsWith(url + "/rest/v1/"))
      calls.push(new URL(r.url()).pathname.replace("/rest/v1/", ""));
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    origin +
      "/#" +
      new URLSearchParams({ ...login.session, type: "magiclink" }),
  );
  await expect(
    page.getByRole("heading", { name: "Un vistazo a tu día" }),
  ).toBeVisible();
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle");
  result.adminInitial = { requests: calls.length, endpoints: [...calls] };
  calls = [];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle");
  result.adminFocus = { requests: calls.length, endpoints: [...calls] };
  calls = [];
  const initialJs = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (r) =>
          r.name.endsWith(".js") && new URL(r.name).origin === location.origin,
      )
      .reduce((n, r) => n + r.decodedBodySize, 0),
  );
  result.adminInitialJsBytes = initialJs;
  await page
    .getByRole("button", { name: "Historial de ventas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ventas registradas" }),
  ).toBeVisible();
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle");
  calls = [];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle");
  result.focusAfterVisit = { requests: calls.length, endpoints: [...calls] };
  result.errors = errors;
  const publicPage = await browser.newPage();
  await publicPage.goto(origin + "/menu");
  await expect(
    publicPage.getByRole("heading", { name: "¿Qué se te antoja hoy?" }),
  ).toBeVisible();
  await publicPage.waitForLoadState("networkidle");
  result.publicJsBytes = await publicPage.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (r) =>
          r.name.endsWith(".js") && new URL(r.name).origin === location.origin,
      )
      .reduce((n, r) => n + r.decodedBodySize, 0),
  );
  const file = path.join(
    process.env.TEMP,
    `acai-resources-${process.argv[2] || "measurement"}.json`,
  );
  await fs.writeFile(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await client.auth.signOut({ scope: "local" });
}
