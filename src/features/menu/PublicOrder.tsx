import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  ScanLine,
  Download,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import { money, errorMessage } from "../../lib/format";
import { qrUrl, type PaymentSettings } from "../../services/payments";
import { getProducts } from "../../services/catalog";
import {
  getPublicPayment,
  orderTotal,
  orderWhatsAppUrl,
  type OrderLine,
} from "./orderHelpers";

export function PublicOrder({
  lines,
  onQuantity,
  onClose,
  refreshCatalog,
}: {
  lines: OrderLine[];
  onQuantity: (id: string, quantity: number) => void;
  onClose: () => void;
  refreshCatalog: () => Promise<void>;
}) {
  const [payment, setPayment] = useState<PaymentSettings | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [largeQR, setLargeQR] = useState(false);
  const [name, setName] = useState(""),
    [note, setNote] = useState("");
  const [imageFailed, setImageFailed] = useState(false),
    [downloading, setDownloading] = useState(false);
  const total = orderTotal(lines);
  useEffect(() => {
    let live = true;
    const load = () => {
      void getPublicPayment()
        .then((p) => {
          if (live) {
            setPayment(p);
            setImageFailed(false);
          }
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    };
    load();
    void refreshCatalog();
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener("focus", load);
    };
  }, [refreshCatalog]);
  async function send() {
    if (!lines.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const [current, currentQR] = await Promise.all([
        getProducts(),
        getPublicPayment(),
      ]);
      const changed = lines.some((line) => {
        const p = current.find((p) => p.id === line.product.id);
        return (
          !p?.available ||
          p.name !== line.product.name ||
          Number(p.price) !== Number(line.product.price)
        );
      });
      if (changed) {
        await refreshCatalog();
        throw new Error(
          "La carta cambió. Revisa los productos y el total antes de continuar.",
        );
      }
      if (currentQR?.version !== payment?.version) {
        setPayment(currentQR);
        setImageFailed(false);
        throw new Error(
          "El QR de cobro se actualizó. Revisa el nuevo QR antes de continuar.",
        );
      }
      const mobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      window.location.assign(orderWhatsAppUrl(lines, name, note, !mobile));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function downloadQR() {
    if (!payment || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(qrUrl(payment.qr_path));
      if (!response.ok)
        throw new Error("No se pudo guardar el QR. Inténtalo otra vez.");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Acai-Tropical-QR.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Modal
      title="Tu pedido por WhatsApp"
      className={`public-order-dialog ${largeQR ? "public-order-expanded" : ""}`}
      onClose={onClose}
      busy={busy}
    >
      <div className="catalog-dialog-heading">
        <span className="catalog-dialog-symbol">
          <ShoppingBag />
        </span>
        <div>
          <span className="eyebrow">TU MOMENTO TROPICAL</span>
          <h2>{largeQR ? "QR oficial del negocio" : "Tu pedido"}</h2>
        </div>
      </div>
      {largeQR && payment ? (
        <div className="public-order-large-qr">
          <img
            src={qrUrl(payment.qr_path)}
            alt="QR oficial ampliado para pagar"
          />
          <strong>{money(total)}</strong>
          <p>{payment.recipient}</p>
          <button className="secondary" onClick={() => setLargeQR(false)}>
            <ArrowLeft size={17} />
            Volver al pedido
          </button>
        </div>
      ) : (
        <>
          <p className="order-intro">
            Revisa tus favoritos, paga con el QR y envía tu solicitud al
            negocio.
          </p>
          {!lines.length ? (
            <div className="order-empty">
              <ShoppingBag size={36} />
              <h3>Tu próximo antojo te espera</h3>
              <p>Agrega productos desde la carta para armar tu pedido.</p>
              <button className="primary" onClick={onClose}>
                Elegir productos
              </button>
            </div>
          ) : (
            <div className="public-order-columns">
              <div>
                <div className="public-order-lines">
                  {lines.map(({ product: p, quantity }) => (
                    <div className="public-order-line" key={p.id}>
                      <img src={p.image || "/logo.png"} alt="" />
                      <div className="order-line-name">
                        <strong>{p.name}</strong>
                        <small>{money(p.price)} por unidad</small>
                        <div className="order-quantity">
                          <button
                            className="icon"
                            disabled={busy}
                            aria-label={`Quitar una unidad de ${p.name}`}
                            onClick={() => onQuantity(p.id, quantity - 1)}
                          >
                            <Minus size={15} />
                          </button>
                          <span aria-label={`Cantidad de ${p.name}`}>
                            {quantity}
                          </span>
                          <button
                            className="icon"
                            disabled={busy || quantity >= 99 || !p.available}
                            aria-label={`Añadir una unidad de ${p.name}`}
                            onClick={() => onQuantity(p.id, quantity + 1)}
                          >
                            <Plus size={15} />
                          </button>
                          <button
                            className="icon"
                            disabled={busy}
                            aria-label={`Quitar ${p.name} del pedido`}
                            onClick={() => onQuantity(p.id, 0)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {!p.available && (
                          <small className="error">
                            Ya no está disponible. Quítalo para continuar.
                          </small>
                        )}
                      </div>
                      <strong>
                        {money(
                          (Math.round(Number(p.price) * 100) * quantity) / 100,
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
                <label>
                  Tu nombre (opcional)
                  <input
                    maxLength={60}
                    disabled={busy}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="¿Cómo te llamas?"
                  />
                </label>
                <label>
                  Indicaciones (opcional)
                  <textarea
                    maxLength={250}
                    disabled={busy}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Por ejemplo: sin granola. Coordinaremos la entrega por WhatsApp."
                  />
                </label>
                <div className="order-total">
                  <span>Total de productos</span>
                  <strong>{money(total)}</strong>
                </div>
                <p className="fine-print">
                  Entrega o recojo y posibles costos de envío se coordinan por
                  WhatsApp.
                </p>
              </div>
              <aside className="public-order-payment">
                <span className="order-step">
                  <ScanLine size={18} /> Paga con el QR del negocio
                </span>
                {loading ? (
                  <p>Cargando QR…</p>
                ) : payment ? (
                  <>
                    <button
                      className="order-qr-preview"
                      onClick={() => setLargeQR(true)}
                      aria-label="Ampliar QR de pago"
                    >
                      <img
                        src={qrUrl(payment.qr_path)}
                        alt="QR oficial de Açaí Tropical"
                        onError={() => setImageFailed(true)}
                      />
                    </button>
                    {imageFailed && (
                      <p className="error">
                        No se pudo cargar la imagen. Solicita el QR por WhatsApp
                        antes de pagar.
                      </p>
                    )}
                    <p className="order-recipient">{payment.recipient}</p>
                    <div className="order-pay-amount">
                      <small>Ingresa este importe en tu banco</small>
                      <strong>{money(total)}</strong>
                    </div>
                    <button
                      className="secondary"
                      disabled={downloading || imageFailed}
                      onClick={downloadQR}
                    >
                      <Download size={16} />
                      {downloading ? "Guardando…" : "Guardar QR"}
                    </button>
                    <p className="fine-print">
                      En tu teléfono, guarda la imagen e impórtala desde tu
                      aplicación bancaria si permite pagar desde una imagen.
                    </p>
                  </>
                ) : (
                  <p>
                    El QR no está disponible. Solicítalo al negocio por WhatsApp
                    antes de pagar.
                  </p>
                )}
                <div className="order-proof">
                  <ShieldCheck size={20} />
                  <p>
                    Adjunta el comprobante en el chat. El negocio verificará el
                    pago y confirmará tu pedido.
                  </p>
                </div>
                <button
                  className="order-whatsapp"
                  disabled={
                    busy || loading || lines.some((l) => !l.product.available)
                  }
                  onClick={send}
                >
                  <MessageCircle size={20} />
                  {busy ? "Preparando pedido…" : "Pedir por WhatsApp"}
                </button>
                <small className="order-send-note">
                  Se abrirá el chat con tu pedido escrito. Pulsa Enviar en
                  WhatsApp y adjunta el comprobante manualmente.
                </small>
              </aside>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
