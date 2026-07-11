import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

import { AskForm } from "./ask-form";

export const metadata = { title: "Ask · Pawdex" };
export const dynamic = "force-dynamic";

export default async function AskPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { count: chunkCount } = await supabase
    .from("extraction_chunks")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", session.householdId);

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <SectionHead
        title="Ask"
        sub={
          (chunkCount ?? 0) === 0
            ? "Once you commit a document, its contents become searchable here. Until then, this page is quiet."
            : `Cite-grounded answers across your committed records. ${chunkCount} snippets indexed.`
        }
      />

      {(chunkCount ?? 0) === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon name="sparkles" size={24} style={{ color: "var(--pw-text-subtle)" }} />
          <div>
            <div style={{ font: "500 14px var(--font-inter)", color: "var(--pw-text)" }}>
              No records indexed yet
            </div>
            <div style={{ marginTop: 6 }}>
              Upload + commit a document, and Pawdex will index it for cited Q&amp;A.
            </div>
          </div>
        </div>
      ) : (
        <AskForm />
      )}

      <ExampleQuestions />
    </div>
  );
}

function ExampleQuestions() {
  const examples = [
    "When is the rabies vaccine due?",
    "What was the last creatinine reading?",
    "Has any pet had an adverse reaction to a vaccine?",
    "What medications are currently active?",
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        background: "var(--pw-surface-muted)",
        borderRadius: 8,
        border: "1px solid var(--pw-border)",
      }}
    >
      <div
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Try asking
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {examples.map((e) => (
          <li
            key={e}
            style={{
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            &ldquo;{e}&rdquo;
          </li>
        ))}
      </ul>
    </div>
  );
}
