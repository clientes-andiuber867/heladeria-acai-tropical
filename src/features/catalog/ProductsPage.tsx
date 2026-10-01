import { useState } from "react";
import { CategoryManager } from "./CategoryManager";
import { Plus, ShieldCheck } from "lucide-react";
import { ProductCatalog } from "./ProductCatalog";
import { ProductEditor } from "./ProductEditor";
import { useAuth } from "../../context/AuthContext";
import { useCatalog } from "../../context/CatalogContext";
import { useToast } from "../../context/ToastContext";
import { setProductState } from "../../services/catalog";
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
              onClick={() => setSectionsOpen(true)}
            >
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
        onToggle={toggle}
        busyId={busyId}
      />
      {isAdmin && editing !== undefined && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
