import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "./Modal";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const mode = matchMedia("(display-mode: standalone)");
    const sync = () =>
      setInstalled(
        mode.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    sync();
    mode.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      mode.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setHelp(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  if (installed) return null;
  return (
    <>
      <button className="install-app-button" onClick={install} disabled={busy}>
        <Download size={17} />
        {busy ? "Abriendo…" : "Instalar aplicación"}
      </button>
      {help && (
        <Modal title="Instalar Açaí Tropical" onClose={() => setHelp(false)}>
          <img
            src="/icons/acai-192.png"
            alt="Açaí Tropical"
            width="64"
            height="64"
          />
          <h2>Tu negocio, a un toque</h2>
          <p>El acceso llevará el nombre y el logo de Açaí Tropical.</p>
          <p>
            <strong>Chrome o Edge:</strong> abre el menú del navegador y busca
            «Instalar Açaí Tropical» o «Instalar esta página como aplicación».
            También puedes usar «Crear acceso directo».
          </p>
          <p>
            <strong>iPhone o iPad:</strong> abre esta página en Safari, pulsa
            Compartir y «Añadir a pantalla de inicio».
          </p>
          <p className="fine-print">
            Para usarlo fuera de esta computadora, instala desde la dirección
            publicada del negocio. Las ventas requieren conexión a internet.
          </p>
        </Modal>
      )}
    </>
  );
}
