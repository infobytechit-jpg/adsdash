"use server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };
  
  // Manually store the session tokens as cookies
  const cookieStore = cookies();
  const session = data.session;
  
  cookieStore.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: session.expires_in,
    path: '/',
  });
  
  cookieStore.set('sb-refresh-token', session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return { ok: true };
}
