import { supabase } from "../lib/supabase";

import type { Profile, Role } from "../types";

export async function getTeam(): Promise<Profile[]> {
  const { data, error } = await supabase

    .from("profiles")

    .select("*")

    .is("deleted_at", null)

    .order("display_name");

  if (error) throw error;

  return data || [];
}

export async function updateMember(
  id: string,

  name: string,

  role: Role,

  active: boolean,
) {
  const { error } = await supabase.rpc("update_team_member", {
    p_id: id,

    p_name: name,

    p_role: role,

    p_active: active,
  });

  if (error) throw error;
}

export async function createMember(input: {
  name: string;

  email: string;

  password: string;

  role: Role;
}) {
  return manageAccess(input);
}

export async function deleteMember(id: string) {
  return manageAccess({ action: "delete", id });
}

export async function updateCredentials(
  id: string,

  email: string,

  password: string,
) {
  return manageAccess({ action: "credentials", id, email, password });
}

async function manageAccess(input: Record<string, unknown>) {
  let {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session)
    throw new Error("Vuelve a iniciar sesión para gestionar el personal.");

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt || (session.expires_at || 0) * 1000 < Date.now() + 60000) {
      const refreshed = await supabase.auth.refreshSession();

      if (refreshed.error || !refreshed.data.session)
        throw new Error(
          "Tu sesión venció. Vuelve a iniciar sesión; no se guardaron los cambios.",
        );

      session = refreshed.data.session;
    }

    const { data, error } = await supabase.functions.invoke("team-admin", {
      body: input,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!error) {
      if (data?.error) throw new Error(data.error);

      return data;
    }

    if (error.context?.status === 401 && attempt === 0) continue;

    let message = "No se pudo completar la operación.";

    try {
      message = (await error.context.json()).error || message;
    } catch {}

    throw new Error(message);
  }
}
