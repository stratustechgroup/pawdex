import { format } from "date-fns";
import { notFound } from "next/navigation";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { listQolEntriesForPet, QOL_DIMENSIONS, QOL_MAX, totalScore } from "@/lib/db/qol";
import { createClient } from "@/lib/supabase/server";

import { deleteQolEntry, saveQolEntry } from "./actions";
import { DimensionSlider } from "./dimension-slider";
import { QolTrendChart } from "./qol-trend-chart";

export const metadata = { title: "Quality of life · Pawdex" };
export const dynamic = "force-dynamic";

export default async function QolPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name")
    .eq("household_id", session.householdId)
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();

  const entries = await listQolEntriesForPet(session.householdId, petId);
  const today = new Date().toISOString().slice(0, 10);
  const todays = entries.find((e) => e.recorded_on === today) ?? null;

  // Last 30 days for the chart, oldest first.
  const chartData = entries
    .slice()
    .reverse()
    .map((e) => ({
      date: e.recorded_on,
      total: totalScore(e),
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead
        title="Quality of life"
        sub="HHHHHMM journal — Hurt, Hunger, Hydration, Hygiene, Happiness, Mobility, More good days. Daily scores 0-10 per dimension. This is a data tool for you and your vet · Pawdex never recommends end-of-life decisions."
      />

      <section
        className="pw-card"
        style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                font: "600 15px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Log today&apos;s scores
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                font: "400 12.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {todays
                ? `You logged ${pet.name}'s scores for today (${format(new Date(today), "MMM d")}). Re-submitting overwrites them.`
                : `${format(new Date(today), "MMM d, yyyy")} — drag each slider to reflect how ${pet.name} has been today.`}
            </p>
          </div>
        </header>

        <form
          action={saveQolEntry}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <input type="hidden" name="pet_id" value={pet.id} />
          <input type="hidden" name="recorded_on" value={today} />

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {QOL_DIMENSIONS.map((dim) => {
              const initial =
                todays?.[dim.key as keyof typeof todays] ?? 7;
              return (
                <DimensionSlider
                  key={dim.key}
                  name={dim.key}
                  label={dim.label}
                  helper={dim.helper}
                  initial={Number(initial)}
                />
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                font: "500 11px var(--font-inter)",
                color: "var(--pw-text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Notes (optional)
            </span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={todays?.notes ?? ""}
              placeholder="What stood out today?"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "400 13px var(--font-inter)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid var(--pw-accent)",
                background: "var(--pw-accent)",
                color: "var(--pw-accent-fg)",
                font: "500 12.5px var(--font-inter)",
                cursor: "pointer",
              }}
            >
              <Icon name="check" size={12} />
              {todays ? "Update today's entry" : "Save today's entry"}
            </button>
          </div>
        </form>
      </section>

      {entries.length > 0 ? (
        <>
          <section className="pw-card" style={{ padding: 20 }}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
                gap: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  font: "600 15px var(--font-inter)",
                  color: "var(--pw-text)",
                }}
              >
                Trend
              </h2>
              <span
                style={{
                  font: "400 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                }}
              >
                Each dot = total score for that day (max {QOL_MAX}).
              </span>
            </header>
            <QolTrendChart data={chartData} max={QOL_MAX} />
          </section>

          <section className="pw-card" style={{ padding: 20 }}>
            <h2
              style={{
                margin: "0 0 12px",
                font: "600 15px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Recent entries
            </h2>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {entries.map((e) => {
                const total = totalScore(e);
                return (
                  <li
                    key={e.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 8,
                      background: "var(--pw-surface-muted)",
                    }}
                  >
                    <div
                      style={{
                        font: "500 12.5px var(--font-inter)",
                        color: "var(--pw-text-secondary)",
                        minWidth: 96,
                      }}
                    >
                      {format(new Date(e.recorded_on), "EEE, MMM d")}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        gap: 4,
                        flexWrap: "wrap",
                        font: "400 11px var(--font-jetbrains-mono)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      {QOL_DIMENSIONS.map((dim) => (
                        <span key={dim.key} title={dim.label}>
                          {dim.label[0].toUpperCase()}
                          {Number(e[dim.key as keyof typeof e])}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        font: "600 14px var(--font-inter)",
                        color: scoreColor(total),
                        minWidth: 56,
                        textAlign: "right",
                      }}
                      className="tnum"
                    >
                      {total} / {QOL_MAX}
                    </div>
                    <form action={deleteQolEntry}>
                      <input type="hidden" name="entry_id" value={e.id} />
                      <input type="hidden" name="pet_id" value={pet.id} />
                      <button
                        type="submit"
                        title="Delete"
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          color: "var(--pw-text-muted)",
                        }}
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <div
          className="pw-card"
          style={{
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          No entries yet. Log today&apos;s scores above and Pawdex will start
          plotting the trend.
        </div>
      )}

      <div
        style={{
          padding: 12,
          background: "var(--pw-info-bg)",
          color: "var(--pw-info-fg)",
          borderRadius: 8,
          font: "400 11.5px var(--font-inter)",
          lineHeight: 1.5,
        }}
      >
        Pawdex never makes end-of-life decisions or recommendations from this
        data. Share the trend with your veterinarian — they&apos;re the right
        partner for those conversations.
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 50) return "var(--pw-accent)";
  if (score >= 35) return "#c9a227";
  return "#b54a4a";
}
