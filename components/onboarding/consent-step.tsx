"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { setResearchConsent } from "@/app/onboarding/actions";

import { GhostButton, PrimaryButton, StepHeader } from "./ui";

export function ConsentStep({
  onDone,
  onBack,
}: {
  onDone: (granted: boolean) => void;
  onBack: () => void;
}) {
  // Unchecked by default. Declining is first-class: leaving it unchecked and
  // continuing writes nothing.
  const [optIn, setOptIn] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await setResearchConsent({ optIn });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone(result.granted);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <StepHeader
        eyebrow="One optional thing"
        title="Help move pet medicine forward?"
        sub="Aggregate, de-identified records help vets and researchers spot what keeps animals healthy. This is entirely optional and never changes how Pawdex works for you."
      />

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 16,
          borderRadius: 14,
          background: optIn ? "var(--pw-accent-soft)" : "var(--pw-surface)",
          border: `1px solid ${optIn ? "var(--pw-accent)" : "var(--pw-border)"}`,
          cursor: "pointer",
          transition: "background 140ms ease, border-color 140ms ease",
        }}
      >
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          disabled={pending}
          style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: "var(--pw-accent)", cursor: "pointer" }}
        />
        <span style={{ font: "400 13.5px var(--font-inter)", color: "var(--pw-text-muted)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--pw-text)", fontWeight: 600 }}>
            Share my pets&apos; de-identified records for research
          </span>
          . Your name, contact details, and precise location are always stripped
          before anything leaves Pawdex. You choose the details, and you can
          revoke this anytime in Settings.
        </span>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "400 12px var(--font-inter)",
          color: "var(--pw-text-subtle)",
        }}
      >
        <Icon name="shield" size={14} />
        Revocation stops future sharing; it can&apos;t recall datasets already released.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <GhostButton onClick={onBack} icon="arrowLeft" disabled={pending}>
          Back
        </GhostButton>
        <div style={{ flex: 1 }}>
          <PrimaryButton onClick={submit} busy={pending}>
            {optIn ? "Share and continue" : "Continue"}
            <Icon name="arrowRight" size={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
