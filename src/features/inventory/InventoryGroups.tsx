import { useEffect, useState, type FormEvent } from "react";
import { Layers3, Pencil, Trash2, Plus } from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  getInventoryGroups,
  saveInventoryGroup,
  deleteInventoryGroup,
} from "../../services/inventory";
import { errorMessage } from "../../lib/format";

export function InventoryGroups({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [groups, setGroups] = useState<string[]>([]),
    [name, setName] = useState("");
  const [editing, setEditing] = useState<string>(),
    [removing, setRemoving] = useState<string>();
  const [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    getInventoryGroups()
      .then((data) => {
        if (live) setGroups(data);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
      setEditing(undefined);
      setRemoving(undefined);
      setName("");
      setGroups(await getInventoryGroups());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => saveInventoryGroup(name, editing));
  }
  return (
    <Modal
      className="catalog-dialog category-manager-dialog"
      title="Grupos de inventario"
      onClose={onClose}
      busy={busy}
    >
      <div className="catalog-dialog-heading">
        <span className="catalog-dialog-symbol">
          <Layers3 size={23} />
        </span>
        <div>
          <span className="eyebrow">A TU MANERA</span>
          <h2>Grupos de inventario</h2>
        </div>
      </div>
      <p>
        Crea todos los grupos que necesite tu negocio. Tú eliges cómo organizar
        tus artículos.
      </p>
      <div className="category-list-caption">
        <span>TUS GRUPOS</span>
        <span>{groups.length} registrados</span>
      </div>
      <div className="section-list">
        {loading && <p className="muted">Cargando grupos…</p>}
        {!loading && !groups.length && (
          <p className="muted">Aún no hay grupos. Crea el primero abajo.</p>
        )}
        {groups.map((g, i) => (
          <div
            className={`section-row ${editing === g || removing === g ? "selected" : ""}`}
            key={g}
          >
            <span className="category-position">
              {String(i + 1).padStart(2, "0")}
            </span>
            <strong>{g}</strong>
            <div className="category-row-actions">
              <button
                className="icon"
                aria-label={`Editar grupo ${g}`}
                title="Renombrar grupo"
                disabled={busy}
                onClick={() => {
                  setEditing(g);
                  setName(g);
                  setRemoving(undefined);
                  setError("");
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon delete-icon"
                aria-label={`Eliminar grupo ${g}`}
                title="Eliminar grupo"
                disabled={busy}
                onClick={() => {
                  setRemoving(g);
                  setReplacement("");
                  setError("");
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {removing ? (
        <div className="category-form-panel">
          <h3>Eliminar {removing}</h3>
          <p>
            Los artículos y sus cantidades se conservan. Si este grupo tiene
            artículos, elige dónde trasladarlos.
          </p>
          <label>
            Trasladar artículos a
            <select
              disabled={busy}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            >
              <option value="">Sin traslado (grupo vacío)</option>
              {groups
                .filter((g) => g !== removing)
                .map((g) => (
                  <option key={g}>{g}</option>
                ))}
            </select>
          </label>
          <div className="section-actions">
            <button
              className="danger-button"
              disabled={busy}
              onClick={() =>
                run(() => deleteInventoryGroup(removing, replacement))
              }
            >
              Eliminar grupo
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemoving(undefined)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form className="category-form-panel" onSubmit={submit}>
          <label>
            {editing ? "Nombre del grupo" : "Nuevo grupo"}
            <input
              required
              maxLength={60}
              disabled={busy || loading}
              placeholder="Escribe el nombre que necesites"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="section-actions">
            <button
              className="primary"
              disabled={busy || loading || !name.trim()}
            >
              <Plus size={17} />
              {busy ? "Guardando…" : editing ? "Guardar nombre" : "Crear grupo"}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(undefined);
                  setName("");
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
