import { Brand } from "../../components/Brand";
import { ScanLine, ShieldCheck, ArrowLeft } from "lucide-react";
import { Modal } from "../../components/Modal";
import { money } from "../../lib/format";
import { qrUrl, type PaymentSettings } from "../../services/payments";

export function PaymentQRDisplay({
  settings,
  amount,
  onClose,
}: {
  settings: PaymentSettings;
  amount: number;
  onClose: () => void;
}) {
  return (
    <Modal
      title="QR de cobro para el cliente"
      className="customer-qr-dialog"
      onClose={onClose}
    >
      <div className="customer-qr-image">
        <img
          src={qrUrl(settings.qr_path)}
          alt="QR oficial del negocio para escanear"
        />
      </div>
      <div className="customer-qr-details">
        <Brand />
        <span className="qr-official">
          <ShieldCheck size={16} /> QR oficial del negocio
        </span>
        <h2>
          Un último paso.
          <br />
          <em>Y a disfrutar.</em>
        </h2>
        <p className="qr-scan-hint">
          <ScanLine size={20} /> Escanea el QR con tu banco
        </p>
        <div className="qr-amount-card">
          <span>IMPORTE POR QR</span>
          <strong className="customer-qr-amount">{money(amount)}</strong>
        </div>
        <span className="qr-recipient-label">CUENTA DEL NEGOCIO</span>
        <p className="customer-qr-recipient">{settings.recipient}</p>
        <p className="muted">
          Verifica el titular y el importe en tu aplicación bancaria.
        </p>
        <button className="primary" onClick={onClose}>
          <ArrowLeft size={18} /> Volver al cobro
        </button>
      </div>
    </Modal>
  );
}
