"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  console.log("Intentando login con:", email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("SUPABASE LOGIN ERROR:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  console.log("LOGIN OK:", data.user?.id);

  redirect("/inspections");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
