import { useState, useEffect } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { money } from "../../lib/format";
import { useCatalog } from "../../context/CatalogContext";
import { Loading, ErrorState, Empty } from "../../components/States";
import type { Product } from "../../types";
export function ProductCatalog({
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  busyId,
}: {
  onAdd?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onToggle?: (product: Product) => void;
  busyId?: string;
}) {
  const {
    categories: sections,
    products,
    loading,
    error,
    refresh,
  } = useCatalog();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todos");
  const categories = ["Todos", ...sections];
  useEffect(() => {
    if (category !== "Todos" && !sections.includes(category))
      setCategory("Todos");
  }, [sections, category]);
  const filtered = products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (loading) return <Loading label="Preparando nuestra carta…" />;
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          void refresh();
        }}
      />
    );
  return (
    <>
      <div className="catalog-tools">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Buscar productos"
            placeholder="Busca algo delicioso…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">{filtered.length} productos</span>
      </div>
      <div className="categories">
        {categories.map((c) => (
          <button
            key={c}
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <Empty
          title={
            products.length
              ? "No encontramos ese antojo"
              : "Estamos preparando la carta"
          }
          text={
            products.length
              ? "Prueba otra categoría o búsqueda."
              : onEdit
                ? "Agrega el primer producto para empezar a vender."
                : "Muy pronto encontrarás nuestros productos aquí."
          }
        />
      ) : (
        <div className="product-grid">
          {filtered.map((p, i) => (
            <article
              key={p.id}
              className={`product ${!p.available ? "soldout" : ""}`}
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
            >
              <div className="product-photo">
                <img
                  src={p.image || "/logo.png"}
                  className={!p.image ? "product-fallback" : ""}
                  alt={p.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/logo.png";
                  }}
                />
                <span className="pill">{p.category}</span>
                {!p.available && (
                  <span className="out-label">Agotado por hoy</span>
                )}
                <div className="product-photo-actions">
                  {onEdit && (
                    <button
                      className="icon"
                      title="Editar producto"
                      aria-label={`Editar ${p.name}`}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil size={17} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="icon delete-icon"
                      title="Eliminar producto"
                      aria-label={`Eliminar ${p.name}`}
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </div>
              <div className="product-info">
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div className="product-bottom">
                  <strong>{money(p.price)}</strong>
                  {onAdd && (
                    <button
                      className="add icon"
                      aria-label={`Agregar ${p.name}`}
                      disabled={!p.available}
                      onClick={() => onAdd(p)}
                    >
                      <Plus size={20} />
                    </button>
                  )}
                  {onToggle && (
                    <button
                      className={`availability ${p.available ? "on" : ""}`}
                      disabled={busyId === p.id}
                      onClick={() => onToggle(p)}
                    >
                      {busyId === p.id
                        ? "Guardando…"
                        : p.available
                          ? "Disponible"
                          : "Agotado"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
