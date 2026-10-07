import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authAdmin, sql } from './admin-session.mjs';
const suffix = randomUUID().slice(0, 8);
const password = `QA-${randomUUID()}!`;
const users = [];
const name = `QA vasos ${suffix}`;
const group = `QA envases ${suffix}`;
const renamedGroup = `QA materiales ${suffix}`;
const destinationGroup = `QA almacen ${suffix}`;
const browser = await chromium.launch();
try {
  for (const role of ['admin', 'cashier']) {
    const user = await authAdmin('users', 'POST', {
      email: `inventory-${role}-${suffix}@example.com`, password, email_confirm: true,
      app_metadata: { role }, user_metadata: { display_name: `QA inventario ${role}` },
    });
    users.push(user);
    await sql(`UPDATE public.profiles SET must_change_password=false,active=true,role='${role}' WHERE id='${user.id}'`);
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  async function login(user) {
    await page.goto('http://localhost:5173/');
    await page.getByLabel('Correo electrónico').fill(user.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.locator('.sidebar')).toBeVisible();
  }
  await login(users[0]);
  await page.getByRole('button', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo artículo', exact: true }).click();
  await page.getByLabel('Nombre del artículo').fill(name);
  await page.getByRole('button', { name: 'Crear un nuevo grupo' }).click();
  await page.getByLabel('Nombre del nuevo grupo').fill(group);
  await page.getByRole('button', { name: 'Crear y seleccionar' }).click();
  await expect(page.getByRole('combobox', { name: 'Grupo', exact: true })).toHaveValue(group);
  await page.getByLabel('Cantidad inicial').fill('120');
  await page.getByLabel('Cantidad inicial').fill('');
  await expect(page.getByLabel('Cantidad inicial')).toHaveValue('');
  await page.getByLabel('Cantidad inicial').fill('119');
  await page.getByLabel('Cantidad inicial').press('ArrowUp');
  await expect(page.getByLabel('Cantidad inicial')).toHaveValue('120');
  await page.getByLabel('Avisar al llegar a').fill('30');
  await page.getByLabel('Avisar al llegar a').fill('');
  await expect(page.getByLabel('Avisar al llegar a')).toHaveValue('');
  await page.getByLabel('Avisar al llegar a').fill('31');
  await page.getByLabel('Avisar al llegar a').press('ArrowDown');
  await expect(page.getByLabel('Avisar al llegar a')).toHaveValue('30');
  // Save with location and observations empty: both are optional.
  await page.getByRole('button', { name: 'Guardar artículo', exact: true }).click();
  const row = page.locator('.inventory-table tbody tr').filter({ hasText: name });
  await expect(row).toContainText('120');
  await row.getByRole('button', { name: 'Movimiento', exact: true }).click();
  await page.getByLabel('Tipo de movimiento').selectOption('out');
  await page.getByLabel(/Cantidad del movimiento/).fill('100');
  await page.getByLabel('Motivo u observación').fill('Consumo de prueba');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(row).toContainText('Por reponer');
  await expect(row.locator('.inventory-quantity')).toHaveText('20');
  await row.getByRole('button', { name: 'Movimiento', exact: true }).click();
  await page.getByLabel('Tipo de movimiento').selectOption('count');
  await page.getByLabel(/Cantidad total que contaste/).fill('15');
  await page.getByLabel('Motivo u observación').fill('Conteo de cierre de mes');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(row.locator('.inventory-quantity')).toHaveText('15');
  await page.getByRole('button', { name: 'Gestionar grupos', exact: true }).click();
  await page.getByRole('button', { name: `Editar grupo ${group}`, exact: true }).click();
  await page.getByLabel('Nombre del grupo', { exact: true }).fill(renamedGroup);
  await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click();
  await expect(page.getByRole('button', { name: `Editar grupo ${renamedGroup}`, exact: true })).toBeVisible();
  await page.getByLabel('Nuevo grupo', { exact: true }).fill(destinationGroup);
  await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
  await expect(page.getByRole('button', { name: `Editar grupo ${destinationGroup}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Eliminar grupo ${renamedGroup}`, exact: true }).click();
  await page.getByLabel('Trasladar artículos a').selectOption(destinationGroup);
  await page.getByRole('button', { name: 'Eliminar grupo', exact: true }).click();
  await expect(page.getByRole('button', { name: `Editar grupo ${renamedGroup}`, exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/inventory-groups.png' });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(row).toContainText(destinationGroup);
  await expect(row.locator('.inventory-quantity')).toHaveText('15');
  await page.screenshot({ path: 'test-results/inventory-desktop.png', fullPage: true });
  await row.getByRole('button', { name: `Historial de ${name}` }).click();
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.inventory-table')).toContainText('Conteo de cierre de mes');
  await page.screenshot({ path: 'test-results/inventory-movements.png', fullPage: true });
  await page.getByRole('button', { name: 'Existencias', exact: true }).click();
  await row.getByRole('button', { name: `Eliminar ${name}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Eliminar artículo', exact: true })).toContainText(name);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: `Eliminar ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar artículo', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click();
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.inventory-table')).toContainText(name);
  await page.getByRole('button', { name: 'Existencias', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Nuevo artículo', exact: true }).click();
  await page.screenshot({ path: 'test-results/inventory-mobile-form.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await login(users[1]);
  await expect(page.getByRole('button', { name: 'Inventario', exact: true })).toHaveCount(0);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: real admin create, output, physical count, movement history, mobile layout and cashier navigation.');
} finally {
  await browser.close();
  for (const user of users) {
    await sql(`DELETE FROM public.inventory_movements WHERE actor_id='${user.id}';
      DELETE FROM public.inventory_items WHERE name='${name}';
      DELETE FROM public.inventory_groups WHERE name IN ('${group}','${renamedGroup}','${destinationGroup}');
      DELETE FROM public.audit_events WHERE actor_id='${user.id}';
      DELETE FROM public.profiles WHERE id='${user.id}';`);
    await authAdmin(`users/${user.id}`, 'DELETE');
  }
}

