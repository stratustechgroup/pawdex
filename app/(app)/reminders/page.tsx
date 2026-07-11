import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

import { RunCronButton } from "./run-cron-button";

export const metadata = { title: "Reminders · Pawdex" };
export const dynamic = "force-dynamic";

type ReminderRow = {
  id: string;
  pet_id: string | null;
  entity_id: string;
  due_on: string;
  lead_days: number;
  scheduled_for: string;
  sent_at: string | null;
  status: "scheduled" | "sent" | "failed" | "skipped";
  resend_message_id: string | null;
  error_message: string | null;
};

export default async function RemindersPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: rems } = await supabase
    .from("reminders")
    .select(
      "id, pet_id, entity_id, due_on, lead_days, scheduled_for, sent_at, status, resend_message_id, error_message",
    )
    .eq("household_id", session.householdId)
    .order("scheduled_for", { ascending: false })
    .limit(200);

  const rows = (rems ?? []) as ReminderRow[];

  // Resolve pet names + vaccine types in one fetch each.
  const petIds = [...new Set(rows.map((r) => r.pet_id).filter((x): x is string => !!x))];
  const vacIds = [...new Set(rows.map((r) => r.entity_id))];

  const [petsRes, vacRes] = await Promise.all([
    petIds.length > 0
      ? supabase.from("pets").select("id, name").in("id", petIds)
      : Promise.resolve({ data: [] }),
    vacIds.length > 0
      ? supabase
          .from("vaccinations")
          .select("id, vaccine_type")
          .in("id", vacIds)
      : Promise.resolve({ data: [] }),
  ]);

  const petName = new Map<string, string>();
  for (const p of (petsRes.data ?? []) as Array<{ id: string; name: string }>) {
    petName.set(p.id, p.name);
  }
  const vacType = new Map<string, string>();
  for (const v of (vacRes.data ?? []) as Array<{ id: string; vaccine_type: string }>) {
    vacType.set(v.id, v.vaccine_type);
  }

  const upcoming = rows.filter((r) => r.status === "scheduled");
  const sent = rows.filter((r) => r.status === "sent");
  const failed = rows.filter((r) => r.status === "failed");

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <SectionHead
          title="Reminders"
          sub={
            rows.length === 0
              ? "Once you've logged a vaccine with an expiry date, scheduled reminders will land here."
              : `${upcoming.length} scheduled · ${sent.length} sent · ${failed.length} failed (last 200)`
          }
        />
        <RunCronButton />
      </div>

      <Group
        title="Scheduled"
        empty="Nothing scheduled. The daily cron computes reminders as vaccines approach expiry."
        rows={upcoming}
        petName={petName}
        vacType={vacType}
        variant="scheduled"
      />

      {sent.length > 0 && (
        <Group
          title="Sent"
          empty=""
          rows={sent.slice(0, 20)}
          petName={petName}
          vacType={vacType}
          variant="sent"
        />
      )}

      {failed.length > 0 && (
        <Group
          title="Failed"
          empty=""
          rows={failed.slice(0, 20)}
          petName={petName}
          vacType={vacType}
          variant="failed"
        />
      )}
    </div>
  );
}

function Group({
  title,
  empty,
  rows,
  petName,
  vacType,
  variant,
}: {
  title: string;
  empty: string;
  rows: ReminderRow[];
  petName: Map<string, string>;
  vacType: Map<string, string>;
  variant: "scheduled" | "sent" | "failed";
}) {
  return (
    <section>
      <h2
        style={{
          margin: "0 0 10px",
          font: "600 14px var(--font-inter)",
          color: "var(--pw-text)",
        }}
      >
        {title}{" "}
        <span style={{ color: "var(--pw-text-muted)", fontWeight: 400 }}>
          · {rows.length}
        </span>
      </h2>

      {rows.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 20,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {empty}
        </div>
      ) : (
        <div className="pw-card" style={{ padding: "4px 0" }}>
          {rows.map((r, i) => (
            <ReminderRowItem
              key={r.id}
              row={r}
              isFirst={i === 0}
              petName={petName}
              vacType={vacType}
              variant={variant}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReminderRowItem({
  row,
  isFirst,
  petName,
  vacType,
  variant,
}: {
  row: ReminderRow;
  isFirst: boolean;
  petName: Map<string, string>;
  vacType: Map<string, string>;
  variant: "scheduled" | "sent" | "failed";
}) {
  const pet = row.pet_id ? petName.get(row.pet_id) : null;
  const vac = vacType.get(row.entity_id);
  const dueDate = new Date(row.due_on);
  const scheduledFor = new Date(row.scheduled_for);
  const sentAt = row.sent_at ? new Date(row.sent_at) : null;

  return (
    <div
      style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: isFirst ? "none" : "1px solid var(--pw-border)",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background:
            variant === "sent"
              ? "var(--pw-status-up-bg)"
              : variant === "failed"
                ? "var(--pw-status-overdue-bg)"
                : "var(--pw-accent-soft)",
          color:
            variant === "sent"
              ? "var(--pw-status-up-fg)"
              : variant === "failed"
                ? "var(--pw-status-overdue-fg)"
                : "var(--pw-accent-fg-on-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          name={
            variant === "sent" ? "mail" : variant === "failed" ? "alert" : "clock"
          }
          size={14}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "500 13px var(--font-inter)", color: "var(--pw-text)" }}>
          {pet ? (
            <Link
              href={`/pets/${row.pet_id}/vaccines`}
              style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dotted var(--pw-border-strong)" }}
            >
              {pet}
            </Link>
          ) : (
            "Pet removed"
          )}
          {" · "}
          {vac ?? "Vaccine"}
        </div>
        <div
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            marginTop: 2,
          }}
        >
          Due {format(dueDate, "MMM d, yyyy")} · {row.lead_days}d lead
          {variant === "scheduled" && (
            <> · scheduled for {format(scheduledFor, "MMM d")}</>
          )}
          {variant === "sent" && sentAt && (
            <> · sent {format(sentAt, "MMM d, yyyy 'at' h:mm a")}</>
          )}
          {variant === "failed" && row.error_message && (
            <>
              {" "}· <span className="mono">{row.error_message}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
