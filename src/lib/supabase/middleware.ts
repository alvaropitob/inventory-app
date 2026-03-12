import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value }: any) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }: any) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || 
                     request.nextUrl.pathname.startsWith("/register") || 
                     request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthPage && !request.nextUrl.pathname.startsWith("/error")) {
    // no user, redirect to login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is logged in, check for roles on protected routes using app_metadata (Custom Claims)
  if (user) {
    const userRole = user.app_metadata?.role as string | undefined;

    if (request.nextUrl.pathname.startsWith("/dashboard/usuarios") || 
        request.nextUrl.pathname.startsWith("/dashboard/configuracion")) {
      if (userRole !== "admin") {
        // Not an admin, redirect to dashboard home
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // If on auth page but already logged in, redirect to dashboard
    // Exception: Explicitly allow /auth/signout to proceed
    if (isAuthPage && !request.nextUrl.pathname.startsWith("/auth/signout")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
