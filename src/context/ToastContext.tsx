import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
const Context = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  return (
    <Context.Provider
      value={(text, error = false) => setToast({ text, error })}
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <button
            className="icon"
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
