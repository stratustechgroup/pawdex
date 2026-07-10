"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveIdentity } from "@/app/onboarding/actions";

import { Icon } from "@/components/brand/icon";
import {
  PrimaryButton,
  StepHeader,
  TextField,
  inputStyle,
} from "./ui";

export function IdentityStep({
  initialDisplayName,
  initialHouseholdName,
  suggestedHouseholdName,
  onDone,
}: {
  initialDisplayName: string;
  initialHouseholdName: string;
  suggestedHouseholdName: string;
  onDone: (data: { displayName: string; householdName: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [householdName, setHouseholdName] = useState(initialHouseholdName);
  const [pending, startTransition] = useTransition();

  const canContinue = displayName.trim().length > 0 && householdName.trim().length > 0;

  function submit() {
    if (!canContinue) return;
    startTransition(async () => {
      const result = await saveIdentity({
        displayName: displayName.trim(),
        householdName: householdName.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone({ displayName: displayName.trim(), householdName: householdName.trim() });
    });
  }

  const showSuggestion =
    householdName.trim() !== suggestedHouseholdName &&
    suggestedHouseholdName.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <StepHeader
        eyebrow="Welcome"
        title="Let's get you set up."
        sub="Two quick things, then we'll add your first pet. This takes about a minute."
      />

      <TextField label="What should we call you?">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Alex"
          style={inputStyle}
          autoFocus
          autoComplete="name"
          enterKeyHint="next"
        />
      </TextField>

      <TextField
        label="Your household"
        hint="This is how your pets are grouped. You can share it with family later."
      >
        <input
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
          placeholder="The Rivera household"
          style={inputStyle}
          enterKeyHint="done"
        />
        {showSuggestion ? (
          <button
            type="button"
            onClick={() => setHouseholdName(suggestedHouseholdName)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 9,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface-2)",
              color: "var(--pw-text-secondary)",
              font: "500 12px var(--font-inter)",
              cursor: "pointer",
            }}
          >
            <Icon name="sparkles" size={12} />
            Use &ldquo;{suggestedHouseholdName}&rdquo;
          </button>
        ) : null}
      </TextField>

      <PrimaryButton type="submit" disabled={!canContinue} busy={pending}>
        Continue
        <Icon name="arrowRight" size={16} />
      </PrimaryButton>
    </form>
  );
}
