import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { switchHousehold } from "@/lib/auth/switch-household";
import {
  listHouseholdMembers,
  listPendingInvitations,
} from "@/lib/db/household-members";

import { DeleteHouseholdDialog } from "@/components/deletion/delete-household-dialog";
import { RecentlyDeleted } from "@/components/deletion/recently-deleted";
import { listDeletedPets } from "@/lib/deletion/recently-deleted";

import { HouseholdTypeControl } from "./household-type-control";
import { InviteForm } from "./invite-form";
import { MembersList } from "./members-list";
import { NewHouseholdForm } from "./new-household-form";

export const metadata = { title: "Household · Pawdex" };
export const dynamic = "force-dynamic";

export default async function HouseholdSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireSession();
  const kindParam = (await searchParams).kind;
  const defaultKind = kindParam === "breeder" ? "breeder" : "personal";
  const [members, invitations, deletedPets] = await Promise.all([
    listHouseholdMembers(session.householdId, session.userId),
    listPendingInvitations(session.householdId),
    listDeletedPets(session.householdId),
  ]);
  const isOwner = session.role === "owner";
  const ROLE_LABEL: Record<typeof session.role, string> = {
    owner: "Owner",
    member: "Member",
    viewer: "Viewer",
  };

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
            title="Household type"
            sub="Personal households track your own pets. Breeder households add litters, placement, and transfer tools."
          />
          <HouseholdTypeControl kind={session.householdKind} />
        </section>
      )}

      {session.households.length > 1 && (
        <section className="pw-card" style={{ padding: 20 }}>
          <SectionHead
            title="Your households"
            sub="You belong to more than one household. The active one is shown throughout Pawdex; switch to manage a different one."
          />
          <ul
            style={{
              listStyle: "none",
              margin: "16px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {session.households.map((h) => (
              <li
                key={h.householdId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--pw-border)",
                  background: h.isActive
                    ? "var(--pw-surface-2)"
                    : "var(--pw-surface)",
                }}
              >
                <Icon
                  name={h.kind === "breeder" ? "paw" : "home"}
                  size={16}
                  style={{ color: "var(--pw-text-muted)", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        font: "500 14px var(--font-inter)",
                        color: "var(--pw-text)",
                      }}
                    >
                      {h.name}
                    </span>
                    {h.kind === "breeder" && (
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "var(--pw-accent-soft)",
                          color: "var(--pw-accent-fg-on-soft)",
                          font: "600 9.5px var(--font-inter)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Breeder
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      font: "400 12px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {ROLE_LABEL[h.role]}
                  </span>
                </div>
                {h.isActive ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "var(--pw-accent-soft)",
                      color: "var(--pw-accent-fg-on-soft)",
                      font: "500 11px var(--font-inter)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    <Icon name="check" size={12} />
                    Active
                  </span>
                ) : (
                  <form action={switchHousehold.bind(null, h.householdId)}>
                    <button
                      type="submit"
                      style={{
                        height: 32,
                        padding: "0 14px",
                        borderRadius: 6,
                        border: "1px solid var(--pw-border-strong)",
                        background: "var(--pw-surface)",
                        color: "var(--pw-text)",
                        font: "500 12.5px var(--font-inter)",
                        cursor: "pointer",
                      }}
                    >
                      Switch
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="new-household" className="pw-card" style={{ padding: 20, scrollMarginTop: 80 }}>
        <SectionHead
          title="New household"
          sub="Run a separate space with its own pets, records, and reminders. You become its owner and can switch to it from the household menu any time. Pick Breeder to keep a breeding operation apart from your personal pets."
        />
        <NewHouseholdForm defaultKind={defaultKind} />
      </section>

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

      <RecentlyDeleted pets={deletedPets} />

      {isOwner && (
        <section
          className="pw-card"
          style={{ padding: 20, borderColor: "var(--pw-danger-border, var(--pw-border))" }}
        >
          <SectionHead
            title="Delete this household"
            sub="Removes every pet, document, and record here. Reversible for 30 days, then permanently purged. Export anything you want to keep first."
          />
          <div style={{ marginTop: 12 }}>
            <DeleteHouseholdDialog householdName={session.householdName} />
          </div>
        </section>
      )}
    </div>
  );
}
