export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isDemo() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return false;
  }
  return (
    process.env.REFEREE_HOUSE_DEMO === "true" ||
    (process.env.NODE_ENV === "development" &&
      process.env.REFEREE_HOUSE_DEMO !== "false")
  );
}
