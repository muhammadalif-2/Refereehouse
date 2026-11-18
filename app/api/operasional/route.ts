import { NextResponse } from "next/server";
import { commandSchema } from "@/lib/operations/model";
import { getSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!supabaseConfig())
    return NextResponse.json(
      { error: "Gunakan ruang kerja demo." },
      { status: 503 },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Asal permintaan tidak valid." },
      { status: 403 },
    );
  const body = await request.text();
  if (body.length > 8192)
    return NextResponse.json(
      { error: "Permintaan terlalu besar." },
      { status: 413 },
    );
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Permintaan tidak valid." },
      { status: 400 },
    );
  }
  const input = commandSchema.safeParse(payload);
  if (!input.success)
    return NextResponse.json(
      { error: "Periksa kembali isian, tanggal, dan jumlah honor." },
      { status: 400 },
    );
  const supabase = await getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json(
      { error: "Sesi berakhir. Masuk kembali." },
      { status: 401 },
    );
  const result = await supabase.rpc("basketball_command", { p: input.data });
  if (result.error) {
    const error = result.error;
    const statuses: Record<string, number> = {
      "42501": 403,
      "23514": 422,
      "23505": 409,
    };
    const message =
      statuses[error.code] &&
      !/constraint|violates|permission denied/i.test(error.message)
        ? error.message
        : "Perubahan belum tersimpan. Periksa isian dan coba lagi.";
    return NextResponse.json(
      { error: message },
      { status: statuses[error.code] ?? 500 },
    );
  }
  return NextResponse.json(result.data);
}
