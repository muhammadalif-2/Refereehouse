import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signIn } from "../actions";
import { Brand } from "@/components/brand";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ready = !!supabaseConfig();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1>Masuk ke Referee House</h1>
        <p>Gunakan akun yang diberikan oleh administrator organisasi Anda.</p>
        {status === "invalid" && (
          <p className="auth-error" role="alert">
            Email atau kata sandi salah.
          </p>
        )}
        {status === "logout-error" && (
          <p className="auth-error" role="alert">
            Sesi belum dapat diakhiri. Silakan coba lagi.
          </p>
        )}
        {ready ? (
          <form action={signIn}>
            <label>
              Email
              <input
                autoComplete="username"
                name="email"
                type="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Kata sandi
              <input
                autoComplete="current-password"
                name="password"
                type="password"
                required
              />
            </label>
            <button className="primary" type="submit">
              Masuk <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <p className="auth-error">
            Hubungkan Supabase untuk mengaktifkan autentikasi.
          </p>
        )}
        {isDemo() && (
          <Link className="primary" href="/">
            Buka dasbor demo <ArrowRight size={16} />
          </Link>
        )}
      </section>
    </main>
  );
}
