"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { tokenPattern } from "@/lib/operations/model";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});

function authLink(path: string, status: string, token: string) {
  return (
    path +
    "?" +
    new URLSearchParams({
      status,
      ...(tokenPattern.test(token) ? { undangan: token } : {}),
    })
  );
}

function inviteDestination(token: string) {
  return tokenPattern.test(token) ? "/undangan/" + token : "/ruang-kerja";
}

export async function signIn(form: FormData) {
  const token = String(form.get("undangan") ?? "");
  if (!supabaseConfig()) redirect(authLink("/masuk", "setup", token));
  const input = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success) redirect(authLink("/masuk", "invalid", token));
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword(input.data);
  if (error) redirect(authLink("/masuk", "invalid", token));
  redirect(inviteDestination(token));
}

export async function signUp(form: FormData) {
  const token = String(form.get("undangan") ?? "");
  if (!supabaseConfig()) redirect(authLink("/daftar", "setup", token));
  const input = credentials
    .extend({
      password: z.string().min(12).max(128),
      full_name: z.string().trim().min(2).max(150),
    })
    .safeParse({
      email: form.get("email"),
      password: form.get("password"),
      full_name: form.get("name"),
    });
  if (!input.success) redirect(authLink("/daftar", "invalid", token));
  const base =
    process.env.REFEREE_HOUSE_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : "http://localhost:3000");
  const callback = new URL("/auth/konfirmasi", base);
  if (tokenPattern.test(token)) callback.searchParams.set("undangan", token);
  const supabase = await getSupabase();
  const result = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      emailRedirectTo: callback.href,
      data: { full_name: input.data.full_name },
    },
  });
  if (result.error) redirect(authLink("/daftar", "failed", token));
  if (result.data.session) redirect(inviteDestination(token));
  redirect(authLink("/daftar", "email", token));
}

export async function acceptInvite(form: FormData) {
  const token = String(form.get("token") ?? "");
  const region = z
    .string()
    .trim()
    .min(2)
    .max(150)
    .safeParse(form.get("region"));
  if (!tokenPattern.test(token) || !region.success || !supabaseConfig())
    redirect("/ruang-kerja");
  const supabase = await getSupabase();
  if (!(await supabase.auth.getUser()).data.user)
    redirect(authLink("/masuk", "required", token));
  const response = await supabase.rpc("basketball_accept_invite", {
    p_token: token,
    p_region: region.data,
  });
  if (response.error) redirect("/undangan/" + token + "?status=invalid");
  redirect("/ruang-kerja?pengcab=" + response.data);
}

export async function signOut() {
  if (supabaseConfig()) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) redirect("/masuk?status=logout-error");
  }
  redirect("/masuk");
}
