import { hasPermission, type AppPermission, type AccessPermissionCode } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

async function getAuthorizationContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile, error } = await supabase
    .from("users")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.is_active !== true) {
    throw new Error("Usuario inactivo o sin perfil autorizado");
  }

  const { data: permissions, error: permissionsError } = await supabase.rpc("fn_current_user_access_permissions");
  if (permissionsError || !Array.isArray(permissions)) throw new Error("No se pudieron resolver los permisos del usuario");

  return {
    supabase,
    user,
    permissions: permissions.map((row: { permission_code: string }) => row.permission_code) as AccessPermissionCode[],
  };
}

export async function requirePermission(permission: AppPermission) {
  const context = await getAuthorizationContext();
  if (!hasPermission(context.permissions, permission)) {
    throw new Error("No tienes permisos para realizar esta acción");
  }
  return context;
}
