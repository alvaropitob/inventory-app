import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/user";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) next = "/dashboard";

  const allowedTypes = new Set(["signup", "email", "invite", "magiclink", "recovery"]);
  if (token_hash && type && allowedTypes.has(type)) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "email" | "invite" | "magiclink" | "recovery",
      token_hash,
    });

    if (!error) {
      if (type === "invite" && (next === "/dashboard" || next.startsWith("/dashboard/"))) {
        redirect("/auth/reset-password");
      }
      if ((next === "/dashboard" || next.startsWith("/dashboard/")) && !(await getCurrentUserProfile())) {
        await supabase.auth.signOut();
        redirect("/login?access=pending");
      }
      redirect(next);
    }
  }

  // redirect the user to an error page with some instructions
  redirect("/error?message=" + encodeURIComponent("Could not verify email. Please try again."));
}
