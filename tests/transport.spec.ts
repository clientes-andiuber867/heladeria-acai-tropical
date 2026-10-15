import { test, expect } from "@playwright/test";

test("native empty responses work for every void mutation service", async ({
  page,
}) => {
  await page.goto("/");
  const calls: string[] = [];
  // Intercept writes before dispatch: this regression never changes business data.
  await page.route("**/rest/v1/rpc/**", async (route) => {
    calls.push(new URL(route.request().url()).pathname.split("/").pop()!);
    await route.fulfill({ status: 204 });
  });
  const result = await page.evaluate(async () => {
    const catalog = await import("/src/services/catalog.ts");
    const inventory = await import("/src/services/inventory.ts");
    const sales = await import("/src/services/sales.ts");
    const team = await import("/src/services/team.ts");
    const payments = await import("/src/services/payments.ts");
    const { supabase } = await import("/src/lib/supabase.ts");
    const id = "00000000-0000-4000-8000-000000000001";
    await catalog.setProductState(id, { available: false });
    await catalog.deleteProduct(id);
    await catalog.deleteCategory("Prueba", "General");
    await inventory.saveInventoryGroup("Prueba");
    await inventory.deleteInventoryGroup("Prueba", "General");
    await inventory.moveInventory(crypto.randomUUID(), id, "in", 1, "Prueba");
    await inventory.deleteInventoryItem(id);
    await sales.voidSale(id, "Prueba");
    await team.updateMember(id, "Prueba", "cashier", true, id);
    await payments.savePaymentQR(null, "Prueba", "test.png");
    for (const [name, args] of [
      ["update_branch", { p_id: id, p_name: "Prueba", p_phone: "59170000000" }],
      ["record_sign_in", {}],
      ["finish_password_setup", {}],
    ] as const) {
      const { error } = await supabase.rpc(name, args);
      if (error) throw error;
    }
    return "ok";
  });
  expect(result).toBe("ok");
  expect(calls).toHaveLength(13);
});

test("transport preserves empty, JSON, HEAD and error responses in a browser", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/qa-response/**", async (route) => {
    const status = Number(
      new URL(route.request().url()).pathname.split("/").pop(),
    );
    await route.fulfill({
      status,
      ...(route.request().method() === "HEAD"
        ? {}
        : status === 200
          ? { json: { ok: true } }
          : status === 400
            ? { json: { message: "Validación" } }
            : {}),
    });
  });
  const results = await page.evaluate(async () => {
    const { createReadTransport } = await import("/src/lib/requestSharing.ts");
    const send = createReadTransport(fetch),
      results = [];
    for (const status of [204, 205, 304, 200, 400]) {
      const r = await send(location.origin + "/qa-response/" + status, {
        method: "POST",
      });
      results.push({ status: r.status, text: await r.text() });
    }
    const head = await send(location.origin + "/qa-response/200", {
      method: "HEAD",
    });
    results.push({ status: head.status, text: await head.text() });
    return results;
  });
  expect(results).toEqual([
    { status: 204, text: "" },
    { status: 205, text: "" },
    { status: 304, text: "" },
    { status: 200, text: '{"ok":true}' },
    { status: 400, text: '{"message":"Validación"}' },
    { status: 200, text: "" },
  ]);
});
