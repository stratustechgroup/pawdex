import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import {
  listHouseholdMembers,
  listPendingInvitations,
} from "@/lib/db/household-members";

import { InviteForm } from "./invite-form";
import { MembersList } from "./members-list";

export const metadata = { title: "Household — Pawdex" };
export const dynamic = "force-dynamic";

export default async function HouseholdSettingsPage() {
  const session = await requireSession();
  const [members, invitations] = await Promise.all([
    listHouseholdMembers(session.householdId, session.userId),
    listPendingInvitations(session.householdId),
  ]);
  const isOwner = session.role === "owner";

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
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
        <span style={{ color: "var(--pw-text)" }}>Household</span>
      </div>

      <header>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 28px var(--font-source-serif)",
            letterSpacing: "-0.02em",
            color: "var(--pw-text)",
          }}
        >
          {session.householdName}
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          People with access to this household&apos;s pets, records, and reminders.
        </p>
      </header>

      {isOwner && (
        <section className="pw-card" style={{ padding: 20 }}>
          <SectionHead
            title="Invite a member"
            sub="They'll get a link by email; clicking it joins them to this household."
          />
          <InviteForm />
        </section>
      )}

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead title="People" />
        <MembersList
          members={members}
          invitations={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expires_at: i.expires_at,
            created_at: i.created_at,
          }))}
          canManage={isOwner}
        />
      </section>

      {!isOwner && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
          }}
        >
          Only the household owner can invite or remove members.
        </div>
      )}
    </div>
  );
}
