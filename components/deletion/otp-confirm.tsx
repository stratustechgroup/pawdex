"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Reusable email-OTP step for high-stakes confirmations (household + account
 * deletion). The parent supplies a `sendCode` action (which emails a code to the
 * signed-in user) and owns the typed `code` value. This renders "send code",
 * shows where it went, and a 6-digit entry field.
 */
export function OtpConfirm({
  code,
  onChange,
  sendCode,
  id = "otp-confirm",
}: {
  code: string;
  onChange: (next: string) => void;
  sendCode: () => Promise<
    { ok: true; sentTo: string } | { ok: false; error: string }
  >;
  id?: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, startSend] = useTransition();

  function send() {
    startSend(async () => {
      const r = await sendCode();
      if (r.ok) {
        setSentTo(r.sentTo);
        toast.success(`Code sent to ${r.sentTo}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Label htmlFor={id} style={{ color: "var(--pw-text)" }}>
          Email verification code
        </Label>
        <Button
          type="button"
          variant="ghost"
          onClick={send}
          disabled={isSending}
          style={{ height: 28, fontSize: 12 }}
        >
          {isSending ? "Sending…" : sentTo ? "Resend code" : "Send code"}
        </Button>
      </div>
      <Input
        id={id}
        value={code}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        disabled={!sentTo}
      />
      {sentTo && (
        <p
          style={{
            margin: 0,
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          We sent a code to {sentTo}. Enter it above to confirm.
        </p>
      )}
    </div>
  );
}
