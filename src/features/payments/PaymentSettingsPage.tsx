import { useEffect, useState, type FormEvent } from "react";
import { usePayments, qrUrl, savePaymentQR } from "../../services/payments";
import { errorMessage } from "../../lib/format";
export function PaymentSettingsPage() {
  const { settings, error: loadError, refresh } = usePayments();
  const [recipient, setRecipient] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setRecipient(settings?.recipient || "");
  }, [settings?.recipient]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await savePaymentQR(file, recipient, settings?.qr_path);
      await refresh();
      setFile(null);
      setMessage("QR de cobro actualizado para todas las cajas.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">COBROS DEL NEGOCIO</span>
          <h1>Configurar pagos</h1>
          <p className="muted">
            Solo el administrador puede cambiar el QR que muestra la caja.
          </p>
        </div>
      </div>
      <form className="panel payment-settings" onSubmit={save}>
        <h2>QR oficial de cobro</h2>
        <p>
          Sube el QR de tu banco que permite al cliente ingresar el importe.
          Verifica que pertenezca a tu cuenta antes de guardarlo.
        </p>
        <label>
          Titular / banco
          <input
            required
            minLength={2}
            maxLength={100}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Imagen QR del banco
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        {(preview || settings) && (
          <img
            className="bank-qr"
            src={preview || qrUrl(settings!.qr_path)}
            alt="Vista previa del QR de cobro"
          />
        )}
        <p className="fine-print">
          PNG, JPG o WebP · Hasta 5 MB. Se conserva el QR asociado a cada venta
          para auditoría.
        </p>
        {(error || loadError) && (
          <p role="alert" className="error">
            {error || loadError}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar QR de cobro"}
        </button>
      </form>
    </>
  );
}
