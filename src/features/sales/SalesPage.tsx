import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Wallet,
  ScanLine,
  Check,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";
import { ProductCatalog } from "../catalog/ProductCatalog";
import { PaymentQRDisplay } from "../payments/PaymentQRDisplay";
import { CashRegister } from "../cash/CashRegister";
import { Receipt } from "./Receipt";
import { useAuth } from "../../context/AuthContext";
import { useCatalog } from "../../context/CatalogContext";
import { useToast } from "../../context/ToastContext";
import { money, errorMessage } from "../../lib/format";
import { completeSale } from "../../services/sales";
import type { CartItem, Product, Sale } from "../../types";
import { usePayments, qrUrl } from "../../services/payments";
import { generateUUID } from "../../lib/uuid";
type Pending = Parameters<typeof completeSale>[0];
export function SalesPage() {
  const {
    settings,
    error: paymentError,
    refresh: refreshPayments,
  } = usePayments();
  const [cashReady, setCashReady] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");
  const { profile } = useAuth();
  const { products, refresh } = useCatalog();
  const toast = useToast();
  const storageKey = `acai.pending.${profile!.id}`;
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  });
  const [cashPart, setCashPart] = useState(
    pending?.cashAmount?.toString() || "",
  );
  const [items, setItems] = useState<CartItem[]>(pending?.items || []),
    [method, setMethod] = useState<"Efectivo" | "QR" | "Mixto">(
      pending?.method || "Efectivo",
    ),
    [cash, setCash] = useState(pending?.cash?.toString() || ""),
    [note, setNote] = useState(pending?.note || ""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const total =
    items.reduce(
      (n, i) => n + Math.round(i.product.price * 100) * i.quantity,
      0,
    ) / 100;
  const cashAmount =
    method === "Mixto" ? Number(cashPart) : method === "Efectivo" ? total : 0;
  const qrAmount = Math.round((total - cashAmount) * 100) / 100;
  useEffect(() => {
    setConfirmed(false);
  }, [total, method, cashPart, settings?.version]);
  const locked = busy || !!pending;
  function add(p: Product) {
    if (locked || !cashReady) return;
    setItems((current) => {
      const exists = current.find((i) => i.product.id === p.id);
      if (exists)
        return current.map((i) =>
          i.product.id === p.id
            ? { ...i, quantity: Math.min(999, i.quantity + 1) }
            : i,
        );
      return [...current, { product: p, quantity: 1 }];
    });
  }
  function qty(id: string, delta: number) {
    setItems((current) =>
      current
        .map((i) =>
          i.product.id === id
            ? { ...i, quantity: Math.min(999, i.quantity + delta) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }
  async function checkout() {
    if (submitting.current) return;
    if (!pending) {
      if (!cashReady) {
        toast("Abre caja antes de registrar ventas.", true);
        return;
      }
      if (!items.length) return;
      if (
        items.some(
          (i) => !products.find((p) => p.id === i.product.id && p.available),
        )
      ) {
        toast("Hay productos agotados en el pedido.", true);
        return;
      }
      if (
        method !== "QR" &&
        (!Number.isFinite(Number(cash)) || Number(cash) < cashAmount)
      ) {
        toast("El efectivo recibido debe cubrir el total.", true);
        return;
      }
      if (
        method === "Mixto" &&
        (!Number.isFinite(cashAmount) ||
          cashAmount <= 0 ||
          qrAmount <= 0 ||
          Math.abs(cashAmount * 100 - Math.round(cashAmount * 100)) > 0.00001)
      ) {
        toast(
          "Indica una parte en efectivo mayor a cero y menor al total, con dos decimales.",
          true,
        );
        return;
      }
      if (method !== "Efectivo" && (!settings || paymentError)) {
        toast("El administrador debe configurar el QR de cobro.", true);
        return;
      }
      if (method !== "Efectivo" && !confirmed) {
        toast(
          "Verifica el pago en la cuenta del negocio antes de confirmar.",
          true,
        );
        return;
      }
    }
    const payload = pending || {
      requestId: generateUUID(),
      items,
      method,
      cash: method !== "QR" ? Number(cash) : null,
      cashAmount,
      qrAmount,
      qrVersion: method !== "Efectivo" ? settings?.version : undefined,
      note,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      toast(
        "No se pudo asegurar el pedido en este navegador. Habilita el almacenamiento.",
        true,
      );
      return;
    }
    setPending(payload);
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const sale = await completeSale(payload);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setReceipt(sale);
      setItems([]);
      setCash("");
      setCashPart("");
      setNote("");
      setConfirmed(false);
      setMobileTab("catalog");
      void refresh();
      toast("Venta guardada correctamente.");
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      const knownRejection =
        typeof e === "object" &&
        e &&
        "code" in e &&
        ["P0001", "22P02", "23514", "42501"].includes(String(e.code));
      if (knownRejection) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
        void refresh();
        void refreshPayments();
        setConfirmed(false);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA PEDIDO, UNA SONRISA</span>
          <h1>Vamos a servir felicidad</h1>
          <p className="muted">Elige, prepara y registra. Así de simple.</p>
        </div>
        <span className="live-badge">Caja · {profile?.display_name}</span>
      </div>
      <CashRegister
        onReady={setCashReady}
        blocked={busy || !!pending || items.length > 0}
        revision={receipt?.id || ""}
      />
      <div className="pos-mobile-nav">
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === "catalog" ? "active" : ""}`}
          onClick={() => setMobileTab("catalog")}
        >
          <UtensilsCrossed size={17} />
          <span>Carta</span>
        </button>
        <button
          type="button"
          className={`pos-mobile-tab ${mobileTab === "cart" ? "active" : ""}`}
          onClick={() => setMobileTab("cart")}
        >
          <ShoppingBag size={17} />
          <span>Pedido</span>
          {items.length > 0 && (
            <span className="pos-tab-badge">
              {items.reduce((n, i) => n + i.quantity, 0)}
            </span>
          )}
          {total > 0 && <span className="pos-tab-price">{money(total)}</span>}
        </button>
      </div>
      <div className="pos">
        <section
          className={`pos-catalog ${mobileTab !== "catalog" ? "pos-mobile-hidden" : ""}`}
        >
          <ProductCatalog onAdd={locked || !cashReady ? undefined : add} />
        </section>
        <aside
          className={`cart panel ${mobileTab !== "cart" ? "pos-mobile-hidden" : ""}`}
        >
          <button
            type="button"
            className="mobile-back-catalog text-button"
            onClick={() => setMobileTab("catalog")}
          >
            ← Volver a la carta para agregar más
          </button>
          <div className="panel-heading">
            <h3>Nuevo pedido</h3>
            <span className="pill">
              {items.reduce((n, i) => n + i.quantity, 0)} artículos
            </span>
          </div>
          {items.length ? (
            <div className="cart-items">
              {items.map(({ product: p, quantity }) => (
                <div className="cart-item" key={p.id}>
                  <img src={p.image || "/logo.png"} alt="" loading="lazy" decoding="async" />
                  <div>
                    <strong>{p.name}</strong>
                    <small>{money(p.price)}</small>
                    <div className="stepper">
                      <button
                        disabled={locked}
                        aria-label={`Restar ${p.name}`}
                        onClick={() => qty(p.id, -1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        disabled={locked || quantity >= 999}
                        aria-label={`Sumar ${p.name}`}
                        onClick={() => qty(p.id, 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-end">
                    <button
                      disabled={locked}
                      className="icon"
                      aria-label={`Quitar ${p.name}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((i) => i.product.id !== p.id),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                    <b>{money(p.price * quantity)}</b>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty cart-empty">
              <ShoppingBag size={38} />
              <h3>Un antojo por comenzar</h3>
              <p>Agrega productos de la carta.</p>
            </div>
          )}
          <label>
            Nota / motivo del pedido
            <input
              disabled={locked}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Para llevar, sin granola…"
            />
          </label>
          <div className="order-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <label>Forma de pago</label>
          <div className="payment-options">
            <button
              disabled={locked}
              className={method === "Efectivo" ? "active" : ""}
              onClick={() => setMethod("Efectivo")}
            >
              <Wallet size={18} /> Efectivo
            </button>
            <button
              disabled={locked}
              className={method === "QR" ? "active" : ""}
              onClick={() => setMethod("QR")}
            >
              <ScanLine size={18} /> QR
            </button>
            <button
              disabled={locked}
              className={method === "Mixto" ? "active" : ""}
              onClick={() => setMethod("Mixto")}
            >
              Dividir
            </button>
          </div>
          {method === "Mixto" && (
            <label>
              Parte en efectivo (Bs)
              <input
                type="number"
                min="0.01"
                step="0.01"
                disabled={locked}
                value={cashPart}
                onChange={(e) => setCashPart(e.target.value)}
              />
              <span>Parte por QR: {money(Math.max(0, qrAmount))}</span>
            </label>
          )}
          {method !== "QR" && (
            <>
              <label>
                Efectivo recibido
                <input
                  disabled={locked}
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <div className="change">
                <span>Cambio</span>
                <strong>
                  {money(Math.max(0, (Number(cash) || 0) - cashAmount))}
                </strong>
              </div>
            </>
          )}
          {method !== "Efectivo" && (
            <>
              {settings && !paymentError ? (
                <div className="payment-qr">
                  <strong>QR oficial del negocio</strong>
                  <img
                    className="bank-qr"
                    src={qrUrl(settings.qr_path)}
                    alt="QR oficial para pagar al negocio"
                  />
                  <button
                    type="button"
                    className="primary full"
                    onClick={() => setShowQR(true)}
                  >
                    Mostrar QR en grande
                  </button>
                  <p>{settings.recipient}</p>
                  <strong>
                    A pagar por QR: {money(Math.max(0, qrAmount))}
                  </strong>
                </div>
              ) : (
                <p className="error">
                  {paymentError ||
                    "El administrador debe configurar el QR de cobro antes de recibir pagos por QR."}
                </p>
              )}
              <label className="check-label">
                <input
                  disabled={locked}
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                Verifiqué el pago en la cuenta del negocio.
              </label>
            </>
          )}
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
              {!pending && (
                <button
                  className="text-button"
                  onClick={() => {
                    setItems((current) =>
                      current.flatMap((i) => {
                        const p = products.find((p) => p.id === i.product.id);
                        return p && p.available
                          ? [{ product: p, quantity: i.quantity }]
                          : [];
                      }),
                    );
                    setError("");
                  }}
                >
                  <RefreshCw size={14} /> Actualizar pedido
                </button>
              )}
            </div>
          )}
          {pending && !busy && (
            <p className="pending-note">
              Estamos verificando este pedido. Reintenta para recuperar la misma
              venta, sin duplicarla.
            </p>
          )}
          <button
            className="primary full"
            disabled={
              (!pending && !cashReady) ||
              !items.length ||
              busy ||
              (!pending &&
                method !== "Efectivo" &&
                (!settings || !!paymentError))
            }
            onClick={checkout}
          >
            <Check size={18} />
            {busy
              ? "Guardando venta…"
              : pending
                ? "Verificar y recuperar venta"
                : "Confirmar venta"}
          </button>
          <p className="fine-print">
            {method !== "Efectivo"
              ? "El pago QR se verifica manualmente en tu banco."
              : "La venta quedará registrada con tu nombre, fecha y hora."}
          </p>
        </aside>
      </div>
      {showQR && settings && !paymentError && method !== "Efectivo" && (
        <PaymentQRDisplay
          settings={settings}
          amount={Math.max(0, qrAmount)}
          onClose={() => setShowQR(false)}
        />
      )}
      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
      {items.length > 0 && mobileTab === "catalog" && (
        <div className="pos-floating-bar">
          <div className="floating-info">
            <span className="floating-count">
              {items.reduce((n, i) => n + i.quantity, 0)}{" "}
              {items.reduce((n, i) => n + i.quantity, 0) === 1
                ? "artículo"
                : "artículos"}
            </span>
            <strong className="floating-total">{money(total)}</strong>
          </div>
          <button
            type="button"
            className="primary floating-btn"
            onClick={() => setMobileTab("cart")}
          >
            Ver pedido y cobrar →
          </button>
        </div>
      )}
    </>
  );
}
