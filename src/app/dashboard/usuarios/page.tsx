import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/services/user";
import { requirePermission } from "@/lib/supabase/authorization";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface AccessRole { id: string; name: string; description: string | null }
interface Account {
  id: string; email: string; full_name: string | null; username: string | null;
  created_at: string; is_active: boolean; role_id: string | null;
  roles: AccessRole | AccessRole[] | null;
}

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error: actionError, success } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user || !hasPermission(user.permissions, "users.manage")) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: users, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("users").select("id, email, full_name, username, created_at, is_active, role_id, roles(id, name, description)").order("full_name"),
    supabase.from("roles").select("id, name, description").eq("is_active", true).order("name"),
  ]);
  const { data: assignments } = await supabase.from("user_roles").select("user_id, role_id");
  const assignedByUser = new Map<string, string[]>();
  for (const assignment of assignments ?? []) assignedByUser.set(assignment.user_id, [...(assignedByUser.get(assignment.user_id) ?? []), assignment.role_id]);

  async function updateUserAccess(formData: FormData) {
    "use server";
    const { supabase: actionClient } = await requirePermission("users.manage");
    const targetUserId = String(formData.get("userId") ?? "");
    const roleIds = formData.getAll("roleIds").map(String);
    const primaryRoleId = String(formData.get("primaryRoleId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const isActive = formData.get("isActive") === "true";
    if (!targetUserId || !roleIds.length || !primaryRoleId || reason.length < 8) {
      redirect(`/dashboard/usuarios?error=${encodeURIComponent("Selecciona roles e indica un motivo de al menos 8 caracteres.")}`);
    }
    const { error } = await actionClient.rpc("fn_admin_set_user_access", {
      p_target_user_id: targetUserId, p_role_ids: roleIds, p_primary_role_id: primaryRoleId,
      p_is_active: isActive, p_reason: reason,
    });
    if (error) redirect(`/dashboard/usuarios?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard/usuarios");
    redirect(`/dashboard/usuarios?success=${encodeURIComponent("Acceso actualizado y auditado.")}`);
  }

  return <div className="dashboard-main">
    <div className="page-header"><div><h1 className="page-header-title">Gestión de usuarios</h1><p className="page-header-subtitle">Asigna perfiles de acceso y administra cuentas del laboratorio.</p></div><a className="btn-primary" href="/dashboard/roles">Administrar roles y permisos</a></div>
    <div className="table-card">
      {actionError && <p className="alert-error" role="alert">{actionError}</p>}{success && <p className="alert-success" role="status">{success}</p>}
      {usersError && <p className="alert-error" role="alert">No se pudieron cargar los usuarios: {usersError.message}</p>}{rolesError && <p className="alert-error" role="alert">No se pudieron cargar los perfiles: {rolesError.message}</p>}
      <div className="table-responsive"><table className="data-table"><thead><tr><th>Usuario</th><th>Estado</th><th>Roles asignados</th><th>Rol principal</th><th>Guardar cambios</th></tr></thead><tbody>
        {(users ?? []).map((account: Account) => {
          const accountRoles = (assignedByUser.get(account.id) ?? (account.role_id ? [account.role_id] : []));
          const primary = Array.isArray(account.roles) ? account.roles[0] : account.roles;
          return <tr key={account.id}><td><strong>{account.full_name || account.username || "Usuario"}</strong><div className="cell-secondary">{account.email}</div><div className="cell-secondary">Registro: {new Date(account.created_at).toLocaleDateString("es-CO")}</div></td>
            <td><span className={`pill-badge ${account.is_active ? "pill-green" : "pill-red"}`}>{account.is_active ? "ACTIVO" : "PENDIENTE / SUSPENDIDO"}</span></td>
            <td colSpan={3}><form action={updateUserAccess} className="access-user-form"><input type="hidden" name="userId" value={account.id}/>
              <fieldset className="access-role-options"><legend className="form-label">Perfiles</legend>{(roles ?? []).map((role: AccessRole) => <label key={role.id} className="access-role-option"><input type="checkbox" name="roleIds" value={role.id} defaultChecked={accountRoles.includes(role.id)}/><span>{role.name}</span></label>)}</fieldset>
              <label className="form-label">Principal<select className="form-select" name="primaryRoleId" defaultValue={account.role_id || primary?.id || ""}>{(roles ?? []).map((role: AccessRole) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <label className="form-label">Estado<select className="form-select" name="isActive" defaultValue={String(account.is_active)}><option value="true">Activo</option><option value="false">Pendiente / suspendido</option></select></label>
              <label className="form-label">Motivo del cambio<input className="form-input" name="reason" minLength={8} required placeholder="Mínimo 8 caracteres"/></label>
              <button type="submit" className="btn-primary">Guardar acceso</button>
            </form></td></tr>;
        })}
        {(!users || users.length === 0) && !usersError && <tr><td colSpan={5} className="workflow-empty-state"><strong>No hay usuarios registrados</strong><span>Las solicitudes nuevas aparecerán aquí pendientes de aprobación.</span></td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
