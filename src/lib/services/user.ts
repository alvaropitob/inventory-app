import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  username: string;
  role: string;
  avatarUrl: string | null;
}

/**
 * Fetches the complete user profile using the robust clinical schema.
 * Joins users with their primary role for a single-query fetch.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  let { data: { user } } = await supabase.auth.getUser();
  
  // LOCAL DEVELOPMENT BYPASS
  if (!user && process.env.NODE_ENV === 'development') {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'alvaro_local@dev.com',
      fullName: 'Administrador Local',
      username: 'admin_local',
      role: 'admin',
      avatarUrl: null,
    };
  }

  if (!user) return null;

  // Fetch from the robust 'users' table joined with 'roles' via 'role_id'
  const { data: dbUser, error } = await supabase
    .from("users")
    .select(`
      id,
      email,
      full_name,
      username,
      roles (
        name
      )
    `)
    .eq("id", user.id)
    .single();

  if (error || !dbUser) {
    console.error("Error fetching user profile:", error);
    // Fallback if the record hasn't synced yet or query fails
    return {
      id: user.id,
      email: user.email || "",
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || "Usuario",
      username: user.email || "",
      role: (user.app_metadata?.role as string) || "operator",
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    };
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name || "Usuario",
    username: dbUser.username,
    role: (dbUser.roles as { name: string })?.name || "operator",
    // Avatar is still fetched from Google metadata for simplicity
    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  };
}
