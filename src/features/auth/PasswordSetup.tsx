import { useState, type FormEvent } from "react";
import { Brand } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../lib/format";
export function PasswordSetup() {
  const { refresh, signOut } = useAuth();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const result = await supabase.rpc("finish_password_setup");
      if (result.error) throw result.error;
      await refresh();
      location.replace("/");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="auth-single">
      <div className="panel">
        <Brand />
        <h1>Tu cuenta, tu contraseña.</h1>
        <p className="muted">
          Elige una contraseña personal de al menos 10 caracteres.
        </p>
        <form onSubmit={submit}>
          <label>
            Nueva contraseña
            <input
              type="password"
              minLength={10}
              maxLength={128}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Repite la contraseña
            <input
              type="password"
              minLength={10}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>
        <button
          className="text-button forgot"
          onClick={() => {
            void signOut().then(() => location.replace("/"));
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
