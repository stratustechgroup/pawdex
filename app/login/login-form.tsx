"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { createClient } from "@/lib/supabase/browser";
import { sendMagicLink, sendPasswordReset } from "./actions";

type Mode = "magic" | "password";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 14px var(--font-inter)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  font: "500 12.5px var(--font-inter)",
  color: "var(--pw-text-muted)",
};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [mode, setMode] = useState<Mode>("magic");

  return mode === "magic" ? (
    <MagicLinkForm redirectTo={redirectTo} onUsePassword={() => setMode("password")} />
  ) : (
    <PasswordForm redirectTo={redirectTo} onUseMagic={() => setMode("magic")} />
  );
}

function MagicLinkForm({
  redirectTo,
  onUsePassword,
}: {
  redirectTo: string;
  onUsePassword: () => void;
}) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          startTransition(async () => {
            const result = await sendMagicLink({ email: email.trim(), redirectTo });
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
        <label htmlFor="email" style={labelStyle}>
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
          style={inputStyle}
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
          {isPending ? (
            "Sending…"
          ) : (
            <>
              Send magic link
              <Icon name="arrowRight" size={14} />
            </>
          )}
        </button>
      </form>
      <button
        type="button"
        onClick={onUsePassword}
        style={toggleStyle}
      >
        Use a password instead
      </button>
    </div>
  );
}

function PasswordForm({
  redirectTo,
  onUseMagic,
}: {
  redirectTo: string;
  onUseMagic: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        // Both a wrong password and a magic-link-only account (no password set)
        // surface as the same generic credential error; steer either back to
        // the magic link, which always works.
        toast.error(
          "That email and password didn't match. If you've only used magic links before, switch below to get one, then add a password from Settings.",
        );
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  function handleForgot() {
    if (!email.trim()) {
      toast.error("Enter your email first, then tap Forgot password.");
      return;
    }
    startTransition(async () => {
      const result = await sendPasswordReset({ email: email.trim() });
      if (result.ok) {
        toast.success("Check your email for a password reset link.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="pw-email" style={labelStyle}>
          Email
        </label>
        <input
          id="pw-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          style={inputStyle}
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <label htmlFor="pw-password" style={labelStyle}>
            Password
          </label>
          <button
            type="button"
            onClick={handleForgot}
            disabled={isPending}
            style={{
              border: 0,
              background: "transparent",
              color: "var(--pw-accent)",
              font: "500 12px var(--font-inter)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>
        <input
          id="pw-password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={isPending || !email.trim() || !password}
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
            opacity: isPending || !email.trim() || !password ? 0.6 : 1,
          }}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button type="button" onClick={onUseMagic} style={toggleStyle}>
        Email me a magic link instead
      </button>
    </div>
  );
}

const toggleStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--pw-text-muted)",
  font: "500 12.5px var(--font-inter)",
  cursor: "pointer",
  padding: "4px 0",
  textAlign: "center",
};
