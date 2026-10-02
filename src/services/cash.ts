import { supabase } from "../lib/supabase";
export type CashShift = {
  id: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  cash_sales: number;
  qr_sales: number;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  closing_note: string;
  status: "open" | "closed";
  orders?: number;
};
export async function currentShift(userId: string): Promise<CashShift | null> {
  const { data, error } = await supabase
    .from("cash_shifts")
    .select("id")
    .eq("cashier_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const result = await supabase.rpc("cash_shift_balance", { p_id: data.id });
  if (result.error) throw result.error;
  return result.data;
}
export async function openShift(amount: number) {
  const { error } = await supabase.rpc("open_cash_shift", {
    p_opening: amount,
  });
  if (error) throw error;
}
export async function closeShift(
  id: string,
  amount: number,
  note: string,
): Promise<CashShift> {
  const { data, error } = await supabase.rpc("close_cash_shift", {
    p_id: id,
    p_counted: amount,
    p_note: note,
  });
  if (error) throw error;
  return data;
}
export async function recentShifts() {
  const { data, error } = await supabase
    .from("cash_shifts")
    .select("*,profiles!cashier_id(display_name)")
    .order("opened_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as (CashShift & { profiles: { display_name: string } })[];
}
