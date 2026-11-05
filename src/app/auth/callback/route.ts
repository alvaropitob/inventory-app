import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/dashboard";

  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(
        new URL(`/error?message=${encodeURIComponent(error.message || "Code exchange failed")}`, request.url)
      );
    }

    if (next === "/dashboard" || next.startsWith("/dashboard/")) {
      const profile = await getCurrentUserProfile();
      if (!profile) {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.trim().toLowerCase() || "";
        const reason = email.endsWith("@gmail.com") ? "pending" : "gmail-only";
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL(`/login?access=${reason}`, request.url));
      }
    }
    
    return NextResponse.redirect(new URL(next, request.url));
  }

  const authError = searchParams.get("error_description") || searchParams.get("error");
  if (authError) {
    const message = authError.toLowerCase();
    if (message.includes("gmail") || message.includes("google") || message.includes("provider")) {
      return NextResponse.redirect(new URL("/register?error=gmail-only", request.url));
    }
  }

  return NextResponse.redirect(
    new URL(`/error?message=${encodeURIComponent("No authorization code provided")}`, request.url)
  );
}
