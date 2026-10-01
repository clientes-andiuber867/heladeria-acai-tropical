import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, ScanLine, Sparkles } from "lucide-react";
import { Brand } from "../../components/Brand";
import { useToast } from "../../context/ToastContext";
import { generateBrandedQRCard } from "./qrCardGenerator";

export function QRPage() {
  const toast = useToast();
  const [qr, setQr] = useState("");
  const [cardDataUrl, setCardDataUrl] = useState("");
  const [downloading, setDownloading] = useState(false);

  const url = new URL(
    "/menu",
    import.meta.env.VITE_PUBLIC_SITE_URL || location.origin,
  ).href;

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 1000,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#45204F", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => toast("No se pudo generar el código QR.", true));

    generateBrandedQRCard(url)
      .then(setCardDataUrl)
      .catch((e) => console.error("Error generating card:", e));
  }, [url]);

  async function handleDownloadCard() {
    try {
      setDownloading(true);
      const dataUrl = cardDataUrl || (await generateBrandedQRCard(url));
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "carta-acai-tropical-diseno.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast("Diseño descargado en alta calidad.");
    } catch {
      toast("No se pudo descargar el diseño.", true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EL SABOR SE COMPARTE</span>
          <h1>Tu carta, siempre a mano</h1>
          <p className="muted">Un escaneo. Todos tus sabores.</p>
        </div>
      </div>
      <div className="qr-layout">
        <section className="qr-card">
          <Brand />
          <span className="eyebrow">ESCANEA, ELIGE Y DISFRUTA</span>
          <h2>
            Tu próximo favorito
            <br />
            está aquí.
          </h2>
          {qr && (
            <img className="qr-image" src={qr} alt="QR de la carta pública" />
          )}
          <span className="qr-caption">Nuestra carta digital</span>
          <p>Açaí · Helados · Comida · Postres</p>
        </section>
        <section className="panel qr-settings">
          <span className="small-icon">
            <ScanLine />
          </span>
          <h2>
            Siempre fresca.
            <br />
            Siempre actualizada.
          </h2>
          <p className="muted">
            Cada producto que agregues o edites se reflejará en la carta. Puedes
            mantener el mismo QR mientras conserves tu dirección web.
          </p>
          <label>
            Enlace para tus clientes
            <input readOnly value={url} />
          </label>
          <div className="button-row">
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast("Enlace copiado.");
                } catch {
                  toast("Selecciona y copia el enlace manualmente.", true);
                }
              }}
            >
              <Copy size={17} /> Copiar enlace
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="secondary"
            >
              <ExternalLink size={17} /> Ver carta
            </a>
          </div>
          <div className="button-row" style={{ marginTop: "12px" }}>
            <button
              className="primary"
              onClick={handleDownloadCard}
              disabled={downloading}
            >
              <Download size={17} />{" "}
              {downloading ? "Generando diseño…" : "Descargar diseño completo"}
            </button>
            {qr && (
              <a
                className="secondary"
                download="codigo-qr-acai.png"
                href={qr}
              >
                <Sparkles size={16} /> Solo QR
              </a>
            )}
          </div>
          <div className="info-box">
            <strong>Para compartir en tu local</strong>
            <p>
              {new URL(url).hostname === "localhost"
                ? "Esta dirección funciona en esta computadora. Al publicar en Vercel, genera el QR desde la dirección pública para tus clientes."
                : "Descarga el QR e imprímelo para tus mesas o mostrador. Los clientes pueden ver la carta sin iniciar sesión."}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
