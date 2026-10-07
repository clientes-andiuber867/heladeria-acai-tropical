import { supabase } from "../lib/supabase";
import { dateBounds } from "../lib/format";
export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  note: string;
  quantity: number;
  minimum: number;
  created_at: string;
  updated_at: string;
};
export type InventoryInput = Pick<
  InventoryItem,
  "name" | "category" | "unit" | "location" | "note" | "quantity" | "minimum"
>;
export type InventoryMovement = {
  id: string;
  item_id: string;
  kind: "initial" | "in" | "out" | "count";
  quantity_before: number;
  quantity_after: number;
  delta: number;
  note: string;
  actor_name: string;
  created_at: string;
  inventory_items: { name: string; unit: string };
};
export const quantityLabel = (value: number) =>
  Number(value).toLocaleString("es-BO", { maximumFractionDigits: 3 });
export const movementLabels = {
  initial: "Inventario inicial",
  in: "Entrada",
  out: "Salida",
  count: "Conteo físico",
};
export async function getInventory(date = ""): Promise<InventoryItem[]> {
  const { data, error } = await supabase.rpc("inventory_snapshot", {
    p_date: date || null,
  });
  if (error) throw error;
  return data || [];
}
export async function getInventoryGroups(): Promise<string[]> {
  const { data, error } = await supabase
    .from("inventory_groups")
    .select("name")
    .order("name");
  if (error) throw error;
  return (data || []).map((g) => g.name);
}
export async function saveInventoryGroup(name: string, previous?: string) {
  const { error } = await supabase.rpc("inventory_group_save", {
    p_name: name.trim(),
    p_previous: previous ?? null,
  });
  if (error) throw error;
}
export async function deleteInventoryGroup(name: string, replacement: string) {
  const { error } = await supabase.rpc("inventory_group_delete", {
    p_name: name,
    p_replacement: replacement || null,
  });
  if (error) throw error;
}
export async function saveInventory(input: InventoryInput, id?: string) {
  const { error } = await supabase.rpc("inventory_save", {
    p_id: id || null,
    p_data: input,
  });
  if (error) throw error;
}
export async function moveInventory(
  request: string,
  item: string,
  kind: string,
  quantity: number,
  note: string,
) {
  const { error } = await supabase.rpc("inventory_move", {
    p_request: request,
    p_item: item,
    p_kind: kind,
    p_quantity: quantity,
    p_note: note,
  });
  if (error) throw error;
}
export async function getInventoryMovements(
  from: string,
  to: string,
  item: string,
  page: number,
) {
  const bounds = dateBounds(from, to);
  let query = supabase
    .from("inventory_movements")
    .select("*", { count: "exact" })
    .gte("created_at", bounds.start)
    .lte("created_at", bounds.end)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (item) query = query.eq("item_id", item);
  const { data, count, error } = await query.range(page * 25, page * 25 + 24);
  if (error) throw error;
  return {
    rows: (data || []).map((r) => ({
      ...r,
      inventory_items: { name: r.item_name, unit: r.item_unit },
    })) as InventoryMovement[],
    count: count || 0,
  };
}
export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.rpc("inventory_delete", { p_id: id });
  if (error) throw error;
}
