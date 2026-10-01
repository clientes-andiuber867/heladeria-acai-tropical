import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CatalogProvider } from "./context/CatalogContext";
import { Login } from "./features/auth/Login";
import { PasswordSetup } from "./features/auth/PasswordSetup";
import { PublicMenu } from "./features/menu/PublicMenu";
import { AppShell } from "./components/AppShell";
import { Loading, ErrorState } from "./components/States";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { configured } from "./lib/supabase";

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
    <CatalogProvider>
      <AppShell />
    </CatalogProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        {!configured ? (
          <div className="auth-single">
            <ErrorState message="Falta configurar la conexión del sistema. Revisa las variables de entorno de Supabase." />
          </div>
        ) : location.pathname === "/menu" ? (
          <CatalogProvider>
            <PublicMenu />
          </CatalogProvider>
        ) : (
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
        )}
      </ToastProvider>
    </ErrorBoundary>
  );
}
