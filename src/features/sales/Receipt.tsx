import { useState } from "react";
import { Check, Printer, Ban } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Brand } from "../../components/Brand";
import { money, stamp, errorMessage } from "../../lib/format";
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
    <Modal title="Detalle de venta" onClose={onClose} busy={busy}>
      <div className="receipt printable">
        <Brand />
        <span className="success-icon">
          <Check size={28} />
        </span>
        <h2>
          {sale.status === "voided" ? "Venta anulada" : "Venta registrada"}
        </h2>
        <p>Pedido #{sale.id.slice(0, 8).toUpperCase()}</p>
        <p>
          {stamp(sale.created_at)} · {sale.cashier_name}
        </p>
        {sale.sale_items.map((i, n) => (
          <div className="receipt-row" key={n}>
            <span>
              {i.quantity} × {i.product_name}
            </span>
            <strong>{money(i.quantity * i.unit_price)}</strong>
          </div>
        ))}
        <div className="order-total">
          <span>Total · {sale.payment_method}</span>
          <strong>{money(sale.total)}</strong>
        </div>
        <p>
          Efectivo: {money(sale.cash_amount)} · QR: {money(sale.qr_amount)}
        </p>
        {sale.qr_recipient && <p>Destino QR: {sale.qr_recipient}</p>}
        {sale.cash_amount > 0 && (
          <p>
            Recibido: {money(sale.cash_received || 0)} · Cambio:{" "}
            {money((sale.cash_received || 0) - sale.cash_amount)}
          </p>
        )}
        {sale.note && <p>Nota: {sale.note}</p>}
        {sale.void_reason && (
          <p className="error">Motivo de anulación: {sale.void_reason}</p>
        )}
        <p className="fine-print">
          Comprobante interno · No válido como factura fiscal
        </p>
      </div>
      <div className="button-row no-print">
        <button className="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
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
