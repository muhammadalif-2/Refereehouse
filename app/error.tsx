"use client";

import { Brand } from "@/components/brand";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1>Ruang kerja belum dapat dimuat</h1>
        <p>Silakan coba kembali.</p>
        <button className="primary retry" onClick={reset}>
          Muat ulang
        </button>
      </section>
    </main>
  );
}
