"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  
  console.log("LOGIN ATTEMPT:", email);
  
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  console.log("LOGIN RESULT - user:", data?.user?.email, "session:", !!data?.session, "error:", error?.message);
  
  if (error) return { ok: false, message: error.message };
  redirect("/dashboard");
}
