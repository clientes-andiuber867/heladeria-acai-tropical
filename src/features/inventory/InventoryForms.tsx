import { useEffect, useState, type FormEvent } from "react";
import { Boxes, ArrowDownUp, ShieldCheck, Plus } from "lucide-react";
import { Modal } from "../../components/Modal";
import { errorMessage } from "../../lib/format";
import { generateUUID } from "../../lib/uuid";
import {
  saveInventory,
  moveInventory,
  quantityLabel,
  getInventoryGroups,
  saveInventoryGroup,
  type InventoryItem,
  type InventoryInput,
} from "../../services/inventory";

export function InventoryEditor({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<InventoryInput>(
    item || {
      name: "",
      category: "",
      unit: "unidades",
      location: "",
      note: "",
      quantity: 0,
      minimum: 0,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [initialQuantity, setInitialQuantity] = useState(
    String(item?.quantity ?? 0),
  );
  const [minimumQuantity, setMinimumQuantity] = useState(
    String(item?.minimum ?? 0),
  );
  const [groups, setGroups] = useState<string[]>([]),
    [groupsLoading, setGroupsLoading] = useState(true);
  const [newGroup, setNewGroup] = useState<string | null>(null);
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
        if (live) setGroupsLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  async function createGroup() {
    if (!newGroup?.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveInventoryGroup(newGroup);
      setForm((f) => ({ ...f, category: newGroup.trim() }));
      setGroups((g) =>
        [...g, newGroup.trim()].sort((a, b) => a.localeCompare(b)),
      );
      setNewGroup(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await saveInventory(
        {
          ...form,
          quantity: Number(initialQuantity),
          minimum: Number(minimumQuantity),
        },
        item?.id,
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      className="catalog-dialog inventory-dialog"
      title={item ? "Editar artículo" : "Nuevo artículo"}
      onClose={onClose}
      busy={busy}
    >
      <div className="catalog-dialog-heading">
        <span className="catalog-dialog-symbol">
          <Boxes />
        </span>
        <div>
          <span className="eyebrow">CADA INSUMO CUENTA</span>
          <h2>{item ? "Editar artículo" : "Nuevo artículo"}</h2>
        </div>
      </div>
      <p>Registra materiales, ingredientes, envases o equipos del negocio.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Nombre del artículo
            <input
              autoFocus
              required
              maxLength={100}
              placeholder="Ej. Vasos de 500 ml"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Grupo
              <select
                required
                disabled={groupsLoading}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">
                  {groupsLoading ? "Cargando grupos…" : "Selecciona un grupo"}
                </option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              Unidad de medida
              <input
                required
                list="inventory-units"
                maxLength={30}
                disabled={!!item}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>
          </div>
          {newGroup === null ? (
            <button
              type="button"
              className="text-button inventory-create-group"
              onClick={() => setNewGroup("")}
            >
              <Plus size={15} />
              Crear un nuevo grupo
            </button>
          ) : (
            <div className="category-form-panel">
              <label>
                Nombre del nuevo grupo
                <input
                  maxLength={60}
                  value={newGroup}
                  placeholder="El nombre que necesites"
                  onChange={(e) => setNewGroup(e.target.value)}
                />
              </label>
              <div className="section-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!newGroup.trim()}
                  onClick={createGroup}
                >
                  Crear y seleccionar
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setNewGroup(null)}
                >
                  Cancelar grupo
                </button>
              </div>
            </div>
          )}
          <datalist id="inventory-units">
            {[
              "unidades",
              "kg",
              "gramos",
              "litros",
              "ml",
              "paquetes",
              "cajas",
            ].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <div className="form-row">
            {!item && (
              <label>
                Cantidad inicial
                <input
                  required
                  type="number"
                  min="0"
                  max="999999999"
                  step="1"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                />
              </label>
            )}
            <label>
              Avisar al llegar a
              <input
                required
                type="number"
                min="0"
                max="999999999"
                step="1"
                value={minimumQuantity}
                onChange={(e) => setMinimumQuantity(e.target.value)}
              />
              <small>Stock mínimo en {form.unit || "la unidad elegida"}.</small>
            </label>
          </div>
          <label>
            Ubicación (opcional)
            <input
              maxLength={100}
              placeholder="Ej. Almacén, estante 2"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            Observaciones (opcional)
            <textarea
              maxLength={500}
              placeholder="Marca, presentación u otros detalles útiles"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          {item && (
            <p className="fine-print">
              Para cambiar la cantidad, registra una entrada, salida o conteo
              físico. La unidad se conserva para no alterar el historial.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="catalog-dialog-footer">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">
              {busy ? "Guardando…" : "Guardar artículo"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function InventoryAdjustment({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState("in"),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [request, setRequest] = useState(generateUUID);
  const next =
    kind === "count"
      ? Number(amount)
      : Number(item.quantity) + (kind === "out" ? -1 : 1) * Number(amount);
  function changed() {
    setRequest(generateUUID());
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await moveInventory(request, item.id, kind, Number(amount), note);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      className="catalog-dialog inventory-dialog"
      title="Registrar movimiento"
      onClose={onClose}
      busy={busy}
    >
      <div className="catalog-dialog-heading">
        <span className="catalog-dialog-symbol">
          <ArrowDownUp />
        </span>
        <div>
          <span className="eyebrow">CONTROL DE EXISTENCIAS</span>
          <h2>Registrar movimiento</h2>
        </div>
      </div>
      <div className="inventory-item-summary">
        <strong>{item.name}</strong>
        <span>
          Existencia registrada: {quantityLabel(item.quantity)} {item.unit}
        </span>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Tipo de movimiento
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setAmount("");
                changed();
              }}
            >
              <option value="in">Entrada · recibí más</option>
              <option value="out">Salida · uso, pérdida o retiro</option>
              <option value="count">Conteo físico · conté lo que hay</option>
            </select>
          </label>
          <label>
            {kind === "count"
              ? "Cantidad total que contaste"
              : "Cantidad del movimiento"}{" "}
            ({item.unit})
            <input
              required
              type="number"
              min={kind === "count" ? 0 : 0.001}
              max="999999999"
              step="0.001"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                changed();
              }}
            />
          </label>
          <p className="fine-print">
            {kind === "count"
              ? "El conteo reemplaza la cantidad registrada y conserva la diferencia en el historial. Úsalo al revisar tu inventario mensual."
              : "La cantidad se suma o resta a las existencias actuales del servidor."}
          </p>
          {amount !== "" && (
            <div className="inventory-estimate">
              Existencia estimada después:{" "}
              <strong>
                {quantityLabel(next)} {item.unit}
              </strong>
            </div>
          )}
          <label>
            Motivo u observación
            <textarea
              required
              maxLength={500}
              placeholder={
                kind === "count"
                  ? "Ej. Conteo de cierre de mes"
                  : "Ej. Compra a proveedor / consumo del turno"
              }
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                changed();
              }}
            />
          </label>
          <div className="catalog-preservation-note">
            <ShieldCheck size={19} />
            <span>
              Se registran la fecha, la hora y el responsable. Los movimientos
              no se borran.
            </span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="catalog-dialog-footer">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">
              {busy ? "Guardando…" : "Confirmar movimiento"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
