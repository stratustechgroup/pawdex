"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";

import { removeHouseholdMember, revokeInvitation } from "./actions";

type Member = {
  user_id: string;
  email: string | null;
  role: "owner" | "member" | "viewer";
  invited_at: string;
  accepted_at: string | null;
  is_self: boolean;
};

type Invitation = {
  id: string;
  email: string;
  role: "owner" | "member" | "viewer";
  expires_at: string;
  created_at: string;
};

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

export function MembersList({
  members,
  invitations,
  canManage,
}: {
  members: Member[];
  invitations: Invitation[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove(userId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this household?`)) return;
    startTransition(async () => {
      const r = await removeHouseholdMember(userId);
      if (r.ok) {
        toast.success("Member removed");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleRevoke(invitationId: string, label: string) {
    if (!window.confirm(`Revoke the invitation to ${label}?`)) return;
    startTransition(async () => {
      const r = await revokeInvitation(invitationId);
      if (r.ok) {
        toast.success("Invitation revoked");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section>
        <h3
          style={{
            margin: "0 0 8px",
            font: "600 12.5px var(--font-inter)",
            color: "var(--pw-text-secondary)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Members ({members.length})
        </h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {members.map((m) => (
            <li
              key={m.user_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: "var(--pw-surface-2)",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "var(--pw-photo-tint-4)",
                  color: "#FAF9F6",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "600 12px var(--font-inter)",
                  flexShrink: 0,
                }}
              >
                {(m.email ?? "?").charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "500 13px var(--font-inter)",
                    color: "var(--pw-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.email ?? "Unknown email"}
                  {m.is_self && (
                    <span style={{ color: "var(--pw-text-muted)", fontWeight: 400 }}>
                      {" "}
                      · you
                    </span>
                  )}
                </div>
                <div
                  style={{
                    font: "400 11.5px var(--font-inter)",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  {ROLE_LABEL[m.role]} · joined{" "}
                  {format(
                    new Date(m.accepted_at ?? m.invited_at),
                    "MMM d, yyyy",
                  )}
                </div>
              </div>
              {canManage && !m.is_self && m.role !== "owner" && (
                <button
                  type="button"
                  onClick={() =>
                    handleRemove(m.user_id, m.email ?? "this member")
                  }
                  disabled={isPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    height: 28,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: "1px solid var(--pw-border-strong)",
                    background: "transparent",
                    color: "var(--pw-text-secondary)",
                    font: "500 11.5px var(--font-inter)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="x" size={11} />
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section>
          <h3
            style={{
              margin: "0 0 8px",
              font: "600 12.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Pending invitations ({invitations.length})
          </h3>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {invitations.map((inv) => (
              <li
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--pw-pending-bg)",
                  color: "var(--pw-pending-fg)",
                  borderRadius: 8,
                }}
              >
                <Icon name="mail" size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "500 13px var(--font-inter)",
                      color: "var(--pw-pending-fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inv.email}
                  </div>
                  <div
                    style={{
                      font: "400 11.5px var(--font-inter)",
                      opacity: 0.8,
                    }}
                  >
                    {ROLE_LABEL[inv.role]} · expires{" "}
                    {format(new Date(inv.expires_at), "MMM d, yyyy")}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id, inv.email)}
                    disabled={isPending}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--pw-pending-border)",
                      background: "transparent",
                      color: "var(--pw-pending-fg)",
                      font: "500 11.5px var(--font-inter)",
                      cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
