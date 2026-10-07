import { useState, type FormEvent } from "react";
import { Layers3, Pencil, Trash2, Plus } from "lucide-react";
import { Modal } from "../../components/Modal";
import { useCatalog } from "../../context/CatalogContext";
import { saveCategory, deleteCategory } from "../../services/catalog";
import { errorMessage } from "../../lib/format";

export function CategoryManager({ onClose }: { onClose: () => void }) {
  const { categories, refresh } = useCatalog();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string>();
  const [removing, setRemoving] = useState<string>();
  const [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setEditing(undefined);
      setRemoving(undefined);
      setName("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => saveCategory(name, editing));
  }
  return (
    <Modal
      className="catalog-dialog category-manager-dialog"
      title="Gestionar secciones"
      onClose={onClose}
      busy={busy}
    >
      <div className="catalog-dialog-heading">
        <span className="catalog-dialog-symbol">
          <Layers3 size={23} />
        </span>
        <div>
          <span className="eyebrow">ORGANIZA TU CARTA</span>
          <h2>Secciones de productos</h2>
        </div>
      </div>
      <p className="muted">
        Los cambios se reflejan en la carta y el punto de venta.
      </p>
      <div className="category-list-caption">
        <span>TU CATÁLOGO</span>
        <span>{categories.length} secciones</span>
      </div>
      <div className="section-list">
        {categories.map((c, index) => (
          <div
            key={c}
            className={`section-row ${editing === c || removing === c ? "selected" : ""}`}
          >
            <span className="category-position">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{c}</strong>
            <div className="category-row-actions">
              <button
                className="icon"
                aria-label={`Editar ${c}`}
                title="Editar sección"
                disabled={busy}
                onClick={() => {
                  setEditing(c);
                  setName(c);
                  setRemoving(undefined);
                  setError("");
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon delete-icon"
                aria-label={`Eliminar ${c}`}
                title="Eliminar sección"
                disabled={busy}
                onClick={() => {
                  setRemoving(c);
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
            Si contiene productos, elige dónde moverlos. Las ventas anteriores
            se conservan.
          </p>
          <label>
            Mover productos a
            <select
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            >
              <option value="">Sin traslado (sección vacía)</option>
              {categories
                .filter((c) => c !== removing)
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          <button
            className="danger-button"
            disabled={busy}
            onClick={() =>
              void run(() => deleteCategory(removing, replacement))
            }
          >
            Confirmar eliminación
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setRemoving(undefined)}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <form className="category-form-panel" onSubmit={submit}>
          <label>
            {editing ? "Nuevo nombre" : "Nueva sección"}
            <input
              required
              minLength={2}
              maxLength={50}
              placeholder="Por ejemplo, jugos naturales"
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {!editing && <Plus size={17} />}
            {busy
              ? "Guardando…"
              : editing
                ? "Guardar sección"
                : "Crear sección"}
          </button>
          {editing && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setEditing(undefined);
                setName("");
              }}
            >
              Cancelar edición
            </button>
          )}
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
