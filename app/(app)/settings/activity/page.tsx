import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AuditAction } from "@/lib/supabase/types";

export const metadata = { title: "Activity — Pawdex" };
export const dynamic = "force-dynamic";

type LogRow = {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  diff: unknown;
  created_at: string;
};

const ACTION_VERB: Record<AuditAction, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  archive: "archived",
  commit_extraction: "committed extraction for",
  discard_extraction: "discarded extraction for",
  invite_member: "invited",
  revoke_member: "revoked",
  accept_invitation: "accepted invitation to",
  login: "logged into",
  preferences_change: "changed preferences for",
};

const ENTITY_LABEL: Record<string, string> = {
  pet: "pet",
  vaccination: "vaccination",
  medication: "medication",
  medical_event: "medical event",
  weight_log: "weight entry",
  vet_clinic: "vet clinic",
  document: "document",
  document_extraction: "extraction",
  household: "household",
  household_member: "member",
  household_invitation: "invitation",
  reminder_preferences: "reminder preferences",
};

export default async function ActivityPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, diff, created_at")
    .eq("household_id", session.householdId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as LogRow[];

  // Resolve actor labels via service client — display name when set, else email.
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const emailById = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const service = createServiceClient();
    const [{ data: users }, { data: profiles }] = await Promise.all([
      service.auth.admin.listUsers({ perPage: 1000 }),
      service.from("profiles").select("id, display_name").in("id", actorIds),
    ]);
    const nameById = new Map<string, string | null>();
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name ?? null);
    for (const u of users?.users ?? []) {
      if (actorIds.includes(u.id)) {
        emailById.set(u.id, nameById.get(u.id) || u.email || null);
      }
    }
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Link href="/settings" style={{ color: "inherit", textDecoration: "none" }}>
          Settings
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>Activity</span>
      </div>

      <SectionHead
        title="Activity log"
        sub={
          rows.length === 0
            ? "Every meaningful change in your household will appear here."
            : `Last ${rows.length} actions across this household.`
        }
      />

      {rows.length === 0 ? (
        <div
          className="pw-card"
          style={{
            padding: 40,
            textAlign: "center",
            borderStyle: "dashed",
            background: "transparent",
            font: "400 13px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          No activity recorded yet. Adding a pet, committing an extraction,
          inviting a member, or changing reminder preferences all show up here.
        </div>
      ) : (
        <ul
          className="pw-card"
          style={{
            listStyle: "none",
            margin: 0,
            padding: "4px 0",
          }}
        >
          {rows.map((r, i) => {
            const actor = r.actor_id ? emailById.get(r.actor_id) ?? null : null;
            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--pw-surface-2)",
                    color: "var(--pw-text-secondary)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={iconForAction(r.action)} size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "400 13px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{actor ?? "Pawdex"}</span>{" "}
                    {ACTION_VERB[r.action] ?? r.action}{" "}
                    <span style={{ color: "var(--pw-text-secondary)" }}>
                      {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                    </span>
                  </div>
                  {r.entity_id && (
                    <div
                      className="mono"
                      style={{
                        font: "400 11px var(--font-jetbrains)",
                        color: "var(--pw-text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {r.entity_id}
                    </div>
                  )}
                </div>
                <span
                  className="tnum"
                  style={{
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {format(new Date(r.created_at), "MMM d 'at' h:mm a")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function iconForAction(action: AuditAction): string {
  switch (action) {
    case "create":
      return "plus";
    case "update":
      return "edit";
    case "delete":
      return "x";
    case "archive":
      return "inbox";
    case "commit_extraction":
      return "checkCircle";
    case "discard_extraction":
      return "x";
    case "invite_member":
    case "accept_invitation":
      return "mail";
    case "revoke_member":
      return "x";
    case "preferences_change":
      return "edit";
    case "login":
      return "user";
    default:
      return "activity";
  }
}
