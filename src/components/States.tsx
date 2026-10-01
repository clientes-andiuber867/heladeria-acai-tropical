import { LoaderCircle, RefreshCw, Flower2 } from "lucide-react";
export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="empty loading-state" role="status">
      <LoaderCircle className="spin" size={30} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="secondary" onClick={retry}>
          <RefreshCw size={16} /> Reintentar
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Flower2 size={34} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
