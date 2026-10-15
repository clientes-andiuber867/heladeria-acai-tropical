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

const { default: ExcelJS } = await import("exceljs");
const { default: assert } = await import("node:assert/strict");
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    origin +
      "/#" +
      new URLSearchParams({ ...login.session, type: "magiclink" }),
  );
  await expect(page.getByLabel("Sucursal activa")).toBeVisible();
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  const note = page.getByLabel("Nota / motivo del pedido");
  await note.fill("Verificación temporal de navegación");
  await page
    .getByRole("button", { name: "Historial de ventas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(note).toHaveValue("Verificación temporal de navegación");
  await note.fill("");
  await page
    .getByRole("button", { name: "Historial de ventas", exact: true })
    .click();
  const scope = page.locator("main>div:not([hidden])");
  await scope.getByLabel("Período").selectOption("custom");
  await scope.getByLabel("Desde", { exact: true }).fill("2026-01-01");
  await scope.getByLabel("Hasta", { exact: true }).fill("2026-12-31");
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => r.name.includes("exportWorkbook")),
    ),
    false,
  );
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar a Excel", exact: true })
    .click();
  const download = await pending;
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await download.path());
  const branch = await page.getByLabel("Sucursal activa").inputValue();
  const { data: sales, error } = await admin
    .from("sales")
    .select("*,sale_items(*)")
    .eq("branch_id", branch)
    .gte("created_at", "2026-01-01T00:00:00-04:00")
    .lte("created_at", "2026-12-31T23:59:59-04:00");
  if (error) throw error;
  assert.equal(book.worksheets.length, 3);
  assert.equal(book.getWorksheet("Ventas").rowCount - 7, sales.length);
  assert.equal(
    book.getWorksheet("Detalle de productos").rowCount - 7,
    sales.reduce((a, s) => a + s.sale_items.length, 0),
  );
  assert.equal(
    book.getWorksheet("Resumen").getCell("B11").result,
    Math.round(
      sales
        .filter((s) => s.status === "completed")
        .reduce((a, s) => a + s.total, 0) * 100,
    ) / 100,
  );
  assert.equal(book.getWorksheet("Resumen").getImages().length, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: formulario conservado al navegar; Excel bajo demanda, logo, ventas, detalle y totales de la sucursal coinciden con Supabase.",
  );
} finally {
  await browser.close();
  await client.auth.signOut({ scope: "local" });
}
