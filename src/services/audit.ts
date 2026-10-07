import { supabase } from "../lib/supabase";
import type { AuditEvent } from "../types";
export async function getAudit(
  from: string,
  to: string,
  search: string,
  page: number,
  scope = "all",
): Promise<AuditEvent[]> {
  const { data, error } = await supabase.rpc("search_audit", {
    p_from: from,
    p_to: to,
    p_search: search,
    p_offset: page * 25,
    p_scope: scope,
  });
  if (error) throw error;
  return data || [];
}
