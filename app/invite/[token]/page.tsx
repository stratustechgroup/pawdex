import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { PawdexMark } from "@/components/brand/mark";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashToken } from "@/lib/auth/invitations";

import { AcceptForm } from "./accept-form";

export const metadata = { title: "Join household · Pawdex" };
export const dynamic = "force-dynamic";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolve the invitation server-side without revealing whether it exists
  // until after auth — but we DO want to surface "expired" / "revoked" status
  // up-front so users aren't asked to sign in for a dead link. Use the
  // service client to read past RLS.
  const service = createServiceClient();
  const tokenHash = hashToken(token);
  const { data: invitation } = await service
    .from("household_invitations")
    .select("id, household_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  // Resolve household name (we want to show it on the page).
  let householdName: string | null = null;
  if (invitation) {
    const { data: hh } = await service
      .from("households")
      .select("name")
      .eq("id", invitation.household_id)
      .maybeSingle();
    householdName = hh?.name ?? null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Render different states based on token validity + auth.
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "var(--pw-bg)",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--pw-text)",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <PawdexMark size={24} color="var(--pw-accent)" />
          <span style={{ font: "600 16px var(--font-inter)" }}>Pawdex</span>
        </Link>

        {!invitation ? (
          <StateCard
            kind="error"
            title="Invalid invitation link"
            body="This link doesn't match any active invitation. Ask the person who invited you to send a new one."
          />
        ) : invitation.revoked_at ? (
          <StateCard
            kind="error"
            title="Invitation revoked"
            body="This invitation was revoked by the household owner. Ask them to send a new one if you still need access."
          />
        ) : invitation.accepted_at ? (
          <StateCard
            kind="info"
            title="Already accepted"
            body="This invitation has already been used. Sign in to view the household."
            actions={
              <Link
                href="/login"
                style={btnPrimary}
              >
                Sign in
              </Link>
            }
          />
        ) : new Date(invitation.expires_at).getTime() < Date.now() ? (
          <StateCard
            kind="error"
            title="Invitation expired"
            body={`This link expired on ${format(new Date(invitation.expires_at), "MMM d, yyyy")}. Ask for a fresh one.`}
          />
        ) : !user ? (
          <StateCard
            kind="info"
            title={`You're invited to ${householdName ?? "a household"}`}
            body={`Sign in with your email — we'll bring you straight back to accept.`}
            actions={
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                style={btnPrimary}
              >
                Sign in to accept
              </Link>
            }
            meta={`Invited as ${invitation.role} · expires ${format(new Date(invitation.expires_at), "MMM d, yyyy")}`}
          />
        ) : (
          <AcceptForm
            token={token}
            householdName={householdName ?? "this household"}
            inviteeEmail={invitation.email}
            role={invitation.role}
            currentUserEmail={user.email ?? null}
          />
        )}
      </div>
    </main>
  );
}

function StateCard({
  kind,
  title,
  body,
  actions,
  meta,
}: {
  kind: "error" | "info";
  title: string;
  body: string;
  actions?: React.ReactNode;
  meta?: string;
}) {
  const isError = kind === "error";
  return (
    <div
      className="pw-card"
      style={{
        padding: 28,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: isError
            ? "var(--pw-status-overdue-bg)"
            : "var(--pw-accent-soft)",
          color: isError
            ? "var(--pw-status-overdue-fg)"
            : "var(--pw-accent-fg-on-soft)",
          marginBottom: 14,
        }}
      >
        <Icon name={isError ? "alert" : "mail"} size={20} />
      </div>
      <h1
        className="serif"
        style={{
          margin: "0 0 8px",
          font: "500 22px var(--font-source-serif)",
          color: "var(--pw-text)",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          font: "400 13.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      {meta && (
        <p
          style={{
            margin: "12px 0 0",
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-subtle)",
          }}
        >
          {meta}
        </p>
      )}
      {actions && (
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 38,
  padding: "0 18px",
  borderRadius: 6,
  background: "var(--pw-accent)",
  color: "#fff",
  border: "1px solid var(--pw-accent)",
  font: "500 13px var(--font-inter)",
  textDecoration: "none",
  cursor: "pointer",
};
