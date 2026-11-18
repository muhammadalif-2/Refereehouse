import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function getSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The proxy refreshes these sessions.
        }
      },
    },
  });
}
