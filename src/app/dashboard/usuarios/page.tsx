import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/services/user";
import { requirePermission } from "@/lib/supabase/authorization";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface UserRole {
  id: string;
  name: string;
  description: string | null;
}

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  created_at: string;
  is_active: boolean;
  role_id: string | null;
  roles: UserRole | UserRole[] | null;
}

function RoleBadge({ roleName }: { roleName?: string }) {
  const config: Record<string, string> = {
    admin: "pill-red",
    operator: "pill-green",
    supervisor: "pill-amber",
  };
  const cls = config[roleName ?? ""] ?? "pill-slate";
  return <span className={`pill-badge ${cls}`}>{roleName?.toUpperCase() || "SIN ROL"}</span>;
}

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error: actionError, success } = await searchParams;
  const supabase = await createClient();

  const user = await getCurrentUserProfile();
  if (!user || !hasPermission(user.role, "users.manage")) redirect("/dashboard");

  const [{ data: users, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, username, created_at, is_active, role_id, roles(id, name, description)")
      .order("full_name", { ascending: true }),
    supabase.from("roles").select("id, name, description").eq("is_active", true).order("name", { ascending: true }),
  ]);

  async function updateRole(formData: FormData) {
    "use server";
    const { supabase: actionClient } = await requirePermission("users.manage");
    const targetUserId = String(formData.get("userId") || "").trim();
    const newRoleId = String(formData.get("roleId") || "").trim();
    if (!targetUserId || !newRoleId) {
      redirect(`/dashboard/usuarios?error=${encodeURIComponent("Selecciona un usuario y un rol válidos.")}`);
    }

    const { error } = await actionClient.rpc("fn_update_user_access", {
      p_target_user_id: targetUserId,
      p_new_role_id: newRoleId,
      p_new_is_active: formData.get("is_active") === "true",
    });
    if (error) redirect(`/dashboard/usuarios?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard/usuarios");
    redirect(`/dashboard/usuarios?success=${encodeURIComponent("Rol actualizado.")}`);
  }

  async function toggleUserStatus(userId: string, isActive: boolean) {
    "use server";
    const { supabase: actionClient } = await requirePermission("users.manage");
    const { data: target, error: readError } = await actionClient
      .from("users")
      .select("role_id")
      .eq("id", userId)
      .maybeSingle();
    if (readError || !target?.role_id) {
      redirect(`/dashboard/usuarios?error=${encodeURIComponent("No se pudo consultar el rol actual del usuario.")}`);
    }

    const { error } = await actionClient.rpc("fn_update_user_access", {
      p_target_user_id: userId,
      p_new_role_id: target.role_id,
      p_new_is_active: !isActive,
    });
    if (error) redirect(`/dashboard/usuarios?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard/usuarios");
    redirect(`/dashboard/usuarios?success=${encodeURIComponent(isActive ? "Acceso desactivado." : "Acceso activado.")}`);
  }

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Gestión de Personal Clínico</h1>
          <p className="page-header-subtitle">Asigna roles y activa o suspende el acceso del personal.</p>
        </div>
      </div>

      <div className="table-card">
        {actionError && <p className="alert-error" role="alert">{actionError}</p>}
        {success && <p className="alert-success" role="status">{success}</p>}
        {usersError && <p className="alert-error" role="alert">No se pudo cargar el personal: {usersError.message}</p>}
        {rolesError && <p className="alert-error" role="alert">No se pudieron cargar los roles: {rolesError.message}</p>}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Profesional</th><th>Rol</th><th>Acceso</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {users?.map((account: UserWithRoles) => {
                const primaryRole = Array.isArray(account.roles) ? account.roles[0] : account.roles;
                return (
                  <tr key={account.id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">{account.full_name?.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="user-name">{account.full_name || account.username || "Usuario"}</div>
                          <div className="user-email">{account.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge roleName={primaryRole?.name} /></td>
                    <td><span className={`pill-badge ${account.is_active ? "pill-green" : "pill-red"}`}>{account.is_active ? "ACTIVO" : "INACTIVO"}</span></td>
                    <td>
                      <form action={updateRole} className="action-group">
                        <input type="hidden" name="userId" value={account.id} />
                        <input type="hidden" name="is_active" value={String(account.is_active)} />
                        <select name="roleId" defaultValue={account.role_id || primaryRole?.id} className="form-select" style={{ width: "auto" }}>
                          {roles?.map((role: { id: string; name: string }) => <option key={role.id} value={role.id}>{role.name.toUpperCase()}</option>)}
                        </select>
                        <button type="submit" className="btn-primary">Actualizar rol</button>
                      </form>
                      <form action={toggleUserStatus.bind(null, account.id, account.is_active)} style={{ marginTop: ".35rem" }}>
                        <button type="submit" className={account.is_active ? "action-btn-toggle-inactive" : "action-btn-toggle-active"}>
                          {account.is_active ? "Desactivar acceso" : "Activar acceso"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {(!users || users.length === 0) && !usersError && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>No hay usuarios registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
