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

  const {
    data: { user: realUser },
  } = await supabase.auth.getUser();

  const isDev = process.env.NODE_ENV === "development";
  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || 
                     request.nextUrl.pathname.startsWith("/register") || 
                     request.nextUrl.pathname.startsWith("/auth");
  const isErrorPage = request.nextUrl.pathname.startsWith("/error");

  // CASE 1: No real user, but we are in dev mode -> Apply Bypass
  if (!realUser && isDev) {
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }


  // CASE 2: No user and not in bypass mode -> Normal login redirect
  if (!realUser && !isAuthPage && !isErrorPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // CASE 3: Authenticated user (real or via Supabase)
  if (realUser) {
    const userRole = realUser.app_metadata?.role as string | undefined;

    // Protected Admin Routes
    if (request.nextUrl.pathname.startsWith("/dashboard/usuarios") || 
        request.nextUrl.pathname.startsWith("/dashboard/configuracion")) {
      if (userRole !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Redirect away from auth pages if logged in
    if (isAuthPage && !request.nextUrl.pathname.startsWith("/auth/signout")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
