import { AccessForm } from "@/components/access-form";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; undangan?: string }>;
}) {
  const { status, undangan } = await searchParams;
  return <AccessForm status={status} token={undangan} />;
}
