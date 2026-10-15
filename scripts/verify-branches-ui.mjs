import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { sql, url, anon, secret, authAdmin } from "./admin-session.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const B1 = "00000000-0000-4000-8000-000000000001",
  B2 = "00000000-0000-4000-8000-000000000002";
const branchRows = await sql("SELECT id,name FROM branches", true);
const names = Object.fromEntries(branchRows.map((b) => [b.id, b.name]));
const root = process.env.ACAI_TEST_URL || "http://localhost:5175";
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const [{ email }] = await sql(
  "SELECT email FROM profiles WHERE role='admin' AND active AND deleted_at IS NULL ORDER BY id LIMIT 1",
  true,
);
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (linkError) throw new Error("No se pudo preparar la sesión de verificación");
const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: login, error: loginError } = await client.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: "magiclink",
});
if (loginError) throw new Error("No se pudo iniciar la sesión de verificación");
const browser = await chromium.launch({ headless: true });
const errors = [];
const tag = `QA-SUC-${crypto.randomBytes(4).toString("hex")}`;
const testEmail = `${tag.toLowerCase()}@example.com`,
  password = crypto.randomBytes(18).toString("base64url");
let testId;
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().startsWith(url) && r.status() >= 400)
    errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
});
page.on("dialog", async (d) => {
  if (d.type() === "confirm") await d.accept();
  else {
    errors.push(`Diálogo inesperado: ${d.message()}`);
    await d.dismiss();
  }
});
async function verifyBranchSave() {
  const id = await page.getByLabel("Sucursal activa").inputValue();
  const [current] = await sql(
    "SELECT name,order_phone FROM branches WHERE id='" + id + "'",
    true,
  );
  await page
    .getByRole("button", { name: "Editar sucursal", exact: true })
    .click();
  await page.getByLabel("Nombre de la sucursal").fill(current.name);
  await page.getByLabel("WhatsApp de pedidos").fill(current.order_phone);
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/rest/v1/rpc/update_branch"),
  );
  await page
    .getByRole("button", { name: "Guardar sucursal", exact: true })
    .click();
  assert.equal((await response).status(), 204);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".topbar .live-badge")).toContainText(current.name);
}
try {
  // A generated link creates a session without sending an email or changing
  // anyone's password. The URL is never logged or stored in test artifacts.
  const hash = new URLSearchParams({ ...login.session, type: "magiclink" });
  hash.set("access_token", login.session.access_token);
  hash.set("refresh_token", login.session.refresh_token);
  await page.goto(`${root}/#${hash}`);
  await expect(page.getByLabel("Sucursal activa")).toHaveValue(B1);
  await expect(
    page.getByRole("heading", { name: "Un vistazo a tu día" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await verifyBranchSave();
  await page.getByLabel("Sucursal activa").selectOption(B2);
  await expect(page.getByLabel("Sucursal activa")).toHaveValue(B2);
  await verifyBranchSave();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "Mis productos", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Carta y QR", exact: true }).click();
  await expect(page.getByLabel("Enlace para tus clientes")).toHaveValue(
    new RegExp(`sucursal=${B2}`),
  );
  await page
    .getByRole("button", { name: "Usuarios y roles", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar usuario", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill(tag);
  await page.getByLabel("Correo electrónico", { exact: true }).fill(testEmail);
  await page.getByLabel("Contraseña de acceso", { exact: true }).fill(password);
  await expect(page.getByLabel("Sucursal asignada")).toHaveValue(B2);
  await page
    .getByRole("button", { name: "Guardar usuario", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20000 });
  const rows = await sql(
    `SELECT id,branch_id FROM profiles WHERE email='${testEmail}'`,
    true,
  );
  testId = rows[0]?.id;
  assert.equal(rows[0]?.branch_id, B2);
  const cashier = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  cashier.on("pageerror", (e) => errors.push(e.message));
  await cashier.goto(root);
  await cashier.getByLabel("Correo electrónico").fill(testEmail);
  await cashier.getByLabel("Contraseña", { exact: true }).fill(password);
  await cashier
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    cashier.getByRole("heading", { name: "Vamos a servir felicidad" }),
  ).toBeVisible();
  await expect(cashier.getByLabel("Sucursal activa")).toHaveCount(0);
  await expect(cashier.locator(".topbar .live-badge")).toContainText(names[B2]);
  await cashier.waitForLoadState("networkidle");
  await cashier.screenshot({
    path: "test-results/branches-cashier-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await cashier.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const cashierClient = createClient(url, anon, {
    global: { headers: { "x-branch-id": B1 } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await cashierClient.auth.signInWithPassword({
    email: testEmail,
    password,
  });
  if (signed.error) throw signed.error;
  const forbidden = await cashierClient.from("products").select("id");
  assert.deepEqual(forbidden.data, []);
  await cashierClient.auth.signOut({ scope: "local" });
  await cashier.close();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "test-results/branches-admin-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await verifyBranchSave();
  await page.screenshot({
    path: "test-results/branches-admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Sucursal activa").selectOption(B1);
  await expect(
    page.getByLabel("Sucursal activa"),
    errors.join("\n"),
  ).toHaveValue(B1);
  await page
    .getByRole("button", { name: "Mis productos", exact: true })
    .click();
  await expect(page.locator("article.product:visible").first()).toBeVisible();
  for (const branch of [B1, B2]) {
    const menu = await browser.newPage();
    await menu.goto(`${root}/menu?sucursal=${branch}`);
    await expect(
      menu.getByRole("heading", { name: "¿Qué se te antoja hoy?" }),
    ).toBeVisible();
    await expect(menu.locator(".public-tag")).toContainText(names[branch]);

    await menu.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: selector, dos cartas, alta real de cajera en sucursal 2, permisos, regreso a sucursal 1 y móvil.",
  );
} finally {
  await browser.close();
  await client.auth.signOut({ scope: "local" });
  // Remove only the unique test identity and its test access-audit entries.
  if (!testId) {
    const rows = await sql(
      `SELECT id FROM profiles WHERE email='${testEmail}'`,
      true,
    );
    testId = rows[0]?.id;
  }
  if (testId) {
    await sql(
      `BEGIN; DELETE FROM audit_events WHERE actor_id='${testId}' OR entity_id='${testId}'; DELETE FROM profiles WHERE id='${testId}' AND email='${testEmail}'; COMMIT;`,
    );
    await authAdmin(`users/${testId}`, "DELETE");
  }
}
