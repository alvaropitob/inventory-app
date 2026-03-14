import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/services/user";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();

  // Verify admin status via app_metadata (best practice)
  const user = await getCurrentUserProfile();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch all users with their primary roles
  const { data: users } = await supabase
    .from("users")
    .select(`
      id,
      email,
      full_name,
      username,
      created_at,
      roles!inner (
        id,
        name,
        description
      )
    `)
    .order("full_name", { ascending: true });

  // Fetch available roles for the select menu
  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  async function updateRole(formData: FormData) {
    "use server";
    const supabase = await createClient();
    
    // Safety check: verify the person performing the action is still an admin
    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor || actor.app_metadata?.role !== "admin") {
      throw new Error("No tienes permisos para realizar esta acción");
    }

    const targetUserId = formData.get("userId") as string;
    const newRoleId = formData.get("roleId") as string;

    // Update the primary role_id in the robust users table
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ role_id: newRoleId })
      .eq("id", targetUserId);

    if (userUpdateError) {
      console.error("Error updating user role_id:", userUpdateError);
      return;
    }

    // Update or Insert into user_roles (the trigger handles metadata sync)
    const { error: roleAssignmentError } = await supabase
      .from("user_roles")
      .upsert({ 
        user_id: targetUserId, 
        role_id: newRoleId, 
        is_primary: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, role_id' });

    if (roleAssignmentError) {
       console.error("Error updating user_roles:", roleAssignmentError);
    }

    revalidatePath("/dashboard/usuarios");
  }

  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h1>Gestión de Personal Clínico</h1>
        <p>Controla los accesos basados en roles especializados del laboratorio.</p>
      </div>

      <div className="stat-card" style={{ width: '100%', padding: '0', overflow: 'hidden', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Profesional</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Rol Clínico</th>
                <th style={{ padding: '1.25rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--navy-light)', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: { id: string, full_name: string, email: string, roles: any }) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                        {u.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--navy)', fontSize: '0.9375rem' }}>{u.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <span style={{ 
                      padding: '0.375rem 0.875rem', 
                      borderRadius: '20px', 
                      fontSize: '0.75rem', 
                      fontWeight: '800',
                      background: (u.roles as unknown as { name: string })?.name === 'admin' ? '#fee2e2' : 
                                 (u.roles as unknown as { name: string })?.name === 'operator' ? '#dcfce7' : 
                                 (u.roles as unknown as { name: string })?.name === 'supervisor' ? '#fef3c7' : '#f1f5f9',
                      color: (u.roles as unknown as { name: string })?.name === 'admin' ? '#ef4444' : 
                             (u.roles as unknown as { name: string })?.name === 'operator' ? '#10b981' : 
                             (u.roles as unknown as { name: string })?.name === 'supervisor' ? '#d97706' : '#64748b',
                      display: 'inline-block',
                      textTransform: 'uppercase'
                    }}>
                      {(u.roles as unknown as { name: string })?.name}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <form action={updateRole} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <select 
                        name="roleId" 
                        defaultValue={(u.roles as unknown as { id: string })?.id}
                        style={{ 
                          padding: '0.5rem', 
                          borderRadius: 'var(--radius)', 
                          border: '1px solid var(--border)',
                          fontSize: '0.875rem',
                          background: 'var(--white)',
                          color: 'var(--navy)'
                        }}
                      >
                        {roles?.map((r: { id: string, name: string }) => (
                          <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                        ))}
                      </select>
                      <button 
                        type="submit"
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: 'var(--primary)', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: 'var(--radius)',
                          fontSize: '0.8125rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Actualizar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
