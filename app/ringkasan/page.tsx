import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Brand } from "@/components/brand";
import { dashboardSchema } from "@/lib/dashboard";
import { demoDashboard } from "@/lib/demo";
import { dateRange, todayInJakarta } from "@/lib/dates";
import { roles, type Role, type Membership } from "@/lib/access";
import { isDemo, supabaseConfig } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/server";
import { signOut } from "../actions";

type Params = Record<string, string | string[] | undefined>;

function State({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1>{title}</h1>
        <p>{message}</p>
        <form action={signOut}>
          <button className="primary">Keluar</button>
        </form>
      </section>
    </main>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const today = todayInJakarta();
  const range = dateRange(params, today);
  if (isDemo()) {
    const membership: Membership = {
      id: "demo",
      name: "Federasi Wasit Jakarta",
      role: "organization_admin",
    };
    return (
      <DashboardShell
        data={demoDashboard(range, today)}
        range={range}
        today={today}
        organization={membership}
        memberships={[membership]}
        viewer={{ name: "Bima Aditya", role: membership.role }}
        demo
      />
    );
  }
  if (!supabaseConfig()) redirect("/masuk?status=setup");
  const supabase = await getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/masuk");

  const [organizations, profile] = await Promise.all([
    supabase.rpc("my_organizations"),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .maybeSingle(),
  ]);
  if (organizations.error || profile.error)
    return (
      <State
        title="Ruang kerja tidak tersedia"
        message="Coba masuk kembali atau hubungi administrator."
      />
    );
  const memberships =
    (organizations.data as { id: string; name: string; role: Role }[] | null) ??
    [];
  const organization =
    memberships.find((item) => item.id === params.org) ?? memberships[0];
  if (!organization)
    return (
      <State
        title="Keanggotaan belum tersedia"
        message="Hubungi administrator untuk mendapatkan akses ke organisasi Anda."
      />
    );
  if (!Object.hasOwn(roles, organization.role))
    return (
      <State
        title="Akses tidak tersedia"
        message="Hubungi administrator organisasi."
      />
    );

  const { data, error } = await supabase.rpc("dashboard_summary", {
    target_org: organization.id,
    date_from: range.from,
    date_to: range.to,
  });
  const parsed = dashboardSchema.safeParse(data);
  if (error || !parsed.success)
    return (
      <State
        title="Dasbor belum dapat dimuat"
        message="Coba masuk kembali atau hubungi administrator."
      />
    );
  return (
    <DashboardShell
      data={parsed.data}
      range={range}
      today={today}
      organization={organization}
      memberships={memberships}
      viewer={{
        name:
          profile.data?.full_name ||
          auth.user.email?.split("@")[0] ||
          "Pengguna",
        role: organization.role,
      }}
    />
  );
}
