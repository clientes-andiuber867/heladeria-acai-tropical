import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const fixturePath = path.join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "acai-live-tests.json",
);
const f = fs.existsSync(fixturePath)
  ? JSON.parse(fs.readFileSync(fixturePath, "utf8"))
  : null;
test("public login and menu use the business logo, with no demo access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Demo/ })).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/logo.png?v=tropical2",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.screenshot({
      path: `test-results/live-login-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.goto("/menu");
    await expect(
      page.getByRole("heading", { name: "¿Qué se te antoja hoy?" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/live-menu-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
test.describe("live Supabase acceptance", () => {
  test.skip(
    !f,
    "Run the provisioning script to create isolated QA accounts first.",
  );
  test("admin edits, uploads, sells and audits; independent client sees shared changes", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.getByLabel("Correo electrónico").fill(f.users.admin.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(f.users.admin.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Un vistazo a tu día" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Mis productos", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Editar ${f.tag} Bowl`, exact: true })
      .click();
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Actualizado desde el panel y compartido en Supabase");
    await page.locator('input[type="file"]').setInputFiles("public/logo.png");
    await page
      .getByRole("button", { name: "Guardar producto", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const publicContext = await browser.newContext();
    const menu = await publicContext.newPage();
    await menu.goto("/menu");
    await expect(
      menu.locator("article").filter({ hasText: f.tag + " Bowl" }),
    ).toContainText("Actualizado desde el panel");
    await publicContext.close();
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Agregar ${f.tag} Bowl`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar venta", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("debe cubrir");
    await page.getByLabel("Efectivo recibido").fill("50");
    await page
      .getByRole("button", { name: "Confirmar venta", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Venta registrada");
    await expect(page.getByRole("dialog")).toContainText("25,00");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Auditoría", exact: true }).click();
    await page.getByLabel("Buscar auditoría").fill(f.tag);
    await expect(page.locator("tbody")).toContainText("Venta registrada");
    await page.getByRole("button", { name: "Carta y QR", exact: true }).click();
    await expect(page.locator(".qr-image")).toBeVisible();
    await page.getByRole("button", { name: "Resumen", exact: true }).click();
    await page.screenshot({
      path: "test-results/live-dashboard-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: "test-results/live-dashboard-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
  test("cashier logs in, records QR and only sees their own workspace", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Correo electrónico").fill(f.users.cashier.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(f.users.cashier.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Vamos a servir felicidad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mis productos", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Auditoría", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: `Agregar ${f.tag} Bowl`, exact: true })
      .click();
    await page.getByRole("button", { name: "QR", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirmar venta", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Verifica el pago");
    await page.getByLabel("Verifiqué el pago").check();
    await page
      .getByRole("button", { name: "Confirmar venta", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("QR");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("button", { name: "Historial de ventas", exact: true })
      .click();
    await expect(page.locator("tbody")).toContainText("QR");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Cerrar sesión", exact: true }),
    ).toBeVisible();
  });
  test("admin creates a real cashier account with forced password change", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("Correo electrónico").fill(f.users.admin.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(f.users.admin.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await page.getByRole("button", { name: "Mi equipo", exact: true }).click();
    await page
      .getByRole("button", { name: "Agregar usuario", exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill(f.tag + " browser");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill(f.tag.toLowerCase() + "-browser@example.com");
    await page
      .getByLabel("Contraseña temporal", { exact: true })
      .fill(f.users.cashier.password);
    await page
      .getByRole("button", { name: "Guardar usuario", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.locator(".member-card").filter({ hasText: f.tag + " browser" }),
    ).toContainText("Cajero");
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await page
      .getByLabel("Correo electrónico")
      .fill(f.tag.toLowerCase() + "-browser@example.com");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(f.users.cashier.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu cuenta, tu contraseña." }),
    ).toBeVisible();
  });
});
