"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import {
  completeOnboarding,
  getInboxStatus,
  getOnboardingInbox,
} from "@/app/onboarding/actions";
import { buildFirstYearPlan, type PlanSpecies } from "@/lib/clinical/first-year";

import { FirstYearTimeline } from "./first-year-timeline";
import { GhostButton, PrimaryButton, Spinner, StepHeader } from "./ui";

type View = "cards" | "forward" | "plan";

const POLL_MS = 6000;

export function ValueStep({
  pet,
  onBack,
}: {
  pet: { id: string; name: string; species: PlanSpecies; birthDate: string | null };
  onBack: () => void;
}) {
  const [view, setView] = useState<View>("cards");
  const [finishing, startFinish] = useTransition();

  const plan =
    pet.birthDate != null
      ? buildFirstYearPlan({ species: pet.species, birthDate: pet.birthDate })
      : null;
  const planIsFeatured = plan != null && !plan.isMinimal;

  // Terminal exits use a hard navigation, not a soft router.push: this is a
  // one-time transition where a full load guarantees the dashboard sees the
  // freshly-set onboarded cookie and session, with no client router-cache race.
  const finish = useCallback((href: string) => {
    startFinish(async () => {
      await completeOnboarding();
      window.location.assign(href);
    });
  }, []);

  function goUpload() {
    // Mark done before leaving so the user isn't routed back into onboarding.
    finish(`/pets/${pet.id}/upload`);
  }

  if (view === "forward") {
    return (
      <ForwardEmail
        onBack={() => setView("cards")}
        finishTo={finish}
        finishing={finishing}
      />
    );
  }

  if (view === "plan" && plan) {
    return (
      <FirstYearTimeline
        petName={pet.name}
        petId={pet.id}
        species={pet.species}
        birthDate={pet.birthDate!}
        onBack={() => setView("cards")}
        onFinish={() => finish("/")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StepHeader
        eyebrow="You're set up"
        title={`${pet.name} is on Pawdex.`}
        sub="Here's the fastest way to make it useful. Pick one, you can do the rest anytime."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {planIsFeatured ? (
          <ChoiceCard
            icon="calendar"
            featured
            title={`See ${pet.name}'s first-year plan`}
            body="A projected schedule of shots and milestones, with optional reminders."
            onClick={() => setView("plan")}
          />
        ) : null}

        <ChoiceCard
          icon="mail"
          featured={!planIsFeatured}
          title="Forward a vet email"
          body="Send any vet email to your private Pawdex address and we'll read it in seconds."
          onClick={() => setView("forward")}
        />

        <ChoiceCard
          icon="upload"
          title="Snap or upload a document"
          body="Vaccine records, invoices, lab results, a photo works."
          onClick={goUpload}
        />

        {plan && !planIsFeatured ? (
          <ChoiceCard
            icon="calendar"
            title="We're just getting started"
            body={`See ${pet.name}'s typical first-year schedule.`}
            onClick={() => setView("plan")}
          />
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <GhostButton onClick={onBack} icon="arrowLeft" disabled={finishing}>
          Back
        </GhostButton>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <GhostButton onClick={() => finish("/")} disabled={finishing}>
            {finishing ? "One sec…" : "Skip for now"}
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  body,
  onClick,
  featured,
}: {
  icon: string;
  title: string;
  body: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: 16,
        borderRadius: 14,
        border: `1px solid ${featured ? "var(--pw-accent)" : "var(--pw-border)"}`,
        background: featured ? "var(--pw-accent-soft)" : "var(--pw-surface)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: featured ? "var(--pw-accent)" : "var(--pw-surface-2)",
          color: featured ? "var(--pw-accent-fg)" : "var(--pw-text)",
        }}
      >
        <Icon name={icon} size={19} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", font: "600 14.5px var(--font-inter)", color: "var(--pw-text)" }}>
          {title}
        </span>
        <span style={{ display: "block", font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)", marginTop: 2, lineHeight: 1.45 }}>
          {body}
        </span>
      </span>
      <Icon name="chevronRight" size={17} />
    </button>
  );
}

function ForwardEmail({
  onBack,
  finishTo,
  finishing,
}: {
  onBack: () => void;
  finishTo: (href: string) => void;
  finishing: boolean;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [landed, setLanded] = useState<{ documentId: string | null; petId: string | null } | null>(
    null,
  );
  const baselineRef = useRef<number | null>(null);

  // Load the inbox address once.
  useEffect(() => {
    let alive = true;
    getOnboardingInbox().then((r) => {
      if (!alive) return;
      if (r.ok) setAddress(r.address);
      else setLoadError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Poll for a newly-arrived document.
  useEffect(() => {
    if (landed) return;
    let alive = true;
    const tick = async () => {
      const r = await getInboxStatus();
      if (!alive || !r.ok) return;
      if (baselineRef.current == null) {
        baselineRef.current = r.documentsCount;
        return;
      }
      if (r.documentsCount > baselineRef.current) {
        setLanded({ documentId: r.latestDocumentId, petId: r.latestPetId });
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [landed]);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select and copy the address manually.");
    }
  }

  if (landed) {
    const reviewHref =
      landed.documentId && landed.petId
        ? `/pets/${landed.petId}/documents/${landed.documentId}/review`
        : "/documents";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center", alignItems: "center", paddingTop: 12 }}>
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--pw-status-up-bg)",
            color: "var(--pw-status-up-fg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="checkCircle" size={30} />
        </span>
        <StepHeader title="Got it. Reading it now…" sub="Your first document just landed. We're extracting the details. It's usually ready in under a minute." />
        <div style={{ width: "100%" }}>
          <PrimaryButton onClick={() => finishTo(reviewHref)} busy={finishing}>
            Review it
            <Icon name="arrowRight" size={16} />
          </PrimaryButton>
        </div>
        <GhostButton onClick={() => finishTo("/")} disabled={finishing}>
          {finishing ? "One sec…" : "Go to dashboard"}
        </GhostButton>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StepHeader
        eyebrow="Forward a vet email"
        title="Send anything to this address"
        sub="Forward a vaccine certificate, an invoice, or a visit summary. We'll pull out the details automatically."
      />

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
        {loadError ? (
          <div style={{ font: "400 13px var(--font-inter)", color: "var(--pw-status-overdue-fg)" }}>
            {loadError}
          </div>
        ) : !address ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pw-text-muted)", font: "400 13px var(--font-inter)" }}>
            <Spinner light={false} /> Preparing your private address…
          </div>
        ) : (
          <>
            <code
              style={{
                display: "block",
                padding: "12px 13px",
                borderRadius: 10,
                background: "var(--pw-surface-2)",
                border: "1px solid var(--pw-border)",
                font: "500 14px var(--font-jetbrains-mono)",
                color: "var(--pw-text)",
                wordBreak: "break-all",
              }}
            >
              {address}
            </code>
            <PrimaryButton onClick={copy}>
              <Icon name={copied ? "check" : "copy"} size={16} />
              {copied ? "Copied" : "Copy address"}
            </PrimaryButton>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          background: "var(--pw-surface-2)",
          border: "1px dashed var(--pw-border-strong)",
          font: "400 13px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Spinner light={false} />
        Waiting for your first email… you can leave this open or come back later.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <GhostButton onClick={onBack} icon="arrowLeft" disabled={finishing}>
          Back
        </GhostButton>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <GhostButton onClick={() => finishTo("/")} disabled={finishing}>
            {finishing ? "One sec…" : "Skip for now"}
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
