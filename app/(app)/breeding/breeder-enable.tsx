"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { enableBreederMode } from "./actions";

export function BreederEnable({ canEnable }: { canEnable: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleEnable() {
    startTransition(async () => {
      const r = await enableBreederMode();
      // enableBreederMode redirects on success; a returned value means an error.
      if (r && !r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="pw-card" style={{ padding: 32 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "var(--pw-accent-soft)",
          color: "var(--pw-accent-fg-on-soft)",
          marginBottom: 16,
        }}
      >
        <Icon name="paw" size={22} />
      </div>
      <h1
        className="serif"
        style={{
          margin: "0 0 8px",
          font: "500 24px var(--font-source-serif)",
          color: "var(--pw-text)",
        }}
      >
        Breeder tools
      </h1>
      <p
        style={{
          margin: "0 0 18px",
          font: "400 13.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.6,
          maxWidth: 520,
        }}
      >
        Turn on breeder mode to group your animals into litters, track each
        puppy&apos;s placement status, and hand animals to their new families
        with a secure transfer link. The puppy&apos;s full medical record travels
        with it; your household&apos;s business and communication history stays
        private.
      </p>

      <ul
        style={{
          listStyle: "none",
          margin: "0 0 22px",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {[
          "Organize animals into litters with dam, sire, and whelp date",
          "Mark each puppy available, reserved, or placed",
          "Generate a transfer link that moves the animal and its records",
        ].map((line) => (
          <li
            key={line}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            <Icon name="checkCircle" size={16} style={{ color: "var(--pw-accent)" }} />
            {line}
          </li>
        ))}
      </ul>

      {canEnable ? (
        <button
          type="button"
          onClick={handleEnable}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            padding: "0 20px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            border: "1px solid var(--pw-accent)",
            color: "#fff",
            font: "500 13.5px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Enabling…" : "Enable breeder tools"}
          <Icon name="arrowRight" size={14} />
        </button>
      ) : (
        <div
          style={{
            padding: "12px 14px",
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
          }}
        >
          Only the household owner can enable breeder tools. Ask an owner to turn
          this on.
        </div>
      )}

      <div
        style={{
          marginTop: 22,
          paddingTop: 20,
          borderTop: "1px solid var(--pw-border)",
        }}
      >
        <div
          style={{
            font: "500 13px var(--font-inter)",
            color: "var(--pw-text)",
            marginBottom: 4,
          }}
        >
          Prefer to keep them apart?
        </div>
        <p
          style={{
            margin: "0 0 12px",
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          Create a separate breeder household instead. Your personal pets stay in
          this household; the breeding operation lives in its own space, and you
          flip between them from the household menu in the top bar.
        </p>
        <Link
          href="/settings/household?kind=breeder#new-household"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 16px",
            borderRadius: 6,
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border-strong)",
            color: "var(--pw-text)",
            font: "500 13px var(--font-inter)",
            textDecoration: "none",
          }}
        >
          <Icon name="plus" size={14} />
          Create a separate breeder household
        </Link>
      </div>
    </div>
  );
}
