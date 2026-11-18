import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { tokenPattern } from "@/lib/operations/model";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const invite = url.searchParams.get("undangan") ?? "";
  if (supabaseConfig() && code) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          tokenPattern.test(invite) ? "/undangan/" + invite : "/ruang-kerja",
          url,
        ),
      );
  }
  const login = new URL("/masuk", url);
  login.searchParams.set("status", "confirmation");
  if (tokenPattern.test(invite)) login.searchParams.set("undangan", invite);
  return NextResponse.redirect(login);
}
