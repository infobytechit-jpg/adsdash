import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in → go dashboard
  if (user) redirect("/dashboard");

  // If NOT logged in → go login
  redirect("/login");
  export const dynamic = "force-dynamic";
}
