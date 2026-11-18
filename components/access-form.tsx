import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";
import { tokenPattern } from "@/lib/operations/model";
import { Brand } from "./brand";

const messages: Record<string, string> = {
  invalid: "Periksa kembali alamat email dan kata sandi.",
  "logout-error": "Sesi belum dapat diakhiri. Silakan coba lagi.",
  email:
    "Buka email konfirmasi di browser yang sama. Setelah verifikasi, kamu akan kembali ke undangan atau ruang kerja.",
  failed:
    "Pendaftaran belum berhasil. Coba lagi atau masuk jika sudah punya akun.",
  required: "Masuk dengan email yang menerima undangan.",
  confirmation:
    "Konfirmasi belum dapat diproses. Buka email dari browser tempat kamu mendaftar atau masuk kembali.",
};

export function AccessForm({
  signup = false,
  status,
  token = "",
}: {
  signup?: boolean;
  status?: string;
  token?: string;
}) {
  const ready = !!supabaseConfig();
  const invite = tokenPattern.test(token) ? token : "";
  const toggle = signup ? "/masuk" : "/daftar";
  return (
    <main className="auth-page">
      <section className="auth-card access-card">
        <Link href="/" aria-label="Beranda Referee House">
          <Brand />
        </Link>
        <h1>{signup ? "Daftar sebagai wasit" : "Masuk ke Referee House"}</h1>
        <p>
          {invite
            ? "Gunakan email yang dituju undangan."
            : signup
              ? "Siapkan akun untuk bergabung ke pengcab atau event yang mengundangmu."
              : "Buka ruang kerja basket sesuai peran akunmu."}
        </p>
        {status && messages[status] && (
          <p
            className={status === "email" ? "access-success" : "auth-error"}
            role="status"
          >
            {messages[status]}
          </p>
        )}
        {status !== "email" && (
          <form action={signup ? signUp : signIn}>
            <fieldset disabled={!ready}>
              <input type="hidden" name="undangan" value={invite} />
              {signup && (
                <label>
                  Nama lengkap
                  <input
                    autoComplete="name"
                    name="name"
                    minLength={2}
                    maxLength={150}
                    required
                  />
                </label>
              )}
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
                  autoComplete={signup ? "new-password" : "current-password"}
                  name="password"
                  type="password"
                  minLength={signup ? 12 : undefined}
                  required
                />
              </label>
              <button className="primary" type="submit">
                {signup ? "Buat akun" : "Masuk"} <ArrowRight size={16} />
              </button>
            </fieldset>
          </form>
        )}
        {!ready && (
          <p className="auth-error">
            Pendaftaran dan masuk dengan email tersedia setelah Supabase
            dikonfigurasi.
          </p>
        )}
        {isDemo() && (
          <Link
            className="primary"
            href={invite ? "/undangan/" + invite : "/ruang-kerja"}
          >
            {invite ? "Buka undangan demo" : "Buka dasbor demo"}{" "}
            <ArrowRight size={16} />
          </Link>
        )}
        <Link
          className="access-alternate"
          href={toggle + (invite ? "?undangan=" + invite : "")}
        >
          {signup ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
        </Link>
      </section>
    </main>
  );
}
