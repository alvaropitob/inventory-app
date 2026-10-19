import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  try {
    return createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll(): Cookie[] {
            return cookieStore.getAll() as Cookie[];
          },
          setAll(cookiesToSet: Cookie[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cookieStore.set(name, value, options as any)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    );
  } catch (error) {
    // Server components cannot persist refreshed cookies; middleware handles that.
    // Do not silently switch to a browser client in a server context.
    throw error;
  }
}

interface Cookie {
  name: string;
  value: string;
  options: unknown;
}
