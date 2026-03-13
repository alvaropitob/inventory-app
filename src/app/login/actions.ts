"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/error?message=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  
  // Ultra-robust origin detection for Vercel/Production vs Local
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://inventory-app-ten-omega.vercel.app";

  console.log("Auth Origin Debug:", { host, protocol, origin });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect("/error?message=" + encodeURIComponent(error.message));
  }

  if (data.url) {
    redirect(data.url);
  }
}
