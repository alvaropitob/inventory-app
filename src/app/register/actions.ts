"use server";

import { redirect } from "next/navigation";

// Email/password sign-up is intentionally disabled; registration is Google OAuth only.
export async function signup() {
  redirect("/register");
}
