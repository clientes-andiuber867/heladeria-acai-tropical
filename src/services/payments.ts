import {
  createContext,
  createElement,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/format";
import { generateUUID } from "../lib/uuid";
export type PaymentSettings = {
  qr_path: string;
  recipient: string;
  version: string;
};
export const qrUrl = (path: string) =>
  supabase.storage.from("payment-qr").getPublicUrl(path).data.publicUrl;
function usePaymentState() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    setError(error ? errorMessage(error) : "");
    if (!error) setSettings(data);
  }, []);
  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel("payments-" + generateUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_settings" },
        () => void refresh(),
      )
      .subscribe();
    window.addEventListener("focus", refresh);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return { settings, error, refresh };
}
const PaymentContext = createContext<ReturnType<typeof usePaymentState> | null>(
  null,
);
export function PaymentsProvider({ children }: { children: ReactNode }) {
  return createElement(
    PaymentContext.Provider,
    { value: usePaymentState() },
    children,
  );
}
export function usePayments() {
  const context = useContext(PaymentContext);
  if (!context) throw new Error("Falta el proveedor de pagos.");
  return context;
}
export async function savePaymentQR(
  file: File | null,
  recipient: string,
  currentPath?: string,
) {
  let path = currentPath;
  if (file) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5242880
    )
      throw new Error("Usa PNG, JPG o WebP de hasta 5 MB.");
    path = `${generateUUID()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage
      .from("payment-qr")
      .upload(path, file, { upsert: false });
    if (error) throw error;
  }
  if (!path) throw new Error("Selecciona la imagen del QR de tu banco.");
  const { error } = await supabase.rpc("configure_payment_qr", {
    p_path: path,
    p_recipient: recipient.trim(),
  });
  if (error) throw error;
}
