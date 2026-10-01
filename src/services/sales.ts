import { supabase } from "../lib/supabase";
import { dateBounds } from "../lib/format";
import type { CartItem, Sale, DashboardData } from "../types";
export async function completeSale(input: {
  requestId: string;
  items: CartItem[];
  method: "Efectivo" | "QR" | "Mixto";
  cashAmount?: number;
  qrAmount?: number;
  qrVersion?: string;
  cash: number | null;
  note: string;
}) {
  const { data, error } = await supabase.rpc("complete_sale", {
    p_request_id: input.requestId,
    p_items: input.items.map((i) => ({
      id: i.product.id,
      qty: i.quantity,
      expected_price: i.product.price,
    })),
    p_method: input.method,
    p_cash: input.cash,
    p_note: input.note,
    p_cash_amount: input.cashAmount ?? null,
    p_qr_amount: input.qrAmount ?? null,
    p_qr_version: input.qrVersion ?? null,
  });
  if (error) throw error;
  return getSale(data);
}
export async function getSale(id: string): Promise<Sale> {
  const { data, error } = await supabase
    .from("sales")
    .select("*,sale_items(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
export async function getSales(
  from: string,
  to: string,
  page = 0,
  method = "",
  status = "",
) {
  const { start, end } = dateBounds(from, to);
  let query = supabase
    .from("sales")
    .select("*,sale_items(*)", { count: "exact" })
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .range(page * 20, page * 20 + 19);
  if (method) query = query.eq("payment_method", method);
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data || []) as Sale[], count: count || 0 };
}
export async function voidSale(id: string, reason: string) {
  const { error } = await supabase.rpc("void_sale", {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw error;
}
export async function getDashboard(
  from: string,
  to: string,
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("dashboard_summary", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data;
}

export type CollectionTotals = {
  collected: number;
  cash: number;
  qr: number;
  voided: number;
};
export async function getCollectionTotals(
  from: string,
  to: string,
  method: string,
  status: string,
): Promise<CollectionTotals> {
  const { data, error } = await supabase.rpc("sales_collection_totals", {
    p_from: from,
    p_to: to,
    p_method: method,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export type RankedProduct = {
  id: string;
  name: string;
  quantity: number;
  total: number;
};
export async function getProductRanking(
  from: string,
  to: string,
): Promise<RankedProduct[]> {
  const { data, error } = await supabase.rpc("product_sales_ranking", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data || [];
}
