import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/services/user";
import { requirePermission } from "@/lib/supabase/authorization";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
interface PermissionRow { code: string; module: string; action: string; label: string; description: string; is_sensitive: boolean }
interface RoleRow { id: string; name: string; description: string | null; is_active: boolean; is_system: boolean }
const moduleLabels: Record<string, string> = { dashboard:"Panel", inventory:"Inventario", orders:"Pedidos", reception:"Recepción", suppliers:"Proveedores", safety:"Seguridad", monitoring:"Monitoreo", equipment:"Equipos", reports:"Reportes", quality:"Calidad", configuration:"Configuración", catalog:"Catálogo", audit:"Auditoría", users:"Usuarios", roles:"Roles" };
const protectedSystemPermissions = new Set(["roles.manage", "users.manage"]);

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; edit?: string; preview?: string }> }) {
  const { error: actionError, success, edit, preview } = await searchParams;
  const user = await getCurrentUserProfile();
  if (!user || !hasPermission(user.permissions, "roles.manage")) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }, { data: assignments }] = await Promise.all([
    supabase.from("roles").select("id, name, description, is_active, is_system").order("name"),
    supabase.from("access_permissions").select("code, module, action, label, description, is_sensitive").order("module").order("label"),
    supabase.from("access_role_permissions").select("role_id, permission_code"),
  ]);
  const permissionsByRole = new Map<string, string[]>();
  for (const item of assignments ?? []) permissionsByRole.set(item.role_id, [...(permissionsByRole.get(item.role_id) ?? []), item.permission_code]);
  const selectedRole = (roles ?? []).find((role: RoleRow) => role.id === edit);
  const previewRole = (roles ?? []).find((role: RoleRow) => role.id === preview);
  const previewCodes = previewRole ? new Set(permissionsByRole.get(previewRole.id) ?? []) : new Set<string>();
  const previewPermissions = ((permissions ?? []) as PermissionRow[]).filter((permission) => previewCodes.has(permission.code));
  const previewGroups = new Map<string, PermissionRow[]>();
  for (const permission of previewPermissions) previewGroups.set(permission.module, [...(previewGroups.get(permission.module) ?? []), permission]);
  const visibleModules = [
    ["dashboard.view", "Panel"], ["inventory.view", "Inventario"], ["orders.view", "Pedidos"],
    ["reception.view", "Recepción técnica"], ["suppliers.view", "Proveedores"], ["safety.view", "Seguridad"],
    ["monitoring.view", "Monitoreo ambiental"], ["equipment.view", "Equipos"], ["reports.view", "Reportes"],
    ["quality.view", "Calidad"], ["configuration.manage", "Configuración"], ["audit.logs.view", "Auditoría"],
    ["users.manage", "Usuarios"], ["roles.manage", "Roles y permisos"],
  ].filter(([code]) => previewCodes.has(code));
  const groupedPermissions = new Map<string, PermissionRow[]>();
  for (const permission of (permissions ?? []) as PermissionRow[]) groupedPermissions.set(permission.module, [...(groupedPermissions.get(permission.module) ?? []), permission]);

  async function saveRole(formData: FormData) {
    "use server";
    const { supabase: actionClient } = await requirePermission("roles.manage");
    const roleId = String(formData.get("roleId") ?? "") || null;
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const permissionCodes = formData.getAll("permissionCodes").map(String);
    if (!name || reason.length < 8) redirect(`/dashboard/roles?error=${encodeURIComponent("El nombre y un motivo de al menos 8 caracteres son obligatorios.")}`);
    const { error } = await actionClient.rpc("fn_admin_save_access_role", {
      p_role_id: roleId, p_name: name, p_description: description,
      p_permission_codes: permissionCodes, p_reason: reason,
    });
    if (error) redirect(`/dashboard/roles?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard/roles"); revalidatePath("/dashboard/usuarios");
    redirect(`/dashboard/roles?success=${encodeURIComponent("Rol guardado y auditado.")}`);
  }

  async function archiveRole(formData: FormData) {
    "use server";
    const { supabase: actionClient } = await requirePermission("roles.manage");
    const roleId = String(formData.get("roleId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const { error } = await actionClient.rpc("fn_admin_archive_access_role", { p_role_id: roleId, p_reason: reason });
    if (error) redirect(`/dashboard/roles?error=${encodeURIComponent(error.message)}`);
    revalidatePath("/dashboard/roles"); revalidatePath("/dashboard/usuarios");
    redirect(`/dashboard/roles?success=${encodeURIComponent("Rol archivado y auditado.")}`);
  }

  return <div className="dashboard-main">
    <div className="page-header"><div><h1 className="page-header-title">Roles y permisos</h1><p className="page-header-subtitle">Configura el acceso por módulo. Los cambios se aplican en el servidor y quedan registrados.</p></div><a className="btn-secondary" href="/dashboard/usuarios">Gestión de usuarios</a></div>
    {actionError && <p className="alert-error" role="alert">{actionError}</p>}{success && <p className="alert-success" role="status">{success}</p>}{rolesError && <p className="alert-error" role="alert">Error al cargar roles: {rolesError.message}</p>}{permissionsError && <p className="alert-error" role="alert">Error al cargar permisos. Aplica la migración de control de acceso: {permissionsError.message}</p>}
    <div className="access-role-grid">{(roles ?? []).map((role: RoleRow) => <article className="table-card access-role-card" key={role.id}><div className="access-role-card-heading"><div><h2>{role.name}</h2><p>{role.description || "Sin descripción"}</p></div><span className={`pill-badge ${role.is_active ? "pill-green" : "pill-slate"}`}>{role.is_active ? "ACTIVO" : "ARCHIVADO"}</span></div><p className="cell-secondary">{permissionsByRole.get(role.id)?.length ?? 0} permisos · {role.is_system ? "Perfil protegido del sistema" : "Perfil personalizado"}</p><div className="access-role-card-actions"><a className="btn-secondary" href={`/dashboard/roles?edit=${role.id}#access-editor`}>Ver matriz / editar</a><a className="btn-secondary" href={`/dashboard/roles?preview=${role.id}#access-preview`} aria-current={previewRole?.id === role.id ? "true" : undefined}>{previewRole?.id === role.id ? "Previsualizando" : "Previsualizar"}</a>{!role.is_system && role.is_active && <form action={archiveRole} className="access-archive-form"><input type="hidden" name="roleId" value={role.id}/><input className="form-input" name="reason" required minLength={8} placeholder="Motivo para archivar"/><button className="action-btn-toggle-inactive" type="submit">Archivar</button></form>}</div></article>)}</div>
    {previewRole && <section id="access-preview" className="table-card access-preview" aria-label={`Vista previa del perfil ${previewRole.name}`}><div className="card-section-header"><div><h2 className="form-card-title">Vista previa: {previewRole.name}</h2><p className="cell-secondary">Simulación informativa basada en la matriz guardada. Tu sesión y los controles reales de acceso no cambian.</p></div><a className="btn-secondary" href="/dashboard/roles#access-preview">Cerrar vista previa</a></div><div className="access-preview-warning" role="note">Esta vista muestra qué módulos y acciones habilita el perfil. No permite validar RLS ni ejecutar acciones con la identidad de otro usuario.</div><h3 className="access-preview-subtitle">Módulos visibles</h3>{visibleModules.length ? <div className="access-preview-modules">{visibleModules.map(([code, label]) => <span className="pill-badge pill-green" key={code}>{label}</span>)}</div> : <p className="cell-secondary">Este perfil no tiene módulos de navegación visibles.</p>}<h3 className="access-preview-subtitle">Acciones permitidas</h3><div className="access-permission-groups">{[...previewGroups.entries()].map(([module, items]) => <section className="access-permission-group" key={module}><h4>{moduleLabels[module] ?? module}</h4><ul>{items.map((permission) => <li key={permission.code}><strong>{permission.label}</strong>{permission.description ? <span> — {permission.description}</span> : null}</li>)}</ul></section>)}</div></section>}
    <section id="access-editor" className="table-card access-editor"><h2 className="form-card-title">{selectedRole ? `Matriz: ${selectedRole.name}` : "Crear perfil personalizado"}</h2><p className="cell-secondary">Los roles protegidos conservan su identidad. No se permiten asignaciones directas desde el navegador.</p>
      <form action={saveRole}><input type="hidden" name="roleId" value={selectedRole?.id ?? ""}/><div className="access-role-fields"><label className="form-label">Nombre<input className="form-input" name="name" required maxLength={80} defaultValue={selectedRole?.name ?? ""} readOnly={Boolean(selectedRole?.is_system)}/></label><label className="form-label">Descripción<input className="form-input" name="description" maxLength={240} defaultValue={selectedRole?.description ?? ""}/></label><label className="form-label">Motivo del cambio<input className="form-input" name="reason" required minLength={8} placeholder="Mínimo 8 caracteres"/></label></div>
        <div className="access-permission-groups">{[...groupedPermissions.entries()].map(([module, items]) => <fieldset className="access-permission-group" key={module}><legend>{moduleLabels[module] ?? module}</legend>{items.map(permission => { const protectedPermission = Boolean(selectedRole?.is_system && protectedSystemPermissions.has(permission.code)); return <label className="access-permission-row" key={permission.code}><input type="checkbox" name="permissionCodes" value={permission.code} defaultChecked={selectedRole ? permissionsByRole.get(selectedRole.id)?.includes(permission.code) : permission.code === "roles.manage"} disabled={protectedPermission}/>{protectedPermission && <input type="hidden" name="permissionCodes" value={permission.code}/>}<span><strong>{permission.label}</strong><small>{permission.description || permission.code}</small></span>{permission.is_sensitive && <span className="pill-badge pill-amber">Sensible</span>}</label>})}</fieldset>)}</div>
        <div className="access-editor-footer"><button type="submit" className="btn-primary">Guardar permisos</button>{selectedRole && <a className="btn-secondary" href="/dashboard/roles">Crear perfil nuevo</a>}</div>
      </form>
    </section>
  </div>;
}
