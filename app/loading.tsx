import { Brand } from "@/components/brand";

export default function Loading() {
  return (
    <main className="auth-page" aria-busy="true">
      <section className="auth-card">
        <Brand />
        <p role="status">Memuat ruang kerja…</p>
      </section>
    </main>
  );
}
