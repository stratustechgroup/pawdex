"use client";

import { useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { scheduleFirstYearReminders } from "@/app/onboarding/actions";
import {
  buildFirstYearPlan,
  remindableItems,
  type FirstYearCategory,
  type FirstYearItem,
  type PlanSpecies,
} from "@/lib/clinical/first-year";

import { GhostButton, PrimaryButton, StepHeader } from "./ui";

const CATEGORY_ICON: Record<FirstYearCategory, string> = {
  vaccine: "syringe",
  preventative: "shield",
  procedure: "stethoscope",
  wellness: "heart",
};

export function FirstYearTimeline({
  petName,
  petId,
  species,
  birthDate,
  onBack,
  onFinish,
}: {
  petName: string;
  petId: string;
  species: PlanSpecies;
  birthDate: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const plan = useMemo(
    () => buildFirstYearPlan({ species, birthDate }),
    [species, birthDate],
  );

  const [pending, startTransition] = useTransition();
  const [scheduled, setScheduled] = useState<{ created: number; requested: number } | null>(
    null,
  );

  if (!plan) {
    // Should not happen (caller only offers this for young dogs/cats with a
    // DOB), but stay honest rather than render an empty timeline.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <StepHeader
          title="No plan to show yet"
          sub="Add a birthday for a dog or cat and we can project a first-year schedule."
        />
        <PrimaryButton onClick={onFinish}>Go to dashboard</PrimaryButton>
      </div>
    );
  }

  const remindableCount = remindableItems(plan).length;
  const sorted = [...plan.items].sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  function remindMe() {
    startTransition(async () => {
      const result = await scheduleFirstYearReminders({
        petId,
        species,
        birthDate,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setScheduled({ created: result.created, requested: result.requested });
      toast.success(
        result.created === 1
          ? "1 reminder scheduled"
          : `${result.created} reminders scheduled`,
      );
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StepHeader
        eyebrow="First-year plan"
        title={`${petName}'s first year, mapped out`}
        sub="Dates are projected from the birthday you entered."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--pw-surface-2)",
          border: "1px solid var(--pw-border)",
          font: "400 12px var(--font-inter)",
          color: "var(--pw-text-secondary)",
          lineHeight: 1.45,
        }}
      >
        <Icon name="info" size={15} />
        A typical schedule to plan around, not medical advice. Always confirm
        timing with your vet.
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {sorted.map((item, i) => (
          <TimelineRow key={item.key} item={item} isLast={i === sorted.length - 1} />
        ))}
      </ol>

      {remindableCount > 0 && !scheduled ? (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "var(--pw-surface)",
            border: "1px solid var(--pw-border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ font: "400 13px var(--font-inter)", color: "var(--pw-text-muted)", lineHeight: 1.5 }}>
            Want a nudge before each vaccine milestone? We&apos;ll email you as
            the {remindableCount === 1 ? "date" : `${remindableCount} upcoming vaccine dates`} approach.
          </div>
          <PrimaryButton onClick={remindMe} busy={pending}>
            <Icon name="bell" size={16} />
            Remind me about {remindableCount === 1 ? "it" : "these"}
          </PrimaryButton>
        </div>
      ) : null}

      {scheduled ? <ScheduledNote scheduled={scheduled} /> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <GhostButton onClick={onBack} icon="arrowLeft" disabled={pending}>
          Back
        </GhostButton>
        <div style={{ flex: 1 }}>
          <PrimaryButton onClick={onFinish} disabled={pending}>
            Go to dashboard
            <Icon name="arrowRight" size={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function ScheduledNote({ scheduled }: { scheduled: { created: number; requested: number } }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "var(--pw-status-up-bg)",
        border: "1px solid var(--pw-status-up-fg)",
        display: "flex",
        gap: 10,
      }}
    >
      <Icon name="checkCircle" size={18} />
      <div style={{ font: "400 13px var(--font-inter)", color: "var(--pw-text)", lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>
          {scheduled.created === 1
            ? "1 reminder scheduled."
            : `${scheduled.created} reminders scheduled.`}
        </strong>{" "}
        You&apos;ll get an email about a week before each vaccine date. Find them
        anytime on your Reminders page. The non-vaccine items above (like the
        spay/neuter window) stay here as a guide.
      </div>
    </div>
  );
}

function TimelineRow({ item, isLast }: { item: FirstYearItem; isLast: boolean }) {
  const due = parseISO(item.dueOn);
  return (
    <li style={{ display: "flex", gap: 12 }}>
      {/* Rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 30 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: item.isPast ? "var(--pw-surface-2)" : "var(--pw-accent-soft)",
            color: item.isPast ? "var(--pw-text-subtle)" : "var(--pw-accent-fg-on-soft)",
            border: `1px solid ${item.isPast ? "var(--pw-border)" : "var(--pw-accent)"}`,
          }}
        >
          <Icon name={item.isPast ? "check" : CATEGORY_ICON[item.category]} size={14} />
        </span>
        {!isLast ? (
          <span style={{ flex: 1, width: 2, background: "var(--pw-border)", minHeight: 14 }} />
        ) : null}
      </div>

      {/* Body */}
      <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1, opacity: item.isPast ? 0.62 : 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ font: "600 14px var(--font-inter)", color: "var(--pw-text)" }}>
            {item.title}
          </span>
          {item.legallySensitive ? (
            <span
              style={{
                font: "500 10px var(--font-inter)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--pw-status-due-fg)",
                background: "var(--pw-status-due-bg)",
                padding: "2px 6px",
                borderRadius: 999,
              }}
            >
              Check state law
            </span>
          ) : null}
        </div>
        <div style={{ font: "400 12.5px var(--font-inter)", color: "var(--pw-text-secondary)", marginTop: 2 }}>
          {format(due, "MMM d, yyyy")} · {item.window}
          {item.isPast ? " · likely done" : ""}
        </div>
        <p style={{ margin: "6px 0 0", font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)", lineHeight: 1.5 }}>
          {item.detail}
        </p>
      </div>
    </li>
  );
}
