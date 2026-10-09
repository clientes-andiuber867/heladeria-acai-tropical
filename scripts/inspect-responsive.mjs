import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
const env = loadEnv("development", ".", "");
const url = env.VITE_SUPABASE_URL,
  secret = env.SUPABASE_SERVICE_ROLE_KEY;
import fs from "node:fs";
const svc = createClient(url, secret, { auth: { persistSession: false } }),
  b = await chromium.launch();
const p = await b.newPage();
const results = [];
let user;
async function check(label) {
  for (const width of [320, 390, 768, 1024]) {
    await p.setViewportSize({ width, height: 900 });
    await p.waitForTimeout(350);
    const bad = await p.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width &&
            r.height &&
            (r.right > innerWidth + 2 || r.left < -2) &&
            getComputedStyle(e).position !== "fixed" &&
            !e.closest(".sidebar,.categories,.table-wrap,.flavor-strip")
          );
        })
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          w: Math.round(e.getBoundingClientRect().width),
        }))
        .slice(0, 12),
    );
    results.push({ label, width, bad });
    if (width === 390 || width === 768)
      await p.screenshot({
        path: process.env.TEMP + "/responsive-" + label + "-" + width + ".png",
      });
  }
}
try {
  await p.goto("http://localhost:5173/menu");
  await p.locator(".product").first().waitFor();
  await check("menu");
  await p.goto("http://localhost:5173");
  await check("login");
  const password = "QA!" + crypto.randomUUID();
  const r = await svc.auth.admin.createUser({
    email: "responsive-" + crypto.randomUUID() + "@example.com",
    password,
    email_confirm: true,
  });
  if (r.error) throw r.error;
  user = r.data.user;
  await svc
    .from("profiles")
    .update({ role: "admin", active: true, must_change_password: false })
    .eq("id", user.id);
  await p.getByLabel("Correo electrónico").fill(user.email);
  await p.getByLabel("Contraseña", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await p.locator(".app-shell").waitFor();
  await p.waitForTimeout(1800);
  for (const name of [
    "Resumen",
    "Punto de venta",
    "Historial de ventas",
    "Mis productos",
    "Carta y QR",
    "Inventario",
    "Auditoría",
    "Usuarios y roles",
    "Configurar pagos",
  ]) {
    await p.setViewportSize({ width: 1280, height: 900 });
    await p
      .locator(".sidebar nav")
      .getByRole("button", { name, exact: true })
      .click();
    await p.waitForTimeout(400);
    await check(name.replaceAll(" ", "-"));
    const action = {
      "Mis productos": "Agregar producto",
      Inventario: "Nuevo artículo",
      "Usuarios y roles": "Agregar usuario",
    }[name];
    if (action) {
      await p.getByRole("button", { name: action, exact: true }).click();
      await check("form-" + name.replaceAll(" ", "-"));
      await p.getByRole("button", { name: "Cerrar", exact: true }).click();
    }
    if (name === "Inventario") {
      await p.locator(".inventory-table").first().scrollIntoViewIfNeeded();
      await p.setViewportSize({ width: 390, height: 900 });
      await p.waitForTimeout(350);
      await p
        .locator(".inventory-table")
        .first()
        .screenshot({
          path: process.env.TEMP + "/responsive-inventory-card.png",
        });
    }
  }
  fs.writeFileSync(
    process.env.TEMP + "/responsive-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      results.filter((r) => r.bad.length),
      null,
      2,
    ),
  );
} finally {
  await b.close();
  if (user) {
    await svc.from("audit_events").delete().eq("actor_id", user.id);
    await svc.from("profiles").delete().eq("id", user.id);
    await svc.auth.admin.deleteUser(user.id);
  }
}
