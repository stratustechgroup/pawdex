import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import {
  AUTHORIZATION_TYPES,
  listAuthorizationsForHousehold,
} from "@/lib/auth/authorizations";
import {
  getOrCreateInboundAddress,
  inboxAddressFor,
} from "@/lib/db/inbound-addresses";
import {
  getReminderPreferences,
  LEAD_DAY_PRESETS,
  presetFromDays,
} from "@/lib/db/reminder-preferences";

import { InboundAddressCard } from "./inbound-address";
import { RemindersForm } from "./reminders-form";

export const metadata = { title: "Settings — Pawdex" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const [prefs, authorizations, inboundAddress] = await Promise.all([
    getReminderPreferences(session.householdId),
    listAuthorizationsForHousehold(session.householdId),
    getOrCreateInboundAddress(session.householdId),
  ]);
  const grantedCount = authorizations.filter((a) => a.effective !== null).length;
  const totalTypes = AUTHORIZATION_TYPES.length;
  const inboxEmail = inboxAddressFor(inboundAddress.slug);
  const recordsAuthGranted =
    authorizations.find((a) => a.descriptor.type === "records_request_to_vets")
      ?.effective !== undefined &&
    authorizations.find((a) => a.descriptor.type === "records_request_to_vets")
      ?.effective !== null;

  const initial = {
    email_enabled: prefs?.email_enabled ?? true,
    email_address: prefs?.email_address ?? "",
    preset: presetFromDays(prefs?.vaccine_lead_days ?? [...LEAD_DAY_PRESETS.standard.days]),
    customDays: prefs?.vaccine_lead_days ?? [...LEAD_DAY_PRESETS.standard.days],
    timezone: prefs?.timezone ?? "America/New_York",
    auto_request_records: prefs?.auto_request_records ?? false,
    auto_request_lead_days: prefs?.auto_request_lead_days ?? 1,
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
          Settings
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Account and reminder preferences.
        </p>
      </header>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead title="Account" sub="Your profile and household." />
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            rowGap: 10,
            columnGap: 24,
            font: "400 13px var(--font-inter)",
          }}
        >
          <Term>Email</Term>
          <Detail>{session.email}</Detail>
          <Term>Household</Term>
          <Detail>{session.householdName}</Detail>
          <Term>Role</Term>
          <Detail style={{ textTransform: "capitalize" }}>{session.role}</Detail>
        </dl>
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead
          title="Reminders"
          sub="When and how Pawdex pings you about vaccines, refills, and visits."
        />
        <RemindersForm
          initial={initial}
          defaultEmail={session.email ?? ""}
          authorizationGranted={recordsAuthGranted}
        />
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead
          title="Forward documents by email"
          sub="Forward any vet email to your household's address. Attachments land in your document queue automatically."
        />
        <div
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <InboundAddressCard address={inboxEmail} />
          <p
            style={{
              margin: 0,
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Forwarded PDFs and images go through the same AI extraction pipeline
            as direct uploads. You&apos;ll review each before it&apos;s saved to
            a pet&apos;s record.
          </p>
        </div>
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead
          title="Authorizations"
          sub="Outbound actions Pawdex takes on your behalf."
          right={
            <Link
              href="/settings/authorizations"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 30,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "500 12px var(--font-inter)",
                textDecoration: "none",
              }}
            >
              Manage
              <Icon name="chevronRight" size={12} />
            </Link>
          }
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 14,
            background:
              grantedCount > 0 ? "var(--pw-accent-soft)" : "var(--pw-info-bg)",
            color:
              grantedCount > 0
                ? "var(--pw-accent-fg-on-soft)"
                : "var(--pw-info-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
          }}
        >
          <Icon name="shieldCheck" size={14} />
          {grantedCount === 0
            ? `Pawdex never sends email on your behalf without explicit consent. Grant any of ${totalTypes} authorizations to unlock automated records requests, distribution, and insurer clarifications.`
            : `${grantedCount} of ${totalTypes} authorizations granted. Each is recorded with timestamp, IP, and the exact wording you agreed to.`}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <SettingsLink
          href="/settings/household"
          icon="user"
          title="Household"
          body="Invite members, manage roles, revoke access."
        />
        <SettingsLink
          href="/settings/activity"
          icon="activity"
          title="Activity log"
          body="Every meaningful change in your household, with timestamps."
        />
      </section>
    </div>
  );
}

function SettingsLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="pw-card"
      style={{
        padding: 16,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--pw-accent-soft)",
          color: "var(--pw-accent-fg-on-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            marginTop: 3,
          }}
        >
          {body}
        </div>
      </div>
      <Icon
        name="chevronRight"
        size={14}
        style={{ color: "var(--pw-text-subtle)" }}
      />
    </Link>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <dt
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        paddingTop: 2,
      }}
    >
      {children}
    </dt>
  );
}

function Detail({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <dd style={{ margin: 0, color: "var(--pw-text)", ...style }}>{children}</dd>
  );
}
