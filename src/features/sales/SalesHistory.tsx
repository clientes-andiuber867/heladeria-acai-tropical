import { useEffect, useState } from "react";
import {
  ReceiptText,
  Download,
  Wallet,
  ScanLine,
  ArrowUpRight,
  CheckCircle2,
  Ban,
  UserRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DateFilter } from "../../components/DateFilter";
import { Loading, ErrorState, Empty } from "../../components/States";
import {
  getSales,
  getCollectionTotals,
  type CollectionTotals,
} from "../../services/sales";
import { day, stamp, orderCode, money, errorMessage } from "../../lib/format";
import { Receipt } from "./Receipt";
import type { Sale } from "../../types";
export function SalesHistory() {
  const { profile } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const isAdmin = profile?.role === "admin";
  const [today, setToday] = useState(day(new Date()));
  useEffect(() => {
    const update = () => setToday(day(new Date()));
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [totals, setTotals] = useState<CollectionTotals | null>(null);
  const [updating, setUpdating] = useState(false);
  const [dates, setDates] = useState({
      from: day(new Date()),
      to: day(new Date()),
    }),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Sale[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Sale | null>(null);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event.type === "focus" || (event as CustomEvent).detail === "history")
        setRevision((v) => v + 1);
    };
    window.addEventListener("section-active", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("section-active", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!dates.from || !dates.to || dates.from > dates.to) return;
    let active = true;

    setUpdating(true);
    Promise.all([
      getSales(
        isAdmin ? dates.from : today,
        isAdmin ? dates.to : today,
        page,
        method,
        status,
      ),
      getCollectionTotals(
        isAdmin ? dates.from : today,
        isAdmin ? dates.to : today,
        method,
        status,
      ),
    ])
      .then(([r, t]) => {
        if (active) {
          setTotals(t);
          setRows(r.rows);
          setCount(r.count);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setUpdating(false);
        }
      });
    return () => {
      active = false;
    };
  }, [dates, page, revision, method, status, isAdmin, today]);
  async function exportExcel() {
    if (!isAdmin || exporting) return;
    setExporting(true);
    setExportError("");
    const filters = { ...dates, method, status };
    try {
      const [{ getSalesForExport }, { downloadSalesWorkbook }] =
        await Promise.all([
          import("../../services/salesExport"),
          import("./exportWorkbook"),
        ]);
      await downloadSalesWorkbook(await getSalesForExport(filters), filters);
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA PEDIDO TIENE SU HISTORIA</span>
          <h1>Ventas registradas</h1>
          <p className="muted">
            Controla los cobros por efectivo y QR, consulta comprobantes y
            revisa ventas anuladas.
          </p>
        </div>
        {isAdmin && (
          <button
            className="export-excel-button"
            disabled={
              exporting || !dates.from || !dates.to || dates.from > dates.to
            }
            onClick={exportExcel}
          >
            <Download size={18} />
            {exporting ? "Preparando Excel…" : "Exportar a Excel"}
          </button>
        )}
      </div>
      {exportError && (
        <p className="error" role="alert">
          {exportError}
        </p>
      )}
      {isAdmin ? (
        <DateFilter
          {...dates}
          onChange={(from, to) => {
            setDates({ from, to });
            setPage(0);
          }}
        />
      ) : (
        <p className="today-only">
          Tus ventas de hoy · {today.split("-").reverse().join("/")} · Horario
          de Bolivia
        </p>
      )}
      <div className="management-filters">
        <label>
          Forma de pago
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            <option>Efectivo</option>
            <option>QR</option>
            <option>Mixto</option>
          </select>
        </label>
        <label>
          Estado de venta
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            <option value="completed">Completadas</option>
            <option value="voided">Anuladas</option>
          </select>
        </label>
        <span className="muted" role="status">
          {updating
            ? "Actualizando cobros…"
            : "Importes del período y filtros seleccionados"}
        </span>
      </div>
      {totals && !error && (
        <div className="collection-summary" aria-busy={updating}>
          <div>
            <span>Cobrado en ventas completadas</span>
            <strong>{money(totals.collected)}</strong>
          </div>
          <div>
            <span>Efectivo neto de cambio</span>
            <strong>{money(totals.cash)}</strong>
          </div>
          <div>
            <span>Registrado por QR</span>
            <strong>{money(totals.qr)}</strong>
          </div>
          <div>
            <span>Ventas anuladas</span>
            <strong>{totals.voided}</strong>
          </div>
        </div>
      )}
      <p className="fine-print">
        Los cobros excluyen ventas anuladas. El importe QR registrado debe
        contrastarse con los abonos del banco; no es un cierre ni un arqueo de
        caja.
      </p>
      {error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : loading ? (
        <Loading />
      ) : (
        <section className="panel sales-ledger">
          <header className="ledger-heading">
            <div className="insight-heading">
              <span className="insight-icon">
                <ReceiptText size={23} />
              </span>
              <div>
                <span className="insight-kicker">REGISTRO DE CAJA</span>
                <h2>El detalle de cada venta</h2>
              </div>
            </div>
            <span className="ledger-count">
              {count} {count === 1 ? "venta" : "ventas"} en el período
            </span>
          </header>
          <div className="ledger-list">
            {rows.map((s) => (
              <article
                key={s.id}
                className={`ledger-entry ${s.status === "voided" ? "ledger-void" : ""}`}
              >
                <div className="ledger-order">
                  <span className="ledger-receipt-icon">
                    <ReceiptText size={23} />
                  </span>
                  <div>
                    <span className="ledger-label">PEDIDO</span>
                    <h3>{orderCode(s)}</h3>
                    <time dateTime={s.created_at}>{stamp(s.created_at)}</time>
                  </div>
                </div>
                <div className="ledger-products">
                  <span className="ledger-label">LO QUE SE VENDIÓ</span>
                  <p>
                    {s.sale_items
                      .slice(0, 2)
                      .map((i) => `${i.quantity} × ${i.product_name}`)
                      .join(" · ")}
                    {s.sale_items.length > 2
                      ? ` · +${s.sale_items.length - 2} más`
                      : ""}
                  </p>
                  <span className="ledger-person">
                    <UserRound size={13} />
                    {s.cashier_name}
                  </span>
                </div>
                <div className="ledger-payment">
                  <span
                    className={`ledger-method method-${s.payment_method === "Efectivo" ? "cash" : s.payment_method === "QR" ? "qr" : "mixed"}`}
                  >
                    {s.payment_method === "Efectivo" ? (
                      <Wallet size={15} />
                    ) : (
                      <ScanLine size={15} />
                    )}{" "}
                    {s.payment_method}
                  </span>
                  {s.payment_method === "Mixto" && (
                    <small>
                      Efectivo {money(s.cash_amount)}
                      <br />
                      QR {money(s.qr_amount)}
                    </small>
                  )}
                  <span className={`ledger-status ${s.status}`}>
                    {s.status === "completed" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Ban size={13} />
                    )}
                    {s.status === "completed" ? "Completada" : "Anulada"}
                  </span>
                </div>
                <div className="ledger-total">
                  <span className="ledger-label">TOTAL</span>
                  <strong>{money(s.total)}</strong>
                  <button
                    className="ledger-detail"
                    aria-label={`Ver detalle del pedido ${orderCode(s)}`}
                    onClick={() => setSelected(s)}
                  >
                    Ver detalle <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!rows.length && <Empty title="No hay ventas en este período" />}
          <div className="pagination ledger-pagination">
            <span>
              {count
                ? `${page * 20 + 1}–${Math.min((page + 1) * 20, count)} de ${count} ventas`
                : "Sin movimientos"}
            </span>
            <button
              className="secondary"
              disabled={page === 0}
              onClick={() => setPage((n) => n - 1)}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="ledger-page">
              {page + 1} / {Math.max(1, Math.ceil(count / 20))}
            </span>
            <button
              className="secondary"
              disabled={(page + 1) * 20 >= count}
              onClick={() => setPage((n) => n + 1)}
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </section>
      )}
      {selected && (
        <Receipt
          sale={selected}
          onClose={() => setSelected(null)}
          onVoided={() => setRevision((n) => n + 1)}
        />
      )}
    </>
  );
}
