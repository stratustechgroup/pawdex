import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SignOutButton } from "@/app/(app)/sign-out-button";
import { RecentlyDeleted } from "@/components/deletion/recently-deleted";
import { listDeletedHouseholdsOwnedBy } from "@/lib/deletion/recently-deleted";

import { RestoreAccountPanel } from "./restore-panel";

export const metadata = { title: "Account scheduled for deletion · Pawdex" };
export const dynamic = "force-dynamic";

/**
 * Grace-period screen. requireSession redirects here whenever the user has a
 * pending account deletion, freezing the app until they either wait out the
 * window or restore. It deliberately does NOT call requireSession itself (that
 * would loop) and uses its own auth read.
 */
export default async function AccountDeletionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: row } = await service
    .from("account_deletions")
    .select("purge_after, status, sole_owned_households")
    .eq("user_id", user.id)
    .maybeSingle();

  // No pending ACCOUNT deletion. The user may still be here because they
  // soft-deleted their only household directly (requireSession routes such a
  // stranded user here so they can restore instead of being dropped into
  // onboarding + a fresh household). Offer that restore; only if there is truly
  // nothing left to restore do we send them back to the app.
  if (!row || row.status !== "pending") {
    const deletedHouseholds = await listDeletedHouseholdsOwnedBy(user.id);
    if (deletedHouseholds.length === 0) redirect("/");
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "72px 24px 56px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
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
            Your household was deleted
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              font: "400 14px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.6,
            }}
          >
            It is hidden but recoverable until its retention window ends. Restore
            it to get back in, or sign out.
          </p>
        </header>
        <RecentlyDeleted households={deletedHouseholds} />
        <div>
          <SignOutButton />
        </div>
      </div>
    );
  }

  const purgeDate = new Date(row.purge_after).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const households =
    (row.sole_owned_households as unknown as Array<{ id: string; name: string }>) ?? [];

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "72px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
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
          Your account is scheduled for deletion
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            font: "400 14px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.6,
          }}
        >
          Everything will be permanently deleted on <strong>{purgeDate}</strong>.
          Until then, your data is hidden but recoverable. You can restore your
          account and pick up right where you left off.
        </p>
      </header>

      {households.length > 0 && (
        <section className="pw-card" style={{ padding: 20 }}>
          <p
            style={{
              margin: "0 0 8px",
              font: "600 12px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            Households that will be deleted
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {households.map((h) => (
              <li key={h.id}>{h.name}</li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <RestoreAccountPanel />
        <SignOutButton />
      </div>
    </div>
  );
}
