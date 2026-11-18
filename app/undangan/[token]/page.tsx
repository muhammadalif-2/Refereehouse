import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { DemoInvite } from "@/components/demo-invite";
import { tokenPattern } from "@/lib/operations/model";
import { getSupabase } from "@/lib/supabase/server";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";
import { acceptInvite } from "../../actions";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  if (!tokenPattern.test(token)) notFound();
  const { status } = await searchParams;
  const demo = isDemo();
  const authenticated =
    supabaseConfig() && (await (await getSupabase()).auth.getUser()).data.user;
  return (
    <main className="auth-page">
      <section className="auth-card access-card">
        <Link href="/">
          <Brand />
        </Link>
        <h1>Undangan Referee House</h1>
        <p>
          {demo
            ? "Data fiktif. Terima undangan pada browser yang sama dengan pembuatannya."
            : "Gunakan email yang diundang untuk bergabung ke pengcab atau event."}
        </p>
        {status === "invalid" && (
          <p className="auth-error" role="alert">
            Undangan kedaluwarsa, dicabut, atau alamat email berbeda.
          </p>
        )}
        {demo ? (
          <DemoInvite token={token} />
        ) : authenticated ? (
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={token} />
            <label>
              Daerah asal
              <input name="region" minLength={2} maxLength={150} required />
            </label>
            <button className="primary">Terima undangan</button>
          </form>
        ) : (
          <>
            <Link className="primary" href={"/masuk?undangan=" + token}>
              Masuk untuk menerima
            </Link>
            <Link
              className="access-alternate"
              href={"/daftar?undangan=" + token}
            >
              Buat akun baru
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
