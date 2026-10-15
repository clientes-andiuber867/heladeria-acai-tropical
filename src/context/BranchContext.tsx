import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import {
  branchId,
  branchRequestsPending,
  FIRST_BRANCH,
  setActiveBranch,
  type Branch,
} from "../lib/branch";
import type { Profile } from "../types";
import { ErrorState, Loading } from "../components/States";
import { errorMessage } from "../lib/format";

const Context = createContext<{
  branches: Branch[];
  branch: Branch;
  select: (id: string) => void;
  rename: (name: string, phone: string) => Promise<void>;
}>(null!);
export const useBranch = () => useContext(Context);

export function BranchProvider({
  profile,
  children,
}: {
  profile?: Profile;
  children: ReactNode;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setCurrent("");
    setError("");
    void supabase
      .from("branches")
      .select("id,name,order_phone")
      .order("id")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(
            "No se pudieron cargar las sucursales. Comprueba que la base de datos tenga aplicada la actualización de sucursales.",
          );
          return;
        }
        const list = (data || []) as Branch[];
        let saved: string | null = null;
        try {
          if (profile?.role === "admin")
            saved = sessionStorage.getItem(`acai.branch.${profile.id}`);
        } catch {
          /* Selection also works when browser storage is disabled. */
        }
        const id =
          profile?.role === "cashier"
            ? profile.branch_id
            : profile
              ? saved || FIRST_BRANCH
              : branchId();
        const branch =
          list.find((b) => b.id === id) ||
          (profile?.role === "admin" ? list[0] : undefined);
        if (!branch) {
          setError(
            "La sucursal no existe o tu cuenta no tiene una sucursal asignada.",
          );
          return;
        }
        setActiveBranch(branch);
        setBranches(list);
        setCurrent(branch.id);
        if (profile) void supabase.rpc("record_sign_in").then(() => {});
      });
    return () => {
      active = false;
    };
  }, [profile?.id, profile?.role, profile?.branch_id, revision]);
  const branch = branches.find((b) => b.id === current);
  if (error)
    return (
      <div className="auth-single">
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      </div>
    );
  if (!branch)
    return (
      <div className="auth-single">
        <Loading label="Cargando sucursal…" />
      </div>
    );
  function select(id: string) {
    if (profile?.role !== "admin" || id === current) return;
    if (
      branchRequestsPending() ||
      document.querySelector('dialog[open], [role="dialog"]')
    ) {
      window.alert(
        "Termina la operación abierta antes de cambiar de sucursal.",
      );
      return;
    }
    const event = new Event("branch-before-change", { cancelable: true });
    if (
      !window.dispatchEvent(event) &&
      !window.confirm(
        "Hay un pedido sin terminar. ¿Cambiar de sucursal y cerrar este pedido? Los cobros pendientes de verificación se conservarán para retomarlos en su sucursal.",
      )
    )
      return;
    const next = branches.find((b) => b.id === id);
    if (!next) return;
    try {
      sessionStorage.setItem(`acai.branch.${profile.id}`, id);
    } catch {
      /* Keep this selection in memory. */
    }
    setActiveBranch(next);
    setCurrent(id);
  }
  async function rename(name: string, phone: string) {
    const { error } = await supabase.rpc("update_branch", {
      p_id: current,
      p_name: name.trim(),
      p_phone: phone.trim(),
    });
    if (error) throw new Error(errorMessage(error));
    const next = { ...branch!, name: name.trim(), order_phone: phone.trim() };
    setBranches((list) => list.map((b) => (b.id === current ? next : b)));
    setActiveBranch(next);
  }
  return (
    <Context.Provider value={{ branches, branch, select, rename }}>
      <div key={`${profile?.id || "public"}:${current}`}>{children}</div>
    </Context.Provider>
  );
}
