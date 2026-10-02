import { supabase } from "../lib/supabase";
import { dateBounds } from "../lib/format";
import type { Sale } from "../types";
export type SalesExportFilters = {
  from: string;
  to: string;
  method: string;
  status: string;
};

/** Keyset pagination avoids the API row cap and duplicates between pages. */
export async function getSalesForExport(
  filters: SalesExportFilters,
): Promise<Sale[]> {
  const { start, end } = dateBounds(filters.from, filters.to);
  const snapshot = new Date().toISOString();
  const sales: Sale[] = [];
  let last = 0;
  while (true) {
    let query = supabase
      .from("sales")
      .select("*,sale_items(*)")
      .gte("created_at", start)
      .lte("created_at", end)
      .lte("created_at", snapshot)
      .gt("order_number", last)
      .order("order_number")
      .limit(500);
    if (filters.method) query = query.eq("payment_method", filters.method);
    if (filters.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    sales.push(...(data as Sale[]));
    last = data[data.length - 1].order_number;
  }
  return sales;
}
