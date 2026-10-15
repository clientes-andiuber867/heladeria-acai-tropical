import { branchId } from "../lib/branch";
import {
  createContext,
  createElement,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/format";
import { generateUUID } from "../lib/uuid";
import { usePageVisible } from "../lib/visibility";
export type PaymentSettings = {
  qr_path: string;
  recipient: string;
  version: string;
};
export const qrUrl = (path: string) =>
  supabase.storage.from("payment-qr").getPublicUrl(path).data.publicUrl;
function usePaymentState(enabled: boolean) {
  const revision = useRef(0);
  const [settings, setSettings] = useState<PaymentSettings | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    const { data, error } = await supabase
      .from("payment_settings")
      .select("qr_path,recipient,version")
      .eq("branch_id", branchId())
      .eq("id", 1)
      .maybeSingle();
    if (request !== revision.current) return;
    setError(error ? errorMessage(error) : "");
    if (!error) setSettings(data);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const channel = supabase
      .channel("payments-" + generateUUID())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_settings",
          filter: `branch_id=eq.${branchId()}`,
        },
        () => void refresh(),
      )
      .subscribe();
    window.addEventListener("focus", refresh);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, enabled]);
  return { settings, error, refresh };
}
const PaymentContext = createContext<
  (ReturnType<typeof usePaymentState> & { register: () => () => void }) | null
>(null);
export function PaymentsProvider({ children }: { children: ReactNode }) {
  const [consumers, setConsumers] = useState(0);
  const register = useCallback(() => {
    setConsumers((n) => n + 1);
    return () => setConsumers((n) => n - 1);
  }, []);
  const state = usePaymentState(consumers > 0);
  return createElement(
    PaymentContext.Provider,
    { value: { ...state, register } },
    children,
  );
}
export function usePayments() {
  const context = useContext(PaymentContext);
  const visible = usePageVisible();
  const register = context?.register;
  useEffect(() => {
    if (visible && register) return register();
  }, [visible, register]);
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
