import { useEffect, useState } from "react";
import {
  Plus,
  TrendingUp,
  ArrowUpRight,
  Receipt as ReceiptIcon,
  ShoppingBag,
  Leaf,
  Wallet,
  ScanLine,
} from "lucide-react";
import { DateFilter } from "../../components/DateFilter";
import { Loading, ErrorState, Empty } from "../../components/States";
import { getDashboard } from "../../services/sales";
import { useCatalog } from "../../context/CatalogContext";
import { day, money, stamp, errorMessage } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { ProductRanking } from "./ProductRanking";
import { Receipt } from "../sales/Receipt";
import type { DashboardData, Sale } from "../../types";
export function DashboardPage({
  onSell,
  onHistory,
}: {
  onSell: () => void;
  onHistory: () => void;
}) {
  const [rankingOpen, setRankingOpen] = useState(false);
  const { products } = useCatalog();
  const [dates, setDates] = useState({
      from: day(new Date()),
      to: day(new Date()),
    }),
    [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<Sale | null>(null);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (
        event.type === "focus" ||
        (event as CustomEvent).detail === "dashboard"
      )
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

    getDashboard(dates.from, dates.to)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dates, revision]);
  useEffect(() => {
    const c = supabase
      .channel("dashboard-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => setRevision((v) => v + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(c);
    };
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU NEGOCIO FLORECE AQUÍ</span>
          <h1>Un vistazo a tu día</h1>
          <p className="muted">Cada venta cuenta. Cada detalle suma.</p>
        </div>
        <button className="primary" onClick={onSell}>
          <Plus size={18} /> Nueva venta
        </button>
      </div>
      <DateFilter {...dates} onChange={(from, to) => setDates({ from, to })} />
      {error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : loading ? (
        <Loading label="Actualizando tus estadísticas…" />
      ) : (
        data && (
          <>
            <div className="stats">
              {[
                {
                  label: "Ingresos por ventas",
                  value: money(data.revenue),
                  icon: TrendingUp,
                  note: "Ventas completadas del período",
                },
                {
                  label: "Ventas realizadas",
                  value: data.orders,
                  icon: ReceiptIcon,
                  note: `${data.voided} ventas anuladas`,
                },
                {
                  label: "Ticket promedio",
                  value: money(data.orders ? data.revenue / data.orders : 0),
                  icon: ShoppingBag,
                  note: "Importe medio por pedido",
                },
                {
                  label: "Productos disponibles",
                  value: products.filter((p) => p.available).length,
                  icon: Leaf,
                  note: `De ${products.length} en tu carta`,
                },
              ].map((s, i) => (
                <article className={`stat stat-${i}`} key={s.label}>
                  <div>
                    <span>{s.label}</span>
                    <s.icon size={20} />
                  </div>
                  <strong>{s.value}</strong>
                  <small>{s.note}</small>
                </article>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h3>El ritmo de tus ventas</h3>
                  <span className="pill">Ingresos · Bs</span>
                </div>
                {data.series.length ? (
                  <div
                    className="chart"
                    role="img"
                    aria-label={`Ingresos por período: ${data.series.map((s) => `${s.label}: ${money(s.total)}`).join("; ")}`}
                  >
                    {data.series.map((s) => (
                      <div className="bar-column" key={s.label}>
                        <span>{money(s.total)}</span>
                        <div
                          className="bar"
                          style={{
                            height: `${Math.max(8, (s.total / Math.max(...data.series.map((v) => v.total))) * 170)}px`,
                          }}
                        />
                        <small>{s.label}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Tu próximo buen momento empieza aquí"
                    text="Registra una venta para ver tus ingresos."
                  >
                    <button className="secondary" onClick={onSell}>
                      Ir al punto de venta
                    </button>
                  </Empty>
                )}
              </section>
              <section className="panel">
                <h3>Así te pagan</h3>
                <div className="payment-total">
                  {money(data.revenue)}
                  <small>Total cobrado en el período</small>
                </div>
                {[
                  { name: "Efectivo", value: data.cash, icon: Wallet },
                  { name: "QR", value: data.qr, icon: ScanLine },
                ].map((m) => (
                  <div className="payment-row" key={m.name}>
                    <div>
                      <span>
                        <m.icon size={14} /> {m.name}
                      </span>
                      <strong>{money(m.value)}</strong>
                    </div>
                    <div className="track">
                      <span
                        style={{
                          width: `${data.revenue ? (m.value / data.revenue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="fine-print">
                  Ingresos por ventas. La ganancia neta requiere descontar
                  costos y gastos.
                </p>
              </section>
              <section className="panel favorites-panel">
                <div className="insight-heading">
                  <div>
                    <span className="insight-kicker">
                      RENDIMIENTO DE PRODUCTOS
                    </span>
                    <h3>Productos más vendidos</h3>
                  </div>
                  <button
                    className="overview-more"
                    onClick={() => setRankingOpen(true)}
                    aria-label="Ver más productos del ranking"
                  >
                    Ver más <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="ranking-columns" aria-hidden="true">
                  <span>POS.</span>
                  <span>PRODUCTO</span>
                  <span>UNIDADES</span>
                  <span>VENTAS</span>
                </div>
                {data.popular.length ? (
                  data.popular.slice(0, 3).map((p, i) => (
                    <div
                      className={`favorite-item ${i === 0 ? "favorite-leader" : ""}`}
                      key={p.name}
                    >
                      <span className="favorite-place">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="favorite-info">
                        <strong>{p.name}</strong>
                      </div>
                      <div className="favorite-count">
                        <strong>{p.quantity}</strong>
                        <small>
                          {Number(p.quantity) === 1 ? "vendido" : "vendidos"}
                        </small>
                      </div>
                      <div className="rank-sales">{money(p.total)}</div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Aquí aparecerán tus favoritos"
                    text="El ranking se calcula con las ventas completadas."
                  />
                )}
              </section>
              <section className="panel recent-sales-panel">
                <div className="insight-heading">
                  <span className="insight-icon">
                    <ReceiptIcon size={22} />
                  </span>
                  <div>
                    <span className="insight-kicker">
                      ACTIVIDAD DEL PERÍODO
                    </span>
                    <h3>Últimas ventas</h3>
                  </div>
                  <button
                    className="overview-more"
                    onClick={onHistory}
                    aria-label="Ver más ventas"
                  >
                    Ver más <ArrowUpRight size={15} />
                  </button>
                </div>
                <p className="insight-description">
                  Selecciona un pedido para ver su comprobante.
                </p>
                {data.recent.length ? (
                  data.recent.slice(0, 3).map((s) => (
                    <button
                      className={`recent-sale ${s.status === "voided" ? "recent-sale-void" : ""}`}
                      key={s.id}
                      onClick={() => setSelected(s)}
                    >
                      <span className="small-icon">
                        {s.payment_method === "Efectivo" ? (
                          <Wallet size={20} />
                        ) : s.payment_method === "QR" ? (
                          <ScanLine size={20} />
                        ) : (
                          <ReceiptIcon size={20} />
                        )}
                      </span>
                      <span className="recent-sale-info">
                        <strong>Pedido #{s.id.slice(0, 6)}</strong>
                        <small>{stamp(s.created_at)}</small>
                      </span>
                      <span className="recent-sale-value">
                        <b>{money(s.total)}</b>
                        <span className="sale-method-tag">
                          {s.status === "voided" ? "Anulada" : s.payment_method}
                        </span>
                      </span>
                      <ArrowUpRight className="sale-open-icon" size={17} />
                    </button>
                  ))
                ) : (
                  <Empty
                    title="Aún no hay ventas"
                    text="Las ventas de este período aparecerán aquí."
                  />
                )}
              </section>
            </div>
          </>
        )
      )}
      {rankingOpen && (
        <ProductRanking
          from={dates.from}
          to={dates.to}
          onClose={() => setRankingOpen(false)}
        />
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
