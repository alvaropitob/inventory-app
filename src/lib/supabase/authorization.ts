import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "supervisor" | "operator" | "auditor";

/** Resolve authorization from the database profile, never client metadata. */
export async function requireRole(allowed: AppRole[]) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile, error } = await supabase
    .from("users")
    .select("is_active, roles!inner(name)")
    .eq("id", user.id)
    .single();
  if (error || !profile?.is_active) throw new Error("Usuario inactivo o sin perfil autorizado");
  const roleData = profile.roles as unknown as { name: string } | { name: string }[];
  const role = Array.isArray(roleData) ? roleData[0]?.name : roleData?.name;
  if (!role || !allowed.includes(role as AppRole)) throw new Error("No tienes permisos para realizar esta acción");
  return { supabase, user, role: role as AppRole };
}
