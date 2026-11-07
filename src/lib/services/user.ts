import { createClient } from "@/lib/supabase/server";
import type { AccessPermissionCode } from "@/lib/permissions";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  username: string;
  role: string;
  permissions: AccessPermissionCode[];
  avatarUrl: string | null;
}

/**
 * Fetches the complete user profile using the robust clinical schema.
 * Joins users with their primary role for a single-query fetch.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // Fetch from the robust 'users' table joined with 'roles' via 'role_id'
  const { data: dbUser, error } = await supabase
    .from("users")
    .select(`
      id,
      email,
      full_name,
      username,
      is_active,
      roles (
        id,
        name,
        is_active
      )
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !dbUser || dbUser.is_active !== true) return null;

  const rolesData = dbUser.roles;
  const primaryRole = Array.isArray(rolesData) ? rolesData[0] : rolesData as { name: string; is_active: boolean } | null;
  if (!primaryRole?.is_active || typeof primaryRole.name !== "string") return null;

  const { data: permissionRows, error: permissionError } = await supabase.rpc("fn_current_user_access_permissions");
  if (permissionError || !Array.isArray(permissionRows)) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name || "Usuario",
    username: dbUser.username,
    role: primaryRole.name,
    permissions: permissionRows.map((row: { permission_code: string }) => row.permission_code),
    // Avatar is still fetched from Google metadata for simplicity
    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  };
}
