import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const settings = supabaseConfig();
  const isDashboard =
    request.nextUrl.pathname === "/" &&
    ["GET", "HEAD"].includes(request.method);
  let response = NextResponse.next({ request });

  function toLogin(needsSetup = false) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = needsSetup ? "?status=setup" : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (!settings) return isDashboard && !isDemo() ? toLogin(true) : response;
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
  const { data } = await supabase.auth.getClaims();
  return isDashboard && !data?.claims?.sub ? toLogin() : response;
}

export const config = { matcher: ["/", "/masuk"] };
