import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Operations } from "@/components/basketball-operations";
import { demoOps } from "@/lib/operations/demo";
import type { Club, Workspace } from "@/lib/operations/model";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ pengcab?: string }>;
}) {
  const query = await searchParams;
  if (isDemo()) {
    const demo = demoOps();
    return <Operations initial={demo} clubs={[demo.club]} demo />;
  }
  if (!supabaseConfig()) redirect("/masuk?status=setup");
  const supabase = await getSupabase();
  if (!(await supabase.auth.getUser()).data.user) redirect("/masuk");
  const clubs = await supabase.rpc("basketball_clubs");
  const options = clubs.data as Club[] | null;
  const club = options?.find((c) => c.id === query.pengcab) ?? options?.[0];
  if (!club)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <Link href="/">
            <Brand />
          </Link>
          <h1>
            {clubs.error
              ? "Ruang kerja belum tersedia"
              : "Belum ada keanggotaan pengcab"}
          </h1>
          <p>
            {clubs.error
              ? "Coba lagi atau hubungi pengelola aplikasi."
              : "Buka link undangan yang dikirim oleh komisi untuk bergabung ke pengcab atau event."}
          </p>
          <form action={signOut}>
            <button className="primary">Keluar</button>
          </form>
        </section>
      </main>
    );
  const data = await supabase.rpc("basketball_workspace", { p_org: club.id });
  if (data.error || !data.data)
    throw new Error("Could not load basketball workspace");
  return (
    <Operations
      key={club.id}
      initial={data.data as Workspace}
      clubs={options ?? []}
    />
  );
}
