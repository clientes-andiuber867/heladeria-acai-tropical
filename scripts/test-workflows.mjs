import assert from "node:assert/strict";
import {
  createTestDatabase,
  seedUsers,
  asUser,
  B1,
  B2,
  ADMIN,
  CASHIER,
} from "./branch-test-db.mjs";
const db = await createTestDatabase();
let checks = 0;
const run = (b, q, p = []) => asUser(db, ADMIN, b, q, p);
const value = async (b, q, p = []) =>
  Object.values((await run(b, q, p)).rows[0])[0];
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks++;
  console.log("PASS " + label);
};
try {
  await seedUsers(db);
  await db.exec(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('payment-qr','test.png')",
  );
  for (const branch of [B1, B2]) {
    await run(
      branch,
      "SELECT update_branch($1,'Sucursal Agrícola','59171661241')",
      [branch],
    );
    equal(
      await value(branch, "SELECT name FROM branches WHERE id=$1", [branch]),
      "Sucursal Agrícola",
      "nombre con acento",
    );
    await run(
      branch,
      "INSERT INTO categories(name) VALUES('Prueba'),('Destino')",
    );
    const product = await value(
      branch,
      "INSERT INTO products(name,category,price) VALUES('Bowl','Prueba',25) RETURNING id",
    );
    await run(
      branch,
      "UPDATE products SET description='Actualizado' WHERE id=$1",
      [product],
    );
    await run(branch, "SELECT toggle_product_availability($1,false)", [
      product,
    ]);
    equal(
      await value(branch, "SELECT available FROM products WHERE id=$1", [
        product,
      ]),
      false,
      "disponibilidad de producto",
    );
    await run(branch, "SELECT toggle_product_availability($1,true)", [product]);
    await run(branch, "SELECT configure_payment_qr('test.png','Titular')");
    const version = await value(branch, "SELECT version FROM payment_settings");
    const shift = await value(branch, "SELECT open_cash_shift(10)");
    const items = JSON.stringify([{ id: product, qty: 1, expected_price: 25 }]);
    const sales = [];
    for (const [method, cash, qr] of [
      ["Efectivo", 25, 0],
      ["QR", 0, 25],
      ["Mixto", 10, 15],
    ]) {
      const id = await value(
        branch,
        "SELECT complete_sale(gen_random_uuid(),$1::jsonb,$2,$3,'Prueba',$4,$5,$6)",
        [items, method, cash || null, cash, qr, version],
      );
      sales.push(id);
      equal(
        await value(branch, "SELECT total FROM sales WHERE id=$1", [id]),
        "25.00",
        "venta " + method,
      );
    }
    const balance = await value(branch, "SELECT cash_shift_balance($1)", [
      shift,
    ]);
    equal(
      [balance.cash_sales, balance.qr_sales, balance.expected_cash],
      [35, 40, 45],
      "saldo de caja mixto",
    );
    await run(branch, "SELECT void_sale($1,'Anulación de prueba')", [sales[0]]);
    equal(
      await value(branch, "SELECT status FROM sales WHERE id=$1", [sales[0]]),
      "voided",
      "anulación de venta",
    );
    const closed = await value(branch, "SELECT close_cash_shift($1,20,'')", [
      shift,
    ]);
    equal(closed.difference, 0, "cierre de caja");
    const totals = await value(
      branch,
      "SELECT sales_collection_totals(current_date,current_date,'','')",
    );
    assert(totals);
    checks++;
    assert(
      await value(
        branch,
        "SELECT product_sales_ranking(current_date,current_date)",
      ),
    );
    checks++;
    equal(
      (
        await value(
          branch,
          "SELECT dashboard_summary(current_date,current_date)",
        )
      ).revenue,
      50,
      "resumen excluye anuladas",
    );
    await run(branch, "UPDATE products SET archived=true WHERE id=$1", [
      product,
    ]);
    equal(
      await value(branch, "SELECT archived FROM products WHERE id=$1", [
        product,
      ]),
      true,
      "archivar producto",
    );
    await run(branch, "SELECT delete_product($1)", [product]);
    equal(
      await value(
        branch,
        "SELECT count(*)::int FROM sale_items WHERE product_id=$1",
        [product],
      ),
      3,
      "eliminar conserva historial",
    );
    await run(branch, "SELECT delete_category('Prueba','Destino')");
    await run(branch, "SELECT inventory_group_save('Insumos')");
    const item = await value(branch, "SELECT inventory_save(null,$1::jsonb)", [
      JSON.stringify({
        name: "Vasos",
        category: "Insumos",
        unit: "unidad",
        quantity: 10,
        minimum: 2,
      }),
    ]);
    for (const [kind, quantity, expected] of [
      ["in", 5, 15],
      ["out", 3, 12],
      ["count", 9, 9],
    ]) {
      await run(
        branch,
        "SELECT inventory_move(gen_random_uuid(),$1,$2,$3,'Verificación')",
        [item, kind, quantity],
      );
      equal(
        Number(
          await value(
            branch,
            "SELECT quantity FROM inventory_items WHERE id=$1",
            [item],
          ),
        ),
        expected,
        "inventario " + kind,
      );
    }
    await run(branch, "SELECT inventory_group_save('Envases','Insumos')");
    equal(
      await value(branch, "SELECT category FROM inventory_items WHERE id=$1", [
        item,
      ]),
      "Envases",
      "renombrar grupo",
    );
    await run(branch, "SELECT inventory_group_save('Destino')");
    await run(branch, "SELECT inventory_group_delete('Envases','Destino')");
    equal(
      await value(branch, "SELECT category FROM inventory_items WHERE id=$1", [
        item,
      ]),
      "Destino",
      "reubicar grupo",
    );
    await run(branch, "SELECT inventory_delete($1)", [item]);
    equal(
      await value(
        branch,
        "SELECT count(*)::int FROM inventory_items WHERE id=$1",
        [item],
      ),
      0,
      "eliminar inventario",
    );
    assert(
      (
        await run(
          branch,
          "SELECT * FROM search_audit(current_date,current_date,'',0,'all')",
        )
      ).rows.length > 0,
    );
    checks++;
    await run(branch, "SELECT record_sign_in()");
    await run(branch, "SELECT finish_password_setup()");
  }
  await run(
    B1,
    "SELECT update_team_member($1,'Cajera editada','cashier',false,$2)",
    [CASHIER, B2],
  );
  equal(
    await value(B1, "SELECT active FROM profiles WHERE id=$1", [CASHIER]),
    false,
    "desactivar personal",
  );
  await run(
    B1,
    "SELECT update_team_member($1,'Cajera editada','cashier',true,$2)",
    [CASHIER, B1],
  );
  equal(
    await value(B1, "SELECT branch_id FROM profiles WHERE id=$1", [CASHIER]),
    B1,
    "reactivar y asignar personal",
  );
  console.log(
    `${checks} comprobaciones funcionales superadas en una base aislada.`,
  );
} finally {
  await db.close();
}
