import { useState, lazy, Suspense } from "react";
import { Loading } from "./States";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  ScanLine,
  ClipboardList,
  LogOut,
  Leaf,
  ExternalLink,
  Menu,
  Users,
  History,
  KeyRound,
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/format";
const DashboardPage = lazy(() =>
  import("../features/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const ProductsPage = lazy(() =>
  import("../features/catalog/ProductsPage").then((m) => ({
    default: m.ProductsPage,
  })),
);
const SalesPage = lazy(() =>
  import("../features/sales/SalesPage").then((m) => ({ default: m.SalesPage })),
);
const SalesHistory = lazy(() =>
  import("../features/sales/SalesHistory").then((m) => ({
    default: m.SalesHistory,
  })),
);
const AuditPage = lazy(() =>
  import("../features/audit/AuditPage").then((m) => ({ default: m.AuditPage })),
);
const TeamPage = lazy(() =>
  import("../features/team/TeamPage").then((m) => ({ default: m.TeamPage })),
);
const QRPage = lazy(() =>
  import("../features/menu/QRPage").then((m) => ({ default: m.QRPage })),
);
const PaymentSettingsPage = lazy(() =>
  import("../features/payments/PaymentSettingsPage").then((m) => ({
    default: m.PaymentSettingsPage,
  })),
);
const nav = [
  { id: "dashboard", name: "Resumen", icon: LayoutDashboard, admin: true },
  { id: "sales", name: "Punto de venta", icon: ShoppingBag, admin: false },
  { id: "history", name: "Historial de ventas", icon: History, admin: false },
  { id: "products", name: "Mis productos", icon: UtensilsCrossed, admin: false },
  { id: "qr", name: "Carta y QR", icon: ScanLine, admin: true },
  { id: "audit", name: "Auditoría", icon: ClipboardList, admin: true },
  { id: "team", name: "Usuarios y roles", icon: Users, admin: true },
  { id: "payments", name: "Configurar pagos", icon: ScanLine, admin: true },
];
export function AppShell() {
  const { profile, signOut } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(
      profile?.role === "admin" ? "dashboard" : "sales",
    ),
    [mobile, setMobile] = useState(false);
  const allowed = nav.filter((n) => !n.admin || profile?.role === "admin");
  const current = allowed.find((n) => n.id === page) ? page : "sales";
  function navigate(id: string) {
    setPage(id);
    window.dispatchEvent(new CustomEvent("section-active", { detail: id }));
    setMobile(false);
  }
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Brand />
        <span className="nav-label">MI NEGOCIO</span>
        <nav>
          {allowed.map((n) => (
            <button
              key={n.id}
              className={current === n.id ? "selected" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              {n.name}
              {current === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <Leaf />
          <h4>Siempre tropical.</h4>
          <p>Tu carta, a un escaneo de distancia.</p>
          <a href="/menu" target="_blank" rel="noreferrer">
            Ver carta digital <ExternalLink size={14} />
          </a>
        </div>
        <a className="password-link" href="/password">
          <KeyRound size={14} /> Cambiar contraseña
        </a>
        <div className="profile">
          <span className="avatar">
            {profile?.display_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{profile?.display_name}</strong>
            <small>
              {profile?.role === "admin"
                ? "Administrador"
                : "Cajero / vendedor"}
            </small>
          </div>
          <button
            className="icon"
            aria-label="Cerrar sesión"
            onClick={() => {
              void signOut().catch((e) => toast(errorMessage(e), true));
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="mobile-toggle icon"
              aria-label="Abrir navegación"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>Açaí Tropical</span>
            <span className="slash">/</span>
            <strong>{nav.find((n) => n.id === current)?.name}</strong>
          </div>
          <div>
            <span className="live-badge">
              <Leaf size={13} /> Açaí Tropical
            </span>
            <span className="date-label">
              {(() => {
                try {
                  return new Date().toLocaleDateString("es-BO", {
                    day: "numeric",
                    month: "long",
                    timeZone: "America/La_Paz",
                  });
                } catch {
                  return new Date().toLocaleDateString("es-BO", {
                    day: "numeric",
                    month: "long",
                  });
                }
              })()}
            </span>
            <span className="avatar mini">
              {profile?.display_name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main className="content">
          {allowed.map(({ id }) => (
            <div key={id} hidden={current !== id}>
              <Suspense fallback={<Loading />}>
                {id === "dashboard" && (
                  <DashboardPage
                    onSell={() => navigate("sales")}
                    onHistory={() => navigate("history")}
                  />
                )}
                {id === "sales" && <SalesPage />}
                {id === "history" && <SalesHistory />}
                {id === "products" && <ProductsPage />}
                {id === "qr" && <QRPage />}
                {id === "audit" && <AuditPage />}
                {id === "team" && <TeamPage />}
                {id === "payments" && <PaymentSettingsPage />}
              </Suspense>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
