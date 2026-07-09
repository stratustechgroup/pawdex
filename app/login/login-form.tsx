"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { sendMagicLink } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        startTransition(async () => {
          const result = await sendMagicLink({
            email: email.trim(),
            redirectTo,
          });
          if (result.ok) {
            router.replace(
              `/login?sent=1&redirect=${encodeURIComponent(redirectTo)}`,
            );
          } else {
            toast.error(result.error);
          }
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <label
        htmlFor="email"
        style={{
          font: "500 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isPending}
        style={{
          width: "100%",
          height: 40,
          padding: "0 12px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "400 14px var(--font-inter)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={isPending || !email.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          height: 40,
          marginTop: 4,
          borderRadius: 6,
          border: "1px solid var(--pw-accent)",
          background: "var(--pw-accent)",
          color: "#fff",
          font: "500 14px var(--font-inter)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending || !email.trim() ? 0.6 : 1,
        }}
      >
        {isPending ? "Sending…" : (
          <>
            Send magic link
            <Icon name="arrowRight" size={14} />
          </>
        )}
      </button>
    </form>
  );
}
