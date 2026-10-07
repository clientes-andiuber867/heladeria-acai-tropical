import { useEffect, useState } from "react";
import {
  Boxes,
  Plus,
  Search,
  Pencil,
  ArrowDownUp,
  History,
  RefreshCw,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Layers3,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Loading, ErrorState } from "../../components/States";
import { Modal } from "../../components/Modal";
import { day, stamp, errorMessage, periodDates } from "../../lib/format";
import {
  getInventory,
  deleteInventoryItem,
  getInventoryMovements,
  quantityLabel,
  movementLabels,
  type InventoryItem,
  type InventoryMovement,
} from "../../services/inventory";
import { InventoryEditor, InventoryAdjustment } from "./InventoryForms";
import { InventoryGroups } from "./InventoryGroups";
import "./inventory.css";

export function InventoryPage({ active }: { active: boolean }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  async function removeItem() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteInventoryItem(deleting.id);
      setItems((list) => list.filter((i) => i.id !== deleting.id));
      setDeleting(null);
      setRevision((n) => n + 1);
      toast("Artículo eliminado. Sus movimientos anteriores se conservan.");
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [tab, setTab] = useState("stock"),
    [date, setDate] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]),
    [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<InventoryMovement[]>([]),
    [count, setCount] = useState(0);
  const [search, setSearch] = useState(""),
    [lowOnly, setLowOnly] = useState(false);
  const [itemFilter, setItemFilter] = useState(""),
    [page, setPage] = useState(0);
  const [period, setPeriod] = useState({
    from: day(new Date()),
    to: day(new Date()),
  });
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(),
    [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const isAdmin = profile?.role === "admin";
  useEffect(() => {
    if (!active || !isAdmin) return;
    let valid = true;
    setBusy(true);
    setError("");
    (async () => {
      if (tab === "stock") {
        const data = await getInventory(date);
        if (valid) {
          setItems(data);
          if (!date) setAllItems(data);
        }
      } else {
        if (!period.from || !period.to || period.from > period.to)
          throw new Error("Selecciona un período válido.");
        const [data, catalog] = await Promise.all([
          getInventoryMovements(period.from, period.to, itemFilter, page),
          getInventory(),
        ]);
        if (valid) {
          setRows(data.rows);
          setCount(data.count);
          setAllItems(catalog);
        }
      }
      if (valid) setLoaded(true);
    })()
      .catch((e) => {
        if (valid) setError(errorMessage(e));
      })
      .finally(() => {
        if (valid) setBusy(false);
      });
    return () => {
      valid = false;
    };
  }, [
    active,
    isAdmin,
    tab,
    date,
    period.from,
    period.to,
    itemFilter,
    page,
    revision,
  ]);
  if (!isAdmin) return null;
  function saved() {
    setEditing(undefined);
    setAdjusting(null);
    setRevision((n) => n + 1);
    toast("Inventario actualizado.");
  }
  function history(item: InventoryItem) {
    setItemFilter(item.id);
    setPage(0);
    setPeriod({ from: day(new Date(item.created_at)), to: day(new Date()) });
    setTab("history");
  }
  const visible = items.filter(
    (i) =>
      (!lowOnly || Number(i.quantity) <= Number(i.minimum)) &&
      `${i.name} ${i.category} ${i.location}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="inventory-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TODO EN SU LUGAR</span>
          <h1>Inventario del negocio</h1>
          <p className="muted">
            Tus insumos, materiales y equipos, bajo control.
          </p>
        </div>
        <div className="section-actions">
          <button className="secondary" onClick={() => setGroupsOpen(true)}>
            <Layers3 size={18} />
            Gestionar grupos
          </button>
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={18} />
            Nuevo artículo
          </button>
        </div>
      </div>
      <div className="inventory-toolbar">
        <div
          className="inventory-tabs"
          role="group"
          aria-label="Vista de inventario"
        >
          <button
            className={tab === "stock" ? "active" : ""}
            onClick={() => setTab("stock")}
          >
            <Boxes size={17} />
            Existencias
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <History size={17} />
            Movimientos
          </button>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={15} />
          {busy ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
      {tab === "stock" ? (
        <>
          <div className="inventory-date">
            <label>
              Consultar existencias al
              <input
                aria-label="Fecha de inventario"
                type="date"
                value={date}
                max={day(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button className="text-button" onClick={() => setDate("")}>
              Ver actuales
            </button>
            <span>
              {date
                ? "Cantidades al cierre de la fecha elegida · Bolivia"
                : "Existencias actuales"}
            </span>
          </div>
          {date && (
            <p className="fine-print">
              La cantidad corresponde a esa fecha. Nombre, ubicación y mínimo
              muestran la configuración actual del artículo.
            </p>
          )}
          <div className="inventory-stats">
            <div>
              <span>
                <Boxes size={19} />
                Artículos registrados
              </span>
              <strong>{items.length}</strong>
              <small>Cada artículo conserva su propia unidad.</small>
            </div>
            <div>
              <span>
                <AlertTriangle size={19} />
                Por reponer
              </span>
              <strong>
                {
                  items.filter((i) => Number(i.quantity) <= Number(i.minimum))
                    .length
                }
              </strong>
              <small>En el mínimo o por debajo de él.</small>
            </div>
            <div>
              <span>
                <PackageCheck size={19} />
                Con existencias
              </span>
              <strong>
                {items.filter((i) => Number(i.quantity) > 0).length}
              </strong>
              <small>Según la fecha consultada.</small>
            </div>
          </div>
          <div className="catalog-tools">
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Buscar en inventario"
                placeholder="Artículo, grupo o ubicación…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              Solo por reponer
            </label>
          </div>
        </>
      ) : (
        <div className="inventory-history-filters">
          <label>
            Desde
            <input
              type="date"
              value={period.from}
              max={period.to}
              onChange={(e) => {
                setPeriod((p) => ({ ...p, from: e.target.value }));
                setPage(0);
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={day(new Date())}
              onChange={(e) => {
                setPeriod((p) => ({ ...p, to: e.target.value }));
                setPage(0);
              }}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              setPeriod(periodDates("month"));
              setPage(0);
            }}
          >
            Este mes
          </button>
          <label>
            Artículo
            <select
              value={itemFilter}
              onChange={(e) => {
                setItemFilter(e.target.value);
                setPage(0);
              }}
            >
              {<option value="">Todos los artículos</option>}
              {allItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <p className="fine-print">
            Del {period.from} al {period.to} · Horario de Bolivia.
          </p>
        </div>
      )}
      {error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : !loaded && busy ? (
        <Loading />
      ) : tab === "stock" ? (
        <section className="inventory-panel" aria-label="Existencias">
          <div className="inventory-panel-title">
            <Boxes size={20} />
            <h2>
              {date ? "Inventario por fecha" : "Lo que tienes en tu negocio"}
            </h2>
            <span>{visible.length} artículos</span>
          </div>
          {!visible.length ? (
            <div className="inventory-empty">
              <PackageX size={34} />
              <h3>
                {items.length
                  ? "No hay coincidencias"
                  : "Empieza con tu primer artículo"}
              </h3>
              <p>
                {items.length
                  ? "Prueba otra búsqueda o desactiva el filtro."
                  : "Registra vasos, cucharas, frutas, productos de limpieza o cualquier material."}
              </p>
              {!items.length && !date && (
                <button className="primary" onClick={() => setEditing(null)}>
                  <Plus size={17} />
                  Agregar artículo
                </button>
              )}
            </div>
          ) : (
            <div className="inventory-table-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Artículo / ubicación</th>
                    <th>Grupo</th>
                    <th>Existencias</th>
                    <th>Mínimo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.name}</strong>
                        <small>{i.location || "Sin ubicación"}</small>
                        {i.note && (
                          <small className="inventory-note">{i.note}</small>
                        )}
                      </td>
                      <td>{i.category}</td>
                      <td>
                        <strong className="inventory-quantity">
                          {quantityLabel(i.quantity)}
                        </strong>
                        <small>{i.unit}</small>
                      </td>
                      <td>
                        {quantityLabel(i.minimum)}
                        <small>{i.unit}</small>
                      </td>
                      <td>
                        <span
                          className={`inventory-status ${Number(i.quantity) <= Number(i.minimum) ? "low" : "ok"}`}
                        >
                          {Number(i.quantity) === 0
                            ? "Sin existencias"
                            : Number(i.quantity) <= Number(i.minimum)
                              ? "Por reponer"
                              : "En orden"}
                        </span>
                      </td>
                      <td>
                        <div className="inventory-actions">
                          {!date && (
                            <>
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => setAdjusting(i)}
                              >
                                <ArrowDownUp size={15} />
                                Movimiento
                              </button>
                              <button
                                className="icon"
                                title="Editar artículo"
                                aria-label={`Editar ${i.name}`}
                                onClick={() => setEditing(i)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon inventory-delete"
                                title="Eliminar artículo"
                                aria-label={`Eliminar ${i.name}`}
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleting(i);
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          <button
                            className="icon"
                            title="Ver movimientos"
                            aria-label={`Historial de ${i.name}`}
                            onClick={() => history(i)}
                          >
                            <History size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="inventory-panel">
          <div className="inventory-panel-title">
            <History size={20} />
            <h2>Registro de movimientos</h2>
            <span>{count} registros</span>
          </div>
          {!rows.length ? (
            <div className="inventory-empty">
              <History size={34} />
              <h3>Sin movimientos en este período</h3>
              <p>Prueba otras fechas o registra tu primer artículo.</p>
            </div>
          ) : (
            <div className="inventory-table-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Fecha / responsable</th>
                    <th>Artículo</th>
                    <th>Movimiento</th>
                    <th>Antes</th>
                    <th>Variación</th>
                    <th>Después</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {stamp(r.created_at)}
                        <small>{r.actor_name}</small>
                      </td>
                      <td>
                        <strong>{r.inventory_items.name}</strong>
                        <small>{r.inventory_items.unit}</small>
                      </td>
                      <td>
                        <span
                          className={`inventory-status ${r.kind === "out" ? "low" : "ok"}`}
                        >
                          {movementLabels[r.kind]}
                        </span>
                      </td>
                      <td>{quantityLabel(r.quantity_before)}</td>
                      <td>
                        {r.delta > 0 ? "+" : ""}
                        {quantityLabel(r.delta)}
                      </td>
                      <td>
                        <strong>{quantityLabel(r.quantity_after)}</strong>
                      </td>
                      <td className="inventory-note">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination">
            <span>
              {count
                ? `${page * 25 + 1}–${Math.min(count, page * 25 + 25)} de ${count}`
                : "0 movimientos"}
            </span>
            <button
              className="secondary"
              disabled={busy || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary"
              disabled={busy || (page + 1) * 25 >= count}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
      <p className="inventory-help">
        Control manual del inventario. Las ventas no descuentan insumos
        automáticamente. Registra salidas por consumo y usa el conteo físico
        para conciliar lo que realmente tienes.
      </p>
      {groupsOpen && (
        <InventoryGroups
          onClose={() => setGroupsOpen(false)}
          onChanged={() => setRevision((n) => n + 1)}
        />
      )}
      {deleting && (
        <Modal
          className="catalog-dialog"
          title="Eliminar artículo"
          busy={deleteBusy}
          onClose={() => setDeleting(null)}
        >
          <div className="catalog-dialog-heading">
            <span className="catalog-dialog-symbol">
              <Trash2 size={23} />
            </span>
            <div>
              <span className="eyebrow">INVENTARIO DEL NEGOCIO</span>
              <h2>Eliminar artículo</h2>
            </div>
          </div>
          <div className="inventory-item-summary">
            <strong>{deleting.name}</strong>
            <span>
              Existencia registrada: {quantityLabel(deleting.quantity)}{" "}
              {deleting.unit}
            </span>
          </div>
          <p>
            Se quitará este artículo de las existencias del negocio. Esta acción
            no se puede deshacer.
          </p>
          <div className="catalog-preservation-note">
            <ShieldCheck size={19} />
            <span>
              Los movimientos anteriores se conservan en el historial.
            </span>
          </div>
          {deleteError && (
            <p className="error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="catalog-dialog-footer">
            <button
              className="secondary"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              disabled={deleteBusy}
              onClick={removeItem}
            >
              <Trash2 size={16} />
              {deleteBusy ? "Eliminando…" : "Eliminar artículo"}
            </button>
          </div>
        </Modal>
      )}
      {editing !== undefined && (
        <InventoryEditor
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={saved}
        />
      )}
      {adjusting && (
        <InventoryAdjustment
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
