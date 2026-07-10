"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPassword } from "./actions";
import { fieldStyle, labelStyle, primaryButtonStyle } from "./ui";

const MIN = 10;

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const tooShort = password.length > 0 && password.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN && confirm === password;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const r = await setPassword(password);
      if (r.ok) {
        toast.success(hasPassword ? "Password changed" : "Password added");
        setPasswordValue("");
        setConfirm("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label htmlFor="new_password" style={labelStyle}>
        {hasPassword ? "New password" : "Password"}
      </label>
      <input
        id="new_password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        placeholder={`At least ${MIN} characters`}
        disabled={isPending}
        style={fieldStyle}
      />
      <label htmlFor="confirm_password" style={labelStyle}>
        Confirm password
      </label>
      <input
        id="confirm_password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Re-enter it"
        disabled={isPending}
        style={fieldStyle}
      />
      {(tooShort || mismatch) && (
        <p
          style={{
            margin: 0,
            font: "400 12px var(--font-inter)",
            color: "var(--pw-status-overdue-fg)",
          }}
        >
          {tooShort
            ? `Use at least ${MIN} characters.`
            : "The two passwords don't match."}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={isPending || !valid}
          style={primaryButtonStyle(isPending || !valid)}
        >
          {isPending
            ? "Saving…"
            : hasPassword
              ? "Change password"
              : "Add password"}
        </button>
      </div>
    </form>
  );
}
