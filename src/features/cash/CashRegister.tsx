import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Wallet, LockKeyhole } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/Modal";
import { day, money, stamp, errorMessage } from "../../lib/format";
import {
  currentShift,
  openShift,
  closeShift,
  recentShifts,
  type CashShift,
} from "../../services/cash";
import { supabase } from "../../lib/supabase";
export function CashRegister({
  onReady,
  blocked,
  revision,
}: {
  onReady: (ready: boolean) => void;
  blocked: boolean;
  revision: string;
}) {
  const { profile } = useAuth();
  const [shift, setShift] = useState<CashShift | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"open" | "close" | null>(null),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [closed, setClosed] = useState<CashShift | null>(null),
    [history, setHistory] = useState<Awaited<
      ReturnType<typeof recentShifts>
    > | null>(null);
  const refresh = useCallback(async () => {
    try {
      const s = await currentShift(profile!.id);
      setShift(s);
      onReady(!!s && day(new Date(s.opened_at)) === day(new Date()));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      onReady(false);
    } finally {
      setLoading(false);
    }
  }, [profile!.id, onReady]);
  useEffect(() => {
    void refresh();
  }, [refresh, revision]);
  useEffect(() => {
    const ch = supabase
      .channel("cash-register-" + profile!.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_shifts",
          filter: `cashier_id=eq.${profile!.id}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `cashier_id=eq.${profile!.id}`,
        },
        () => void refresh(),
      )
      .subscribe();

    window.addEventListener("focus", refresh);
    return () => {
      void supabase.removeChannel(ch);

      window.removeEventListener("focus", refresh);
    };
  }, [refresh, profile!.id]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (shift && day(new Date(shift.opened_at)) !== day(new Date()))
        onReady(false);
    }, 15000);
    return () => clearInterval(tick);
  }, [shift, onReady]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "open") {
        await openShift(Number(amount));
        setClosed(null);
      } else if (shift) {
        setClosed(await closeShift(shift.id, Number(amount), note));
      }
      await refresh();
      setMode(null);
      setHistory(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cash-register panel">
      <div className="cash-register-top">
        <div>
          <h3>
            <Wallet size={20} />{" "}
            {loading
              ? "Consultando caja…"
              : shift
                ? "Caja abierta"
                : "Caja cerrada"}
          </h3>
          <p>
            {shift
              ? `Abierta: ${stamp(shift.opened_at)} · Fondo: ${money(shift.opening_cash)}`
              : "Abre tu caja con el efectivo inicial antes de vender."}
          </p>
        </div>
        <button
          className="primary"
          disabled={loading || busy || (blocked && !!shift)}
          onClick={() => {
            setAmount("");
            setNote("");
            setError("");
            setMode(shift ? "close" : "open");
            void refresh();
          }}
        >
          <LockKeyhole size={16} />
          {shift ? "Cerrar caja" : "Abrir caja"}
        </button>
      </div>
      {shift && (
        <>
          <div className="cash-register-totals">
            <span>
              Efectivo esperado <b>{money(shift.expected_cash)}</b>
            </span>
            <span>
              Ventas en efectivo <b>{money(shift.cash_sales)}</b>
            </span>
            <span>
              Ventas por QR <b>{money(shift.qr_sales)}</b>
            </span>
          </div>
          {day(new Date(shift.opened_at)) !== day(new Date()) && (
            <p className="error">
              Esta caja es de un día anterior. Ciérrala para abrir la de hoy.
            </p>
          )}
        </>
      )}
      {blocked && (
        <p className="fine-print">
          Termina o retira el pedido pendiente antes de cerrar caja.
        </p>
      )}
      {closed && (
        <p role="status">
          Caja cerrada. Contado: {money(closed.counted_cash || 0)} · Esperado:{" "}
          {money(closed.expected_cash)} · Diferencia:{" "}
          {money(closed.difference || 0)}.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {profile?.role === "admin" && (
        <>
          <button
            className="text-button"
            onClick={async () => {
              try {
                setHistory(history ? null : await recentShifts());
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            {history ? "Ocultar cajas" : "Ver últimas 20 cajas del equipo"}
          </button>
          {history && (
            <div className="cash-history">
              {history.map((s) => (
                <article key={s.id}>
                  <strong>
                    {s.profiles.display_name} ·{" "}
                    {s.status === "open" ? "Abierta" : "Cerrada"}
                  </strong>
                  <small>
                    {stamp(s.opened_at)}
                    {s.closed_at ? ` → ${stamp(s.closed_at)}` : ""}
                  </small>
                  <p>
                    Fondo: {money(s.opening_cash)}
                    {s.status === "closed"
                      ? ` · Esperado: ${money(s.expected_cash)} · Contado: ${money(s.counted_cash || 0)} · Diferencia: ${money(s.difference || 0)}`
                      : ""}
                  </p>
                  {s.closing_note && <p>{s.closing_note}</p>}
                </article>
              ))}
              {!history.length && <p>No hay cajas registradas.</p>}
            </div>
          )}
        </>
      )}
      {mode && (
        <Modal
          title={mode === "open" ? "Abrir caja" : "Cerrar caja"}
          busy={busy}
          onClose={() => setMode(null)}
        >
          <h2>
            {mode === "open" ? "Abrir caja" : "Cierre y conteo de efectivo"}
          </h2>
          <p>
            {mode === "open"
              ? "Registra el dinero disponible para dar cambio. No cuenta como venta."
              : `Efectivo esperado: ${money(shift?.expected_cash || 0)}. Cuenta el dinero físico e indica cuánto hay.`}
          </p>
          <form onSubmit={submit}>
            <label>
              {mode === "open" ? "Fondo inicial (Bs)" : "Efectivo contado (Bs)"}
              <input
                required
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {mode === "close" && (
              <>
                <p>
                  Diferencia:{" "}
                  {money(Number(amount) - (shift?.expected_cash || 0))}
                </p>
                <label>
                  Observación del cierre
                  <textarea
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Explica cualquier diferencia de efectivo"
                  />
                </label>
                <p className="fine-print">
                  El QR no forma parte del efectivo físico. No podrás anular
                  ventas de una caja ya cerrada. Cerrar el navegador no cierra
                  la caja.
                </p>
              </>
            )}
            {error && <p className="error">{error}</p>}
            <button
              className="primary full"
              disabled={busy || (blocked && mode === "close")}
            >
              {busy
                ? "Guardando…"
                : mode === "open"
                  ? "Confirmar apertura"
                  : "Confirmar cierre"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
