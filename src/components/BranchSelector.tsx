import { useState, type FormEvent } from "react";
import { Pencil, Store } from "lucide-react";
import { useBranch } from "../context/BranchContext";
import { useAuth } from "../context/AuthContext";
import { Modal } from "./Modal";
import { errorMessage } from "../lib/format";
export function BranchSelector() {
  const { branches, branch, select, rename } = useBranch();
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(branch.name),
    [phone, setPhone] = useState(branch.order_phone);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await rename(name, phone);
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="branch-selector">
        <Store size={18} />
        {profile?.role === "admin" ? (
          <>
            <label>
              Sucursal
              <select
                aria-label="Sucursal activa"
                value={branch.id}
                onChange={(e) => select(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon"
              aria-label="Editar sucursal"
              onClick={() => {
                setName(branch.name);
                setPhone(branch.order_phone);
                setEditing(true);
              }}
            >
              <Pencil size={16} />
            </button>
          </>
        ) : (
          <strong>{branch.name}</strong>
        )}
      </div>
      {editing && (
        <Modal
          title="Editar sucursal"
          onClose={() => setEditing(false)}
          busy={busy}
        >
          <h2>Editar sucursal</h2>
          <form onSubmit={save}>
            <label>
              Nombre de la sucursal
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              WhatsApp de pedidos
              <input
                required
                inputMode="tel"
                pattern="[0-9]{8,15}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <p className="muted">
              Incluye el código de país, sin + ni espacios. El enlace de la
              carta se conserva al cambiar el nombre.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Guardando…" : "Guardar sucursal"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
