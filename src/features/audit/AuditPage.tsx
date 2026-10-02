import { useEffect, useState } from "react";
import {
  Search,
  Wallet,
  LockKeyhole,
  ShieldCheck,
  ReceiptText,
  Package,
  Users,
  ScanLine,
  LogIn,
  Ban,
  ArrowUpRight,
  Clock3,
  UserRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DateFilter } from "../../components/DateFilter";
import { Loading, Empty, ErrorState } from "../../components/States";
import { Modal } from "../../components/Modal";
import { getAudit } from "../../services/audit";
import { day, stamp, money, errorMessage } from "../../lib/format";
import type { AuditEvent } from "../../types";
function summary(e: AuditEvent) {
  const d = e.detail;
  if (e.action === "Caja abierta")
    return `Fondo inicial: ${money(d.opening_cash)}`;
  if (e.action === "Caja cerrada")
    return `Esperado: ${money(d.expected_cash)} · Contado: ${money(d.counted_cash)} · Diferencia: ${money(d.difference)} · ${d.closing_note || "Sin observaciones"}`;
  if (e.action === "QR de cobro actualizado") return d.recipient;
  if (e.action.startsWith("Sección"))
    return d.name || d.before || "Sección de productos";
  if (e.action === "Venta registrada")
    return `${money(d.total)} · ${d.payment} · Efectivo: ${money(d.cash_amount ?? (d.payment === "Efectivo" ? d.total : 0))} · QR: ${money(d.qr_amount ?? (d.payment === "QR" ? d.total : 0))} · ${(d.items || []).map((i: any) => `${i.quantity} × ${i.product_name}`).join(", ")}`;
  if (e.action === "Venta anulada") return `${money(d.total)} · ${d.reason}`;
  if (d.after)
    return `${d.after.name} · ${money(d.after.price)} · ${d.after.archived ? "Archivado" : d.after.available ? "Disponible" : "Agotado"}`;
  if (d.name)
    return `${d.name} · ${d.role === "admin" ? "Administrador" : "Cajero"}`;
  return "Acceso al sistema";
}
function activityStyle(action: string) {
  if (/anulada|eliminado|eliminada/i.test(action))
    return { tone: "rose", Icon: Ban };
  if (action === "Caja abierta") return { tone: "green", Icon: Wallet };
  if (action === "Caja cerrada") return { tone: "purple", Icon: LockKeyhole };
  if (action.startsWith("Venta")) return { tone: "green", Icon: ReceiptText };
  if (action.startsWith("Producto") || action.startsWith("Sección"))
    return { tone: "mango", Icon: Package };
  if (action.startsWith("QR")) return { tone: "purple", Icon: ScanLine };
  if (action === "Inicio de sesión") return { tone: "neutral", Icon: LogIn };
  return { tone: "purple", Icon: Users };
}
export function AuditPage() {
  const [scope, setScope] = useState("changes");
  const [dates, setDates] = useState({
      from: day(new Date()),
      to: day(new Date()),
    }),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [events, setEvents] = useState<AuditEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<AuditEvent | null>(null);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event.type === "focus" || (event as CustomEvent).detail === "audit")
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
    const timer = setTimeout(
      () => {
        getAudit(dates.from, dates.to, search, page, scope)
          .then((d) => {
            if (active) {
              setEvents(d);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(errorMessage(e));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [dates, search, page, revision, scope]);
  const count = Number(events[0]?.total_count || 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TRANSPARENCIA EN CADA DETALLE</span>
          <h1>Control y cambios del negocio</h1>
          <p className="muted">
            Supervisa aperturas y cierres de caja, anulaciones, catálogo,
            accesos y el QR de cobro.
          </p>
        </div>
        <span className="live-badge">
          <ShieldCheck size={16} /> Registro protegido
        </span>
      </div>
      <DateFilter
        {...dates}
        onChange={(from, to) => {
          setDates({ from, to });
          setPage(0);
        }}
      />
      <div className="audit-scopes" aria-label="Tipo de actividad">
        {[
          ["changes", "Cambios y anulaciones"],
          ["cash", "Aperturas y cierres de caja"],
          ["voids", "Anulaciones"],
          ["catalog", "Productos y secciones"],
          ["access", "Usuarios y accesos"],
          ["payments", "QR de cobro"],
          ["all", "Toda la actividad"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={scope === value}
            className={scope === value ? "active" : ""}
            onClick={() => {
              setScope(value);
              setPage(0);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="fine-print">
        {scope === "changes"
          ? "Esta vista prioriza cambios administrativos y anulaciones. Las ventas normales y los inicios de sesión siguen disponibles en Toda la actividad."
          : scope === "cash"
            ? "Controla quién abrió o cerró caja, a qué hora, el fondo inicial y las diferencias de efectivo. Usa el período y la búsqueda para revisar a cada responsable."
            : "Consulta quién realizó cada acción y revisa su detalle. Los filtros se aplican a todos los registros del período."}
      </p>
      <div className="catalog-tools">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Buscar auditoría"
            placeholder="Usuario, producto, pago o movimiento…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>
      {error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : loading ? (
        <Loading />
      ) : (
        <section className="panel activity-panel">
          <header className="activity-header">
            <div className="insight-heading">
              <span className="insight-icon">
                <ShieldCheck size={23} />
              </span>
              <div>
                <span className="insight-kicker">TRAZABILIDAD DEL NEGOCIO</span>
                <h2>
                  {scope === "cash"
                    ? "Aperturas y cierres de caja"
                    : "Registro de actividad"}
                </h2>
              </div>
            </div>
            <span className="activity-count">
              {count} {count === 1 ? "movimiento" : "movimientos"}
            </span>
          </header>
          <div className="activity-feed">
            {events.map((e) => {
              const { tone, Icon } = activityStyle(e.action);
              const isSale = e.action === "Venta registrada";
              return (
                <article
                  className={`activity-event activity-${tone}`}
                  key={e.id}
                >
                  <span className="activity-node">
                    <Icon size={21} />
                  </span>
                  <div className="activity-content">
                    <div className="activity-title">
                      <h3>{e.action}</h3>
                      <time dateTime={e.created_at}>
                        <Clock3 size={12} />
                        {stamp(e.created_at)}
                      </time>
                    </div>
                    <span className="activity-actor">
                      <UserRound size={13} />
                      {e.actor_name || "Sistema"}
                    </span>
                    {isSale ? (
                      <>
                        <div className="activity-sale">
                          <strong>{money(e.detail.total)}</strong>
                          <span>{e.detail.payment}</span>
                          <small>
                            Efectivo{" "}
                            {money(
                              e.detail.cash_amount ??
                                (e.detail.payment === "Efectivo"
                                  ? e.detail.total
                                  : 0),
                            )}
                          </small>
                          <small>
                            QR{" "}
                            {money(
                              e.detail.qr_amount ??
                                (e.detail.payment === "QR"
                                  ? e.detail.total
                                  : 0),
                            )}
                          </small>
                        </div>
                        <p className="activity-description">
                          {(e.detail.items || [])
                            .map(
                              (i: any) => `${i.quantity} × ${i.product_name}`,
                            )
                            .join(" · ")}
                        </p>
                      </>
                    ) : (
                      <p className="activity-description">{summary(e)}</p>
                    )}
                  </div>
                  <button
                    className="activity-open"
                    aria-label={`Ver detalle: ${e.action}, ${stamp(e.created_at)}`}
                    onClick={() => setSelected(e)}
                  >
                    Ver detalle <ArrowUpRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          {!events.length && (
            <Empty title="No hay movimientos para estos filtros" />
          )}
          <div className="pagination ledger-pagination">
            <span>
              {count
                ? `${page * 25 + 1}–${Math.min((page + 1) * 25, count)} de ${count} movimientos`
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
              {page + 1} / {Math.max(1, Math.ceil(count / 25))}
            </span>
            <button
              className="secondary"
              disabled={(page + 1) * 25 >= count}
              onClick={() => setPage((n) => n + 1)}
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </section>
      )}
      <p className="fine-print">
        Horario de Bolivia · Los movimientos se registran en el servidor y no se
        pueden editar desde el sistema.
      </p>
      {selected && (
        <Modal
          title="Detalle de auditoría"
          className="activity-detail-dialog"
          onClose={() => setSelected(null)}
        >
          <span className="eyebrow">TRAZABILIDAD</span>
          <h2>{selected.action}</h2>
          <p className="muted">
            {stamp(selected.created_at)} · {selected.actor_name}
          </p>
          <p>{summary(selected)}</p>
          {selected.detail.note && <p>Nota: {selected.detail.note}</p>}
          {selected.detail.before && selected.detail.after && (
            <table>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "name",
                  "description",
                  "price",
                  "category",
                  "available",
                  "archived",
                  "image",
                ]
                  .filter(
                    (key) =>
                      selected.detail.before[key] !==
                      selected.detail.after[key],
                  )
                  .map((key) => (
                    <tr key={key}>
                      <td>
                        {
                          {
                            name: "Nombre",
                            description: "Descripción",
                            price: "Precio",
                            category: "Categoría",
                            available: "Disponible",
                            archived: "Archivado",
                            image: "Fotografía",
                          }[key]
                        }
                      </td>
                      <td>
                        {key === "image"
                          ? "Imagen anterior"
                          : String(selected.detail.before[key] ?? "—")}
                      </td>
                      <td>
                        {key === "image"
                          ? "Imagen actualizada"
                          : String(selected.detail.after[key] ?? "—")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          <p className="fine-print">Referencia: {selected.entity_id}</p>
        </Modal>
      )}
    </>
  );
}
