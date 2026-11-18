import { AccessForm } from "@/components/access-form";

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; undangan?: string }>;
}) {
  const { status, undangan } = await searchParams;
  return <AccessForm signup status={status} token={undangan} />;
}
