"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  demoStorage,
  redeemDemo,
  type DemoInviteTokens,
} from "@/lib/operations/demo";
import type { Workspace } from "@/lib/operations/model";

export function DemoInvite({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          const saved = JSON.parse(
            localStorage.getItem(demoStorage) ?? "null",
          ) as { state: Workspace; tokens: DemoInviteTokens } | null;
          if (!saved)
            throw new Error("Buka undangan demo dari browser yang membuatnya.");
          const result = redeemDemo(
            saved.state,
            saved.tokens,
            token,
            String(form.get("name")),
            String(form.get("email")),
            String(form.get("region")),
          );
          localStorage.setItem(demoStorage, JSON.stringify(saved));
          router.push("/ruang-kerja?peran=referee&wasit=" + result.referee_id);
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Undangan belum diterima.",
          );
        }
      }}
    >
      <label>
        Nama wasit
        <input name="name" minLength={2} maxLength={150} required />
      </label>
      <label>
        Email yang dituju
        <input name="email" type="email" maxLength={254} required />
      </label>
      <label>
        Daerah asal
        <input name="region" minLength={2} maxLength={150} required />
      </label>
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}
      <button className="primary">Terima undangan demo</button>
    </form>
  );
}
