import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/services/user";

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
  roles: UserRole | UserRole[];
}

function RoleBadge({ roleName }: { roleName?: string }) {
  const config: Record<string, string> = {
    admin:      'pill-red',
    operator:   'pill-green',
    supervisor: 'pill-amber',
  };
  const cls = config[roleName ?? ''] ?? 'pill-slate';
  return <span className={`pill-badge ${cls}`}>{roleName?.toUpperCase()}</span>;
}

export default async function UsuariosPage() {
  const supabase = await createClient();

  const user = await getCurrentUserProfile();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: users } = await supabase
    .from("users")
    .select(`id, email, full_name, username, created_at, roles!inner(id, name, description)`)
    .order("full_name", { ascending: true });

  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  async function updateRole(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor || actor.app_metadata?.role !== "admin") {
      throw new Error("No tienes permisos para realizar esta acción");
    }

    const targetUserId = formData.get("userId") as string;
    const newRoleId = formData.get("roleId") as string;

    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ role_id: newRoleId })
      .eq("id", targetUserId);

    if (userUpdateError) {
      console.error("Error updating user role_id:", userUpdateError);
      return;
    }

    const { error: roleAssignmentError } = await supabase
      .from("user_roles")
      .upsert({
        user_id: targetUserId,
        role_id: newRoleId,
        is_primary: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, role_id' });

    if (roleAssignmentError) {
      console.error("Error updating user_roles:", roleAssignmentError);
    }

    revalidatePath("/dashboard/usuarios");
  }

  return (
    <div className="dashboard-main">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Gestión de Personal Clínico</h1>
          <p className="page-header-subtitle">Controla los accesos basados en roles especializados del laboratorio.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Rol Clínico</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: UserWithRoles) => {
                const primaryRole = Array.isArray(u.roles) ? u.roles[0] : u.roles;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">{u.full_name}</div>
                          <div className="user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge roleName={primaryRole?.name} />
                    </td>
                    <td>
                      <form action={updateRole} className="action-group">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="roleId" defaultValue={primaryRole?.id} className="form-select" style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 0.75rem' }}>
                          {roles?.map((r: { id: string; name: string }) => (
                            <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                          ))}
                        </select>
                        <button type="submit" className="btn-primary" style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>
                          Actualizar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
