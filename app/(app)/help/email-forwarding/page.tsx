import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import {
  getOrCreateInboundAddress,
  inboxAddressFor,
} from "@/lib/db/inbound-addresses";

import { InboundAddressCard } from "@/app/(app)/settings/inbound-address";

export const metadata = { title: "Auto-import vet emails · Pawdex" };
export const dynamic = "force-dynamic";

export default async function EmailForwardingHelpPage() {
  const session = await requireSession();
  const inboundAddress = await getOrCreateInboundAddress(session.householdId);
  const inboxEmail = inboxAddressFor(inboundAddress.slug);

  return (
    <div
      style={{
        maxWidth: 820,
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
        <span style={{ color: "var(--pw-text)" }}>Auto-import vet emails</span>
      </div>

      <SectionHead
        title="Auto-import vet emails"
        sub="Forward records from any vet, lab, or pharmacy directly to your household's inbox slug — attachments get extracted and queued for review automatically."
      />

      <section
        className="pw-card"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Your household inbox
        </h2>
        <InboundAddressCard address={inboxEmail} />
        <div
          style={{
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Any email forwarded to this address — with PDF, JPG, PNG, HEIC, or
          WebP attachments — turns into documents in your{" "}
          <Link
            href="/inbox"
            style={{ color: "var(--pw-accent)", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            /inbox
          </Link>{" "}
          ready for AI extraction. The original sender doesn&apos;t see your
          inbox slug — only the forwarding chain in their email client.
        </div>
      </section>

      <div style={{ display: "grid", gap: 16 }}>
        <ForwardingGuide
          provider="Gmail"
          icon="mail"
          steps={[
            <>Settings → <strong>See all settings</strong> → <strong>Forwarding and POP/IMAP</strong>.</>,
            <>Click <strong>Add a forwarding address</strong>, paste the inbox address above, confirm via the test email Gmail sends to it.</>,
            <>Once confirmed, head to <strong>Filters and Blocked Addresses</strong> → <strong>Create a new filter</strong>.</>,
            <>Set <code className="mono">From</code> to your vet&apos;s domain (e.g. <code className="mono">@yourvet.com</code>) or <code className="mono">Has the words: vaccination OR vet OR clinic OR lab</code>.</>,
            <>Check <strong>Forward it to:</strong> and pick your Pawdex inbox.</>,
            <>Optional: also check <strong>Skip the Inbox</strong> to keep your personal inbox clean while still archiving the original.</>,
          ]}
        />

        <ForwardingGuide
          provider="Outlook / Microsoft 365"
          icon="mail"
          steps={[
            <>Settings (gear icon) → <strong>View all Outlook settings</strong> → <strong>Mail</strong> → <strong>Rules</strong>.</>,
            <>Click <strong>Add new rule</strong>.</>,
            <>Condition: <strong>From</strong> contains your vet&apos;s domain, or <strong>Subject or body contains</strong> any of: <code className="mono">vaccination</code>, <code className="mono">prescription</code>, <code className="mono">lab results</code>.</>,
            <>Action: <strong>Forward to</strong> the Pawdex inbox address.</>,
            <>Optional: add a second action <strong>Move to folder</strong> → an &ldquo;Auto-forwarded&rdquo; folder so your primary inbox stays uncluttered.</>,
            <>Save.</>,
          ]}
        />

        <ForwardingGuide
          provider="iCloud Mail"
          icon="mail"
          steps={[
            <>Sign in at iCloud.com → Mail → click the <strong>gear icon</strong> at the bottom of the sidebar → <strong>Rules</strong>.</>,
            <>Click <strong>Add a Rule</strong>.</>,
            <>Condition: <strong>From</strong> contains your vet&apos;s email or domain.</>,
            <>Action: <strong>Forward to</strong> the Pawdex inbox.</>,
            <>Save. iCloud doesn&apos;t require the forwarded address to be verified.</>,
          ]}
        />

        <ForwardingGuide
          provider="Vet patient portals (no-reply senders)"
          icon="info"
          steps={[
            <>Many clinics email records from a no-reply address that you can&apos;t easily filter on.</>,
            <>Use the broader filter approach instead: set up a rule on <strong>Has the words</strong> matching your pet&apos;s name, your clinic&apos;s name, or common phrases like <code className="mono">vaccination certificate</code>.</>,
            <>If a portal lets you set the recipient address for emailed records, paste the Pawdex inbox directly there — no forwarding rule needed.</>,
            <>For clinics that only support physical mail or in-person handoff, upload the PDF or photo from /pets/[id]/upload as usual.</>,
          ]}
        />
      </div>

      <div
        style={{
          padding: 14,
          background: "var(--pw-info-bg)",
          color: "var(--pw-info-fg)",
          borderRadius: 8,
          font: "400 12.5px var(--font-inter)",
          lineHeight: 1.55,
        }}
      >
        <strong>Privacy note.</strong> Email forwarding traverses your provider
        (Gmail / Outlook / iCloud) before reaching Pawdex. The attachment lands
        in your Supabase Storage; the surrounding email body is parsed for
        sender + subject only and discarded. We never index or train on
        forwarded email content.
      </div>
    </div>
  );
}

function ForwardingGuide({
  provider,
  icon,
  steps,
}: {
  provider: string;
  icon: string;
  steps: React.ReactNode[];
}) {
  return (
    <section
      className="pw-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 10,
          borderBottom: "1px solid var(--pw-border)",
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
          }}
        >
          <Icon name={icon} size={14} />
        </span>
        <h2
          style={{
            margin: 0,
            font: "600 14px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          {provider}
        </h2>
      </header>
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text)",
          lineHeight: 1.55,
        }}
      >
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
