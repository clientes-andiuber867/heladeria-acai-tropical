import { useState, useRef } from "react";
import { Printer, Ban } from "lucide-react";
import { Modal } from "../../components/Modal";
import { printReceipt } from "../../lib/printReceipt";
import "./receipt.css";
import { orderCode, money, errorMessage } from "../../lib/format";
import { voidSale } from "../../services/sales";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type { Sale } from "../../types";
export function Receipt({
  sale,
  onClose,
  onVoided,
}: {
  sale: Sale;
  onClose: () => void;
  onVoided?: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const issued = new Date(sale.created_at);
  async function print() {
    setPrinting(true);
    try {
      await printReceipt(receiptRef.current!);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setPrinting(false);
    }
  }
  const [reason, setReason] = useState(""),
    [voiding, setVoiding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function cancel() {
    setBusy(true);
    try {
      await voidSale(sale.id, reason);
      toast("Venta anulada. El motivo quedó en auditoría.");
      onVoided?.();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Detalle de venta"
      onClose={onClose}
      busy={busy}
      className="receipt-dialog"
    >
      <div className="sale-document" ref={receiptRef}>
        <header className="document-header">
          <div className="document-brand">
            <img src="/logo.png" alt="Açaí Tropical" />
            <div>
              <strong>Açaí Tropical</strong>
              <span>Comprobante de venta</span>
            </div>
          </div>
          <div className="document-number">
            <strong>{orderCode(sale)}</strong>
            <span>{sale.status === "voided" ? "ANULADO" : "PAGADO"}</span>
          </div>
        </header>
        <div className="document-meta">
          <div>
            <span>Fecha de emisión</span>
            <strong>
              {issued.toLocaleDateString("es-BO", {
                timeZone: "America/La_Paz",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </strong>
          </div>
          <div>
            <span>Hora de emisión · Bolivia</span>
            <strong>
              {issued.toLocaleTimeString("es-BO", {
                timeZone: "America/La_Paz",
                hourCycle: "h23",
              })}
            </strong>
          </div>
          <div>
            <span>Atendido por</span>
            <strong>{sale.cashier_name}</strong>
          </div>
          <div>
            <span>Forma de pago</span>
            <strong>{sale.payment_method}</strong>
          </div>
        </div>
        <table className="document-items">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Descripción</th>
              <th>Precio</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {sale.sale_items.map((i, n) => (
              <tr key={n}>
                <td>{i.quantity}</td>
                <td>{i.product_name}</td>
                <td>{money(i.unit_price)}</td>
                <td>{money(i.quantity * i.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="document-summary">
          <div>
            <span>Efectivo aplicado</span>
            <strong>{money(sale.cash_amount)}</strong>
          </div>
          <div>
            <span>Pago por QR</span>
            <strong>{money(sale.qr_amount)}</strong>
          </div>
          <div className="document-total">
            <span>Total de la venta</span>
            <strong>{money(sale.total)}</strong>
          </div>
          {sale.cash_amount > 0 && (
            <>
              <div>
                <span>Efectivo recibido</span>
                <strong>{money(sale.cash_received || 0)}</strong>
              </div>
              <div>
                <span>Cambio entregado</span>
                <strong>
                  {money((sale.cash_received || 0) - sale.cash_amount)}
                </strong>
              </div>
            </>
          )}
        </div>
        {sale.qr_recipient && (
          <p className="document-note">
            <b>Titular QR:</b> {sale.qr_recipient}
          </p>
        )}
        {sale.note && (
          <p className="document-note">
            <b>Observación:</b> {sale.note}
          </p>
        )}
        {sale.void_reason && (
          <p className="document-note">
            <b>Motivo de anulación:</b> {sale.void_reason}
          </p>
        )}
        <footer className="document-footer">
          <strong>Gracias por tu visita</strong>
          <span>Comprobante interno · No válido como factura fiscal</span>
        </footer>
      </div>
      <div className="button-row no-print">
        <button className="secondary" onClick={print} disabled={printing}>
          <Printer size={16} /> {printing ? "Preparando…" : "Imprimir"}
        </button>
        <button className="primary" onClick={onClose}>
          Continuar
        </button>
      </div>
      {profile?.role === "admin" && sale.status === "completed" && (
        <div className="archive-area no-print">
          {!voiding ? (
            <button className="text-button" onClick={() => setVoiding(true)}>
              <Ban size={16} /> Anular venta
            </button>
          ) : (
            <>
              <label>
                Motivo de anulación
                <textarea
                  minLength={5}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explica por qué se anula esta venta"
                />
              </label>
              <p className="fine-print">
                La anulación ajusta los ingresos; cualquier devolución de dinero
                se realiza por separado.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="danger-button"
                disabled={busy || reason.trim().length < 5}
                onClick={cancel}
              >
                {busy ? "Anulando…" : "Confirmar anulación"}
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
