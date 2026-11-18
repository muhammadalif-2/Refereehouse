"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});

export async function signIn(form: FormData) {
  if (!supabaseConfig()) redirect("/masuk?status=setup");
  const input = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success) redirect("/masuk?status=invalid");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword(input.data);
  if (error) redirect("/masuk?status=invalid");
  redirect("/");
}

export async function signOut() {
  if (supabaseConfig()) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) redirect("/masuk?status=logout-error");
  }
  redirect("/masuk");
}
