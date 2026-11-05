import { hasPermission, isAppRole, type AppPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

async function getAuthorizationContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile, error } = await supabase
    .from("users")
    .select("is_active, roles!inner(name, is_active)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.is_active !== true) {
    throw new Error("Usuario inactivo o sin perfil autorizado");
  }

  const roleData = profile.roles as unknown as { name: string; is_active: boolean } | { name: string; is_active: boolean }[];
  const roleRecord = Array.isArray(roleData) ? roleData[0] : roleData;
  if (!roleRecord?.is_active || !isAppRole(roleRecord.name)) {
    throw new Error("El usuario no tiene un rol activo autorizado");
  }

  return { supabase, user, role: roleRecord.name };
}

export async function requirePermission(permission: AppPermission) {
  const context = await getAuthorizationContext();
  if (!hasPermission(context.role, permission)) {
    throw new Error("No tienes permisos para realizar esta acción");
  }
  return context;
}
