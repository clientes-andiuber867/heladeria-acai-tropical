import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ArrowUpRight,
  Leaf,
  Sparkles,
} from "lucide-react";
import { Brand } from "../../components/Brand";
import { supabase, configured } from "../../lib/supabase";
import { errorMessage } from "../../lib/format";
export function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!configured)
        throw new Error("Falta configurar la conexión a Supabase.");
      if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/password`,
        });
        if (error) throw error;
        setMessage(
          "Si tu cuenta existe, recibirás un enlace para cambiar tu contraseña.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        void supabase.rpc("record_sign_in");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow">
            <Leaf size={13} /> NATURALMENTE TROPICAL
          </span>
          <h1>
            Todo el sabor.
            <br />
            Toda la energía.
            <br />
            <em>Un solo lugar.</em>
          </h1>
          <p>
            Grandes momentos empiezan
            <br />
            con pequeños antojos.
          </p>
        </div>
        <div className="logo-stage">
          <div className="logo-orbit" />
          <img src="/logo.png" alt="Tropical Açaí Super Food" />
          <span className="floating-label">
            <Sparkles size={18} /> Un poquito de felicidad
          </span>
          <span className="tropical-sticker">
            Hecho
            <br />
            <b>con amor</b>
          </span>
        </div>
        <div className="story-foot">
          <span>AÇAÍ · HELADOS · COMIDA · POSTRES</span>
          <span>SIEMPRE FRESCO</span>
        </div>
      </section>
      <section className="login-form">
        <a href="/menu" className="menu-link">
          Explorar nuestra carta <ArrowUpRight size={17} />
        </a>
        <div className="login-content">
          <span className="small-icon">
            <LockKeyhole />
          </span>
          <span className="eyebrow">EL SABOR EMPIEZA AQUÍ</span>
          <h2>{reset ? "Vuelve a tu espacio." : "Qué bueno verte."}</h2>
          <p className="muted">
            {reset
              ? "Te ayudamos a recuperar el acceso."
              : "Ingresa a tu espacio de trabajo."}
          </p>
          <form onSubmit={submit}>
            <label>
              Correo electrónico
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="tu@correo.com"
              />
            </label>
            {!reset && (
              <label>
                Contraseña
                <div className="password">
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success-message" role="status">
                {message}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Un momento…"
                : reset
                  ? "Enviar enlace"
                  : "Iniciar sesión"}
            </button>
          </form>
          <button
            className="text-button forgot"
            onClick={() => {
              setReset(!reset);
              setError("");
              setMessage("");
            }}
          >
            {reset ? "Volver al inicio de sesión" : "Olvidé mi contraseña"}
          </button>
          <div className="login-trust">
            <LockKeyhole size={14} />
            <span>Acceso exclusivo para el equipo de Açaí Tropical</span>
          </div>
        </div>
        <p className="login-footer">
          Açaí Tropical <span>Fresco, alegre y lleno de sabor.</span>
        </p>
      </section>
    </div>
  );
}
