import { useState, useEffect, type FormEvent } from "react";
import { Upload, Archive } from "lucide-react";
import { Modal } from "../../components/Modal";
import { errorMessage } from "../../lib/format";
import {
  saveProduct,
  uploadProductImage,
  removeUploadedImage,
  setProductState,
} from "../../services/catalog";
import { useCatalog } from "../../context/CatalogContext";
import { useToast } from "../../context/ToastContext";
import type { Product, ProductInput } from "../../types";
export function ProductEditor({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { categories, refresh } = useCatalog();
  const [form, setForm] = useState<ProductInput>(
      product
        ? {
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            image: product.image,
            available: product.available,
          }
        : {
            name: "",
            description: "",
            price: 0,
            category: categories[0] || "",
            image: null,
            available: true,
          },
    ),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(product?.image || "/logo.png"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [archiving, setArchiving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!file) return;
    const object = URL.createObjectURL(file);
    setPreview(object);
    return () => URL.revokeObjectURL(object);
  }, [file]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let uploaded: { path: string; url: string } | null = null;
    try {
      if (!form.name.trim() || !Number.isFinite(form.price) || form.price <= 0)
        throw new Error("Revisa el nombre y el precio.");
      if (file) uploaded = await uploadProductImage(file);
      await saveProduct(
        {
          ...form,
          name: form.name.trim(),
          price: Math.round(form.price * 100) / 100,
          image: uploaded?.url || form.image,
        },
        product?.id,
      );
      await refresh();
      toast("Producto guardado. La carta ya está actualizada.");
      onClose();
    } catch (e) {
      if (uploaded) await removeUploadedImage(uploaded.path).catch(() => {});
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function archive() {
    setBusy(true);
    try {
      await setProductState(product!.id, { archived: true, available: false });
      await refresh();
      toast("Producto archivado. Se conserva en las ventas anteriores.");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal title="Producto" onClose={onClose} busy={busy}>
      <span className="eyebrow">TU CARTA TROPICAL</span>
      <h2>{product ? "Editar producto" : "Un nuevo favorito"}</h2>
      <form onSubmit={submit}>
        <label>
          Nombre
          <input
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Descripción
          <textarea
            aria-label="Descripción"
            required
            maxLength={250}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Precio (Bs)
            <input
              type="number"
              min="0.01"
              max="999999.99"
              step="0.01"
              required
              value={form.price || ""}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Categoría
            <select
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="image-upload">
          <img src={preview} alt="Vista previa" />
          <span>
            <Upload size={20} /> Fotografía del producto
            <small>JPG, PNG o WebP · Hasta 10 MB · Se comprime antes de subir</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) {
                  setError("La foto debe pesar como máximo 10 MB.");
                  return;
                }
                setFile(f);
                setError("");
              }}
            />
          </span>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm({ ...form, available: e.target.checked })}
          />{" "}
          Disponible en la carta y para vender
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
      {product && (
        <div className="archive-area">
          {archiving ? (
            <>
              <p>
                El producto dejará de aparecer en la carta. Las ventas
                anteriores se conservan.
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={archive}
              >
                Confirmar archivo
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setArchiving(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button className="text-button" onClick={() => setArchiving(true)}>
              <Archive size={15} /> Archivar producto
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
