import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:5173/menu");
  await expect(page.locator(".product").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Agregar / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver mi pedido/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Hacer pedido", exact: true }).click();
  const add = page
    .getByRole("button", { name: /^Agregar / })
    .filter({ visible: true });
  await expect(add.first()).toBeVisible();
  const enabled = page.locator("button.add:not(:disabled)").first();
  const name = (await enabled.getAttribute("aria-label")).replace(
    "Agregar ",
    "",
  );
  await enabled.click();
  await enabled.click();
  await page
    .getByRole("button", { name: "Solo ver la carta", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Agregar / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver mi pedido/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Hacer pedido", exact: true }).click();
  await page.getByRole("button", { name: /Ver mi pedido/ }).click();
  await expect(
    page.getByLabel(`Cantidad de ${name}`, { exact: true }),
  ).toHaveText("2");
  await page
    .getByLabel(`Añadir una unidad de ${name}`, { exact: true })
    .click();
  await expect(
    page.getByLabel(`Cantidad de ${name}`, { exact: true }),
  ).toHaveText("3");
  await page
    .getByLabel(`Quitar una unidad de ${name}`, { exact: true })
    .click();
  await page.waitForFunction(() => {
    const img = document.querySelector(".order-qr-preview img");
    return img?.complete && img.naturalWidth > 0;
  });
  await page.getByLabel("Tu nombre (opcional)").fill("Cliente de prueba");
  await page.getByLabel("Indicaciones (opcional)").fill("Sin granola");
  await page.screenshot({
    path: path.join(process.env.TEMP, "acai-public-order-desktop.png"),
  });
  await page.getByRole("button", { name: "Ampliar QR de pago" }).click();
  await expect(
    page.getByAltText("QR oficial ampliado para pagar"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al pedido", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar QR", exact: true }).click();
  assert.match((await download).suggestedFilename(), /Acai-Tropical-QR/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(process.env.TEMP, "acai-public-order-mobile.png"),
  });
  assert.equal(
    await page
      .locator("dialog")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
    "Dialog must not overflow",
  );
  let target = "";
  await page.route("https://web.whatsapp.com/**", async (route) => {
    target = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "WhatsApp navigation intercepted; no message sent.",
    });
  });
  await page
    .getByRole("button", { name: "Pedir por WhatsApp", exact: true })
    .click();
  await expect.poll(() => target).not.toBe("");
  const url = new URL(target),
    message = url.searchParams.get("text");
  assert.equal(url.searchParams.get("phone"), "59171661241");
  for (const symbol of [
    "\u{1F44B}",
    "\u{1F464}",
    "\u{1F4CB}",
    "\u{1F4B0}",
    "\u{1F4CD}",
    "\u{1F9FE}",
  ])
    assert.ok(message.includes(symbol), "Header emoji preserved");
  assert.ok(
    !message.includes("\uFFFD"),
    "No replacement characters in WhatsApp message",
  );
  for (const text of [
    name,
    "Cantidad: 2",
    "TOTAL A PAGAR",
    "Sin granola",
    "Cliente de prueba",
    "comprobante",
    "*AÇAÍ TROPICAL*",
    "PEDIDO POR WHATSAPP",
  ])
    assert.ok(message.includes(text), text);
  await page.goto("http://localhost:5173/menu");
  await expect(page.getByRole("button", { name: /Ver mi pedido/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Hacer pedido", exact: true }).click();
  await page.getByRole("button", { name: /Ver mi pedido/ }).click();
  await expect(
    page.getByLabel(`Cantidad de ${name}`, { exact: true }),
  ).toHaveText("2");
  await page.getByLabel(`Quitar ${name} del pedido`, { exact: true }).click();
  await expect(page.getByText("Tu próximo antojo te espera")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: live public catalog, quantities, official QR, QR download, desktop/mobile, WhatsApp message and destination (intercepted), cart persistence and removal. No orders created or messages sent.",
  );
} finally {
  await browser.close();
}
