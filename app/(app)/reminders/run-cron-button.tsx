"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { runRemindersNow } from "./actions";

export function RunCronButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const r = await runRemindersNow();
            if (r.ok) {
              const summary = JSON.stringify(r.result);
              setLastResult(summary);
              toast.success("Cron run triggered");
              router.refresh();
            } else {
              setLastResult(null);
              toast.error(r.error);
            }
          });
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 12px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "500 12.5px var(--font-inter)",
          cursor: isPending ? "default" : "pointer",
        }}
      >
        <Icon name="refresh" size={13} />
        {isPending ? "Running…" : "Run reminders now"}
      </button>
      {lastResult && (
        <code
          className="mono"
          style={{
            font: "400 10.5px var(--font-jetbrains)",
            color: "var(--pw-text-muted)",
            maxWidth: 360,
            wordBreak: "break-all",
            textAlign: "right",
          }}
        >
          {lastResult}
        </code>
      )}
    </div>
  );
}
