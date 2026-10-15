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
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log(`PASS ${label}`);
}
const run = (user, branch, query, params) =>
  asUser(db, user, branch, query, params);
const scalar = async (user, branch, query, params) =>
  Object.values((await run(user, branch, query, params)).rows[0])[0];
try {
  await seedUsers(db);
  check(
    await scalar(
      ADMIN,
      B1,
      "SELECT pg_has_role('acai_branch_executor','authenticated','USAGE')",
    ),
    "rol de operaciones hereda permisos de Auth",
  );
  for (const branch of [B1, B2]) {
    await run(ADMIN, branch, "INSERT INTO categories(name) VALUES('Prueba')");
    await run(
      ADMIN,
      branch,
      "INSERT INTO products(name,category,price) VALUES($1,'Prueba',$2)",
      [branch === B1 ? "Bowl uno" : "Bowl dos", branch === B1 ? 25 : 40],
    );
  }
  const p1 = await scalar(
    ADMIN,
    B1,
    "SELECT id FROM products WHERE name='Bowl uno'",
  );
  const p2 = await scalar(
    ADMIN,
    B2,
    "SELECT id FROM products WHERE name='Bowl dos'",
  );
  check(
    (await scalar(ADMIN, B1, "SELECT count(*)::int FROM products")) === 1,
    "admin: catálogo 1 aislado",
  );
  check(
    (await scalar(ADMIN, B2, "SELECT count(*)::int FROM products")) === 1,
    "admin: catálogo 2 aislado",
  );
  check(
    (await scalar(null, B2, "SELECT name FROM products")) === "Bowl dos",
    "carta pública de sucursal 2",
  );
  check(
    (await scalar(CASHIER, B2, "SELECT count(*)::int FROM products")) === 0,
    "cajero no puede falsificar sucursal",
  );
  check(
    (await scalar(CASHIER, B1, "SELECT count(*)::int FROM products")) === 1,
    "cajero ve su catálogo",
  );
  await assert.rejects(
    run(CASHIER, B2, "SELECT toggle_product_availability($1,false)", [p2]),
  );
  checks++;
  await assert.rejects(
    run(ADMIN, B1, "SELECT toggle_product_availability($1,false)", [p2]),
  );
  checks++;
  await assert.rejects(
    run(CASHIER, B1, "SELECT update_branch($1,$2,$3)", [
      B1,
      "Cambio",
      "59170000000",
    ]),
  );
  checks++;
  await run(ADMIN, B1, "SELECT update_branch($1,$2,$3)", [
    B2,
    "Sucursal Centro",
    "59170000000",
  ]);
  check(
    (await scalar(ADMIN, B1, "SELECT name FROM branches WHERE id=$1", [B2])) ===
      "Sucursal Centro",
    "nombres editables sin cambiar identidad",
  );
  const shift1 = await scalar(ADMIN, B1, "SELECT open_cash_shift(0)");
  await scalar(ADMIN, B2, "SELECT open_cash_shift(0)");
  await assert.rejects(
    run(ADMIN, B2, "SELECT cash_shift_balance($1)", [shift1]),
  );
  checks++;
  const req = "20000000-0000-4000-8000-000000000001";
  const items = JSON.stringify([{ id: p1, qty: 1, expected_price: 25 }]);
  const sale = await scalar(
    ADMIN,
    B1,
    "SELECT complete_sale($1,$2::jsonb,'Efectivo',25,'')",
    [req, items],
  );
  check(
    (await scalar(
      ADMIN,
      B1,
      "SELECT complete_sale($1,$2::jsonb,'Efectivo',25,'')",
      [req, items],
    )) === sale,
    "reintento no duplica venta",
  );
  await assert.rejects(
    run(
      ADMIN,
      B2,
      "SELECT complete_sale(gen_random_uuid(),$1::jsonb,'Efectivo',25,'')",
      [items],
    ),
  );
  checks++;
  await assert.rejects(
    run(
      ADMIN,
      B1,
      "SELECT complete_sale(gen_random_uuid(),$1::jsonb,'Efectivo',65,'')",
      [
        JSON.stringify([
          { id: p1, qty: 1, expected_price: 25 },
          { id: p2, qty: 1, expected_price: 40 },
        ]),
      ],
    ),
  );
  checks++;
  check(
    (await scalar(ADMIN, B1, "SELECT count(*)::int FROM sales")) === 1,
    "venta con productos mezclados se revierte completa",
  );
  check(
    (await scalar(ADMIN, B2, "SELECT count(*)::int FROM sales")) === 0,
    "historial vacío en sucursal 2",
  );
  check(
    (await scalar(ADMIN, B2, "SELECT count(*)::int FROM sale_items")) === 0,
    "detalle de ventas aislado",
  );
  check(
    (
      await scalar(
        ADMIN,
        B1,
        "SELECT dashboard_summary(current_date,current_date)",
      )
    ).revenue === 25,
    "resumen conserva ingresos 1",
  );
  check(
    (
      await scalar(
        ADMIN,
        B2,
        "SELECT dashboard_summary(current_date,current_date)",
      )
    ).revenue === 0,
    "resumen no mezcla ingresos",
  );
  await assert.rejects(
    run(ADMIN, B2, "SELECT void_sale($1,$2)", [sale, "Prueba aislamiento"]),
  );
  checks++;
  await run(CASHIER, B1, "SELECT open_cash_shift(0)");
  await assert.rejects(
    run(ADMIN, B1, "SELECT update_team_member($1,'Cajera','cashier',true,$2)", [
      CASHIER,
      B2,
    ]),
    /Cierra la caja/,
  );
  checks++;
  const cashierShift = await scalar(
    CASHIER,
    B1,
    "SELECT id FROM cash_shifts WHERE status='open'",
  );
  await run(CASHIER, B1, "SELECT close_cash_shift($1,0,'')", [cashierShift]);
  await run(
    ADMIN,
    B1,
    "SELECT update_team_member($1,'Cajera','cashier',true,$2)",
    [CASHIER, B2],
  );
  check(
    (await scalar(CASHIER, B1, "SELECT count(*)::int FROM products")) === 0,
    "reasignación bloquea sucursal anterior inmediatamente",
  );
  check(
    (await scalar(CASHIER, B2, "SELECT name FROM products")) === "Bowl dos",
    "reasignación permite nueva sucursal",
  );
  for (const branch of [B1, B2])
    await run(ADMIN, branch, "SELECT inventory_group_save('Insumos')");
  const inventory = await scalar(ADMIN, B1, "SELECT inventory_save(null,$1)", [
    JSON.stringify({
      name: "Vasos",
      category: "Insumos",
      unit: "unidad",
      quantity: 10,
      minimum: 2,
    }),
  ]);
  check(
    (await scalar(ADMIN, B2, "SELECT inventory_snapshot()")).length === 0,
    "inventario aislado",
  );
  await assert.rejects(
    run(ADMIN, B2, "SELECT inventory_delete($1)", [inventory]),
  );
  checks++;
  await db.exec(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('payment-qr','qr1.png'),('payment-qr','qr2.png')",
  );
  for (const [b, name] of [
    [B1, "qr1.png"],
    [B2, "qr2.png"],
  ])
    await run(ADMIN, b, "SELECT configure_payment_qr($1,$2)", [name, name]);
  check(
    (await scalar(null, B1, "SELECT public_payment_qr()")).qr_path ===
      "qr1.png",
    "QR público 1 separado",
  );
  check(
    (await scalar(null, B2, "SELECT public_payment_qr()")).qr_path ===
      "qr2.png",
    "QR público 2 separado",
  );
  await run(
    ADMIN,
    B1,
    "SELECT configure_payment_qr('qr1.png','Nuevo titular')",
  );
  check(
    (await scalar(null, B2, "SELECT public_payment_qr()")).recipient ===
      "qr2.png",
    "editar QR 1 conserva QR 2",
  );
  check(
    (
      await run(
        ADMIN,
        B2,
        "SELECT * FROM search_audit(current_date,current_date,'Venta registrada',0,'all')",
      )
    ).rows.length === 0,
    "auditoría aislada",
  );
  await assert.rejects(
    run(CASHIER, B2, "SELECT dashboard_summary(current_date,current_date)"),
  );
  checks++;
  await assert.rejects(run(null, B2, "SELECT * FROM sales"));
  checks++;
  await assert.rejects(
    run(CASHIER, B2, "SELECT configure_payment_qr('qr2.png','Otro titular')"),
  );
  checks++;
  await run(ADMIN, B1, "SELECT delete_category('Prueba','Helados')");
  check(
    (await scalar(
      ADMIN,
      B2,
      "SELECT count(*)::int FROM categories WHERE name='Prueba'",
    )) === 1,
    "editar secciones no modifica la otra sucursal",
  );
  await run(
    ADMIN,
    B2,
    "SELECT update_team_member($1,'Cajera','cashier',false,$2)",
    [CASHIER, B2],
  );
  check(
    (await scalar(CASHIER, B2, "SELECT count(*)::int FROM products")) === 0,
    "cuenta desactivada pierde acceso",
  );
  await assert.rejects(run(CASHIER, B2, "SELECT open_cash_shift(0)"));
  checks++;
  console.log(`${checks} comprobaciones SQL superadas.`);
} finally {
  await db.close();
}
