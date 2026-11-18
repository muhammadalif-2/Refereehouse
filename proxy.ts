import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const settings = supabaseConfig();
  let response = NextResponse.next({ request });
  if (!settings) return response;
  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/ruang-kerja",
    "/ringkasan",
    "/masuk",
    "/daftar",
    "/undangan/:path*",
    "/api/operasional",
  ],
};
