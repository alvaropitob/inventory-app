"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    redirect("/error?message=" + encodeURIComponent("Las contraseñas no coinciden"));
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    console.error("Signup error details:", error);
    redirect("/error?message=" + encodeURIComponent(error.message));
  }

  // Check if session was created (if email confirmation is OFF)
  if (data?.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  } else if (data?.user) {
    // Session not created, likely email confirmation is ON
    redirect("/error?message=" + encodeURIComponent("Cuenta creada. Por favor, revisa tu correo para confirmar tu registro."));
  } else {
    redirect("/error?message=" + encodeURIComponent("Error desconocido durante el registro."));
  }
}
