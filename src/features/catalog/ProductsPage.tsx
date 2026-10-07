import { Modal } from "../../components/Modal";
import { useState } from "react";
import { CategoryManager } from "./CategoryManager";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ProductCatalog } from "./ProductCatalog";
import { ProductEditor } from "./ProductEditor";
import { useAuth } from "../../context/AuthContext";
import { useCatalog } from "../../context/CatalogContext";
import { useToast } from "../../context/ToastContext";
import {
  deleteProduct,
  getProducts,
  setProductState,
} from "../../services/catalog";
import { errorMessage } from "../../lib/format";
import type { Product } from "../../types";

export function ProductsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined),
    [busyId, setBusyId] = useState("");
  const { refresh } = useCatalog();
  const toast = useToast();
  const [archived, setArchived] = useState<Product[] | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  async function loadArchived() {
    setArchiveLoading(true);
    try {
      setArchived((await getProducts(true)).filter((p) => p.archived));
    } catch (e) {
      toast(errorMessage(e), true);
    } finally {
      setArchiveLoading(false);
    }
  }
  async function restore(p: Product) {
    setBusyId(p.id);
    try {
      await setProductState(p.id, { archived: false, available: true });
      setArchived((rows) => rows?.filter((row) => row.id !== p.id) ?? null);
      await refresh();
      toast("Producto restaurado en la carta.");
    } catch (e) {
      toast(errorMessage(e), true);
    } finally {
      setBusyId("");
    }
  }
  async function remove() {
    if (!deleting || busyId) return;
    setBusyId(deleting.id);
    try {
      await deleteProduct(deleting.id);
      setArchived(
        (rows) => rows?.filter((row) => row.id !== deleting.id) ?? null,
      );
      setDeleting(null);
      await refresh();
      toast("Producto eliminado. Las ventas anteriores se conservan.");
    } catch (e) {
      toast(errorMessage(e), true);
    } finally {
      setBusyId("");
    }
  }

  async function toggle(p: Product) {
    setBusyId(p.id);
    try {
      await setProductState(p.id, { available: !p.available });
      await refresh();
      toast(
        p.available
          ? "Producto marcado como agotado."
          : "Producto disponible nuevamente.",
      );
    } catch (e) {
      toast(errorMessage(e), true);
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EL CORAZÓN DE TU NEGOCIO</span>
          <h1>Una carta irresistible</h1>
          <p className="muted">
            {isAdmin
              ? "Tus productos, siempre frescos y al día."
              : "Activa o desactiva la disponibilidad de los productos según el stock del turno."}
          </p>
        </div>
        {isAdmin ? (
          <div className="section-actions">
            <button
              className="secondary"
              disabled={archiveLoading}
              onClick={loadArchived}
            >
              {archiveLoading ? "Cargando…" : "Productos archivados"}
            </button>
            <button className="secondary" onClick={() => setSectionsOpen(true)}>
              Gestionar secciones
            </button>
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus size={18} /> Agregar producto
            </button>
          </div>
        ) : (
          <span className="live-badge">
            <ShieldCheck size={14} /> Control de disponibilidad
          </span>
        )}
      </div>
      {isAdmin && sectionsOpen && (
        <CategoryManager onClose={() => setSectionsOpen(false)} />
      )}
      <ProductCatalog
        onEdit={isAdmin ? setEditing : undefined}
        onDelete={isAdmin ? setDeleting : undefined}
        onToggle={toggle}
        busyId={busyId}
      />
      {isAdmin && archived !== null && !deleting && (
        <Modal
          title="Productos archivados"
          onClose={() => setArchived(null)}
          busy={!!busyId}
        >
          <span className="eyebrow">RECUPERA TU CATÁLOGO</span>
          <h2>Productos archivados</h2>
          <p className="muted">
            Estos productos estaban ocultos de la carta. Puedes restaurarlos o
            eliminarlos definitivamente.
          </p>
          {!archived.length && <p>No hay productos archivados.</p>}
          {archived.map((p) => (
            <div className="archived-product-row" key={p.id}>
              <strong>{p.name}</strong>
              <div className="section-actions">
                <button
                  className="secondary"
                  disabled={!!busyId}
                  onClick={() => restore(p)}
                >
                  Restaurar
                </button>
                <button
                  className="danger-button"
                  disabled={!!busyId}
                  onClick={() => setDeleting(p)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </Modal>
      )}
      {isAdmin && deleting && (
        <Modal
          className="catalog-dialog delete-product-dialog"
          title="Eliminar producto"
          onClose={() => setDeleting(null)}
          busy={!!busyId}
        >
          <div className="catalog-dialog-heading">
            <span className="catalog-dialog-symbol">
              <Trash2 size={23} />
            </span>
            <div>
              <span className="eyebrow">TU CARTA TROPICAL</span>
              <h2>Eliminar producto</h2>
            </div>
          </div>
          <div className="delete-product-preview">
            <img src={deleting.image || "/logo.png"} alt="" />
            <div>
              <strong>{deleting.name}</strong>
              <span>{deleting.category}</span>
            </div>
          </div>
          <p>
            Este producto dejará de formar parte de tu catálogo. La eliminación
            es definitiva.
          </p>
          <div className="catalog-preservation-note">
            <ShieldCheck size={19} />
            <span>
              Las ventas y los comprobantes anteriores se conservan intactos.
            </span>
          </div>
          <div className="catalog-dialog-footer">
            <button
              className="secondary"
              disabled={!!busyId}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              disabled={!!busyId}
              onClick={remove}
            >
              <Trash2 size={16} />
              {busyId ? "Eliminando…" : "Eliminar producto"}
            </button>
          </div>
        </Modal>
      )}
      {isAdmin && editing !== undefined && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
