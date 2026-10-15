import { PaymentsProvider } from "./services/payments";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CatalogProvider } from "./context/CatalogContext";
import { Login } from "./features/auth/Login";
import { lazy, Suspense } from "react";
import { Loading, ErrorState } from "./components/States";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { configured } from "./lib/supabase";
import { BranchProvider } from "./context/BranchContext";
const PasswordSetup = lazy(() =>
  import("./features/auth/PasswordSetup").then((m) => ({
    default: m.PasswordSetup,
  })),
);
const PublicMenu = lazy(() =>
  import("./features/menu/PublicMenu").then((m) => ({ default: m.PublicMenu })),
);
const AppShell = lazy(() =>
  import("./components/AppShell").then((m) => ({ default: m.AppShell })),
);

function AuthenticatedApp() {
  const { session, profile, loading, error, recovery, refresh, signOut } =
    useAuth();
  if (loading)
    return (
      <div className="auth-single">
        <Loading label="Entrando a tu espacio tropical…" />
      </div>
    );
  if (!session) return <Login />;
  if (error)
    return (
      <div className="auth-single">
        <div className="panel">
          <ErrorState
            message="No se pudo cargar tu perfil. Comprueba la conexión o consulta con el administrador."
            retry={() => {
              void refresh();
            }}
          />
          <button
            className="text-button"
            onClick={() => {
              void signOut();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  if (!profile || profile.id !== session.user.id)
    return (
      <div className="auth-single">
        <Loading label="Preparando tu espacio tropical…" />
      </div>
    );
  if (profile.active === false)
    return (
      <div className="auth-single">
        <div className="panel">
          <h2>Tu cuenta no tiene acceso activo.</h2>
          <p>Consulta con el administrador del negocio.</p>
          <button
            className="primary"
            onClick={() => {
              void signOut();
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  if (
    recovery ||
    profile.must_change_password ||
    location.pathname === "/password"
  )
    return <PasswordSetup />;
  return (
    <BranchProvider profile={profile}>
      <CatalogProvider>
        <PaymentsProvider>
          <AppShell />
        </PaymentsProvider>
      </CatalogProvider>
    </BranchProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense
          fallback={
            <div className="auth-single">
              <Loading />
            </div>
          }
        >
          {!configured ? (
            <div className="auth-single">
              <ErrorState message="Falta configurar la conexión del sistema. Revisa las variables de entorno de Supabase." />
            </div>
          ) : location.pathname === "/menu" ? (
            <BranchProvider>
              <CatalogProvider>
                <PublicMenu />
              </CatalogProvider>
            </BranchProvider>
          ) : (
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          )}
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}
