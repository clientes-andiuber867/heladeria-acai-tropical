import { useState, useEffect, type FormEvent } from "react";
import { Plus, Users, Pencil } from "lucide-react";
import {
  getTeam,
  createMember,
  updateMember,
  deleteMember,
  updateCredentials,
} from "../../services/team";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Modal } from "../../components/Modal";
import { Loading, ErrorState } from "../../components/States";
import { errorMessage } from "../../lib/format";
import type { Profile, Role } from "../../types";
export function TeamPage() {
  const [members, setMembers] = useState<Profile[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<Profile | null | undefined>();
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event.type === "focus" || (event as CustomEvent).detail === "team")
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
    let active = true;
    getTeam()
      .then((r) => {
        if (active) {
          setMembers(r);
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
  }, [revision]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">JUNTOS SABE MEJOR</span>
          <h1>Usuarios y roles</h1>
          <p className="muted">
            Cada persona con su propia cuenta y los permisos adecuados.
          </p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={18} /> Agregar usuario
        </button>
      </div>
      {error ? (
        <ErrorState message={error} retry={() => setRevision((n) => n + 1)} />
      ) : loading ? (
        <Loading />
      ) : (
        <div className="team-grid">
          {members.map((m) => (
            <article className="panel member-card" key={m.id}>
              <span className="member-avatar">
                {m.display_name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{m.display_name}</h3>
                <p className="muted">{m.email}</p>
                <span className="pill">
                  {m.role === "admin" ? "Administrador" : "Cajero"}
                </span>{" "}
                <span className={`availability ${m.active ? "on" : ""}`}>
                  {m.active ? "Activo" : "Desactivado"}
                </span>
              </div>
              <button
                className="icon"
                aria-label={`Editar ${m.display_name}`}
                onClick={() => setEditing(m)}
              >
                <Pencil size={18} />
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="info-box">
        <Users size={20} />
        <p>
          El administrador puede gestionar todo el negocio. El cajero registra
          ventas y consulta sus propios pedidos.
        </p>
      </div>
      {editing !== undefined && (
        <MemberEditor
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
function MemberEditor({
  member,
  onClose,
  onSaved,
}: {
  member: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.display_name || ""),
    [email, setEmail] = useState(member?.email || ""),
    [role, setRole] = useState<Role>(member?.role || "cashier"),
    [active, setActive] = useState(member?.active ?? true),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast();
  const { profile } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function removeAccess() {
    if (!member) return;
    setBusy(true);
    setError("");
    try {
      await deleteMember(member.id);
      toast("Acceso eliminado. Las ventas y la auditoría se conservan.");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (member) {
        await updateMember(member.id, name, role, active);
        if (email.trim().toLowerCase() !== member.email || password)
          await updateCredentials(member.id, email, password);
      } else await createMember({ name, email, password, role });
      toast(
        member
          ? "Usuario actualizado."
          : "Usuario creado. Debe cambiar su contraseña al ingresar.",
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal title="Usuario" onClose={onClose} busy={busy}>
      <span className="eyebrow">EQUIPO AÇAÍ TROPICAL</span>
      <h2>{member ? "Editar usuario" : "Una nueva persona en el equipo"}</h2>
      <form onSubmit={submit}>
        <label>
          Nombre
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Rol
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="cashier">Cajero / vendedor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {
          <>
            <label>
              {member ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
              <input
                type="password"
                required={!member}
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="fine-print">
              {member
                ? "Deja la contraseña vacía para conservar la actual."
                : "Entrega esta contraseña a la persona. Al ingresar deberá elegir una nueva."}{" "}
              No se envían correos automáticamente.
            </p>
          </>
        }
        {member && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{" "}
            Cuenta activa
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "Guardando…" : "Guardar usuario"}
        </button>
      </form>
      {member && member.id !== profile?.id && (
        <div className="archive-area">
          {confirmDelete ? (
            <>
              <p>
                ¿Eliminar el acceso de {member.display_name}? Ya no podrá
                iniciar sesión. Sus ventas y movimientos se conservarán.
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={removeAccess}
              >
                Confirmar eliminación
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              className="danger-button"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar acceso
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
