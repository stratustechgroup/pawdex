import type { Metadata } from "next";

import { DataDomains } from "@/components/architecture/data-domains";
import { ExtractionLadder } from "@/components/architecture/extraction-ladder";
import { IdentityDiagram } from "@/components/architecture/identity-diagram";
import { IngestSequence } from "@/components/architecture/ingest-sequence";
import {
  Claim,
  Detail,
  DiagramFrame,
  Legend,
  LegendItem,
  Section,
  Stat,
  StatRow,
  Sub,
} from "@/components/architecture/primitives";
import { SpineDiagram } from "@/components/architecture/spine-diagram";
import { TopologyDiagram } from "@/components/architecture/topology-diagram";
import { TransferLedger } from "@/components/architecture/transfer-ledger";

import "./architecture.css";

// Unlisted: reachable by direct link, but noindex and excluded from the sitemap,
// with a Disallow in robots. Not linked from any nav or footer.
export const metadata: Metadata = {
  title: "System walkthrough · Pawdex",
  description: "How Pawdex turns a vet document into a portable, cited medical record.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/architecture" },
};

const listStyle = {
  margin: "0",
  padding: "0",
  listStyle: "none",
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
};
const itemStyle = {
  font: "400 15px/1.55 var(--font-inter), system-ui, sans-serif",
  color: "var(--pw-text-secondary)",
  paddingLeft: "18px",
  position: "relative" as const,
};

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={listStyle}>
      {items.map((it, i) => (
        <li key={i} style={itemStyle}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "0.6em",
              width: 7,
              height: 7,
              borderRadius: 2,
              background: "var(--pw-accent)",
            }}
          />
          {it}
        </li>
      ))}
    </ul>
  );
}

function Trade({
  rank,
  title,
  body,
  bought,
  paid,
}: {
  rank: string;
  title: string;
  body: string;
  bought: string;
  paid: string;
}) {
  return (
    <div className="arch-trade">
      <span className="arch-trade-rank">{rank}</span>
      <div className="arch-trade-title">{title}</div>
      <p className="arch-trade-body">{body}</p>
      <div className="arch-trade-cost">
        <span className="arch-trade-bought">
          Bought: <b>{bought}</b>
        </span>
        <span className="arch-trade-paid">
          Cost: <b>{paid}</b>
        </span>
      </div>
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <main className="arch">
      <div className="arch-wrap">
        {/* Hero */}
        <header>
          <p className="arch-hero-eyebrow">Pawdex · system walkthrough</p>
          <h1 className="arch-hero-title">A medical record that survives the pet changing hands.</h1>
          <p className="arch-hero-lead">
            Pawdex turns any vet document, a photographed rabies certificate, a forwarded lab report, into a structured,
            portable medical record. This page traces the system end to end, and the one decision the whole schema is
            built around.
          </p>
          <StatRow>
            <Stat value={<>45</>} label="Postgres tables" />
            <Stat value={<>60</>} label="app routes" />
            <Stat value={<><em>3</em>-tier</>} label="AI extraction ladder" />
            <Stat value={<>30<em>d</em></>} label="restore window" />
            <Stat value={<>$0&ndash;29</>} label="per month" />
          </StatRow>
        </header>

        {/* 01 Topology */}
        <Section num="01" eyebrow="Topology">
          <Claim>
            One region, one database, and a hard line between the browser and the <strong>truth</strong>.
          </Claim>
          <Sub>
            The app is a Next.js App Router deployment pinned to a single Vercel region, co-located with Postgres to keep
            the hot path a short round trip. Every authenticated request passes the middleware gate before anything else
            runs. Vendor calls fire only on the flows that need them.
          </Sub>
          <DiagramFrame caption="The thick path is the hot path (app to Postgres). Dashed edges fire only on specific flows.">
            <TopologyDiagram />
          </DiagramFrame>
          <Legend>
            <LegendItem kind="primary" label="every request / hot path" />
            <LegendItem kind="default" label="in-region call" />
            <LegendItem kind="optional" label="flow-specific / external" />
          </Legend>
          <Detail summary="Specifics: runtime, region, vendors">
            <ul>
              <li>
                Next.js 16 App Router on Vercel, pinned to <code>pdx1</code> to sit next to Supabase in{" "}
                <code>us-west-2</code>. 60 page routes, 6 route handlers.
              </li>
              <li>
                External vendors: <code>OpenRouter</code> (extraction and answers), <code>OpenAI</code> (embeddings),{" "}
                <code>Resend</code> (email), <code>Stripe</code> (billing, wired but dormant).
              </li>
              <li>
                <code>pg_cron</code> calls back into the route handlers over HTTP for scheduled work, authenticated with a
                shared secret.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 02 Identity */}
        <Section num="02" eyebrow="Identity">
          <Claim>
            Authorization is enforced in the <strong>database</strong>, not hidden in the UI.
          </Claim>
          <Sub>
            The interface hides controls a read-only member cannot use, but that is presentation. The boundary that
            actually holds is row-level security in Postgres, which fails closed. The server-action role gate is the belt
            to that suspenders on the write paths that use the service role and bypass RLS by design.
          </Sub>
          <DiagramFrame caption="A member request is checked three times. Only the last two enforce; the database is the backstop.">
            <IdentityDiagram />
          </DiagramFrame>
          <Detail summary="Specifics: RLS, service role, tokens">
            <ul>
              <li>
                Reads gate on <code>is_household_member()</code>, writes on <code>has_household_write()</code>; both are
                security-definer and fail closed for the anon role.
              </li>
              <li>
                Service-role clients are constructed only after a webhook signature (svix) or a constant-time cron-secret
                check passes, never at module load.
              </li>
              <li>
                A <code>BEFORE UPDATE</code> trigger blocks members from writing privileged columns (soft-delete flags,
                plan, household kind) through the raw data API; those belong to the service role.
              </li>
              <li>Share, invite, and transfer tokens are stored as SHA-256 hashes; the raw token leaves the server once.</li>
            </ul>
          </Detail>
        </Section>

        {/* 03 Data */}
        <Section num="03" eyebrow="Data">
          <Claim>
            Forty-five tables, but really nine domains hanging off <strong>three anchors</strong>.
          </Claim>
          <Sub>
            Grouped by what they describe rather than alphabetically. The highlighted tables are the anchors the rest of
            the schema hangs off: <code>households</code> (tenancy), <code>animals</code> (identity), and{" "}
            <code>pets</code> (the clinical shell). Why identity and the clinical shell are separate tables is the
            centerpiece below.
          </Sub>
          <DataDomains />
          <Detail summary="Specifics: the anchor split">
            <ul>
              <li>
                <code>households</code> is the tenant boundary; almost every table carries a <code>household_id</code> and
                every RLS policy keys on it.
              </li>
              <li>
                <code>animals</code> is a stable identity that outlives ownership. <code>pets</code> is the
                household-scoped clinical shell that the medical rows attach to.
              </li>
              <li>
                <code>extraction_chunks</code> is the vector index behind Q&amp;A. Its scoping is what makes the transfer
                tradeoff below real.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 04 Main flow */}
        <Section num="04" eyebrow="The main flow">
          <Claim>
            The AI reads the document. A <strong>human</strong> decides what becomes true.
          </Claim>
          <Sub>
            Extraction is fast and cheap, but it never writes to the medical record directly. Facts land in a review
            state with a citation to the exact source page, and only your approval commits them. Indexing happens after
            that, out of band, so a slow or missing embedder can never block the commit.
          </Sub>
          <DiagramFrame caption="Ordering is the point: extract, review, approve, commit, then index out of band.">
            <IngestSequence />
          </DiagramFrame>
          <Detail summary="Specifics: extraction, citations, indexing">
            <ul>
              <li>Extraction runs the tier ladder (next section). Every fact returns with a citation to its source page.</li>
              <li>
                Nothing enters the clinical tables at <code>status = pending_review</code>. Commit writes the vaccination,
                medication, lab, and event rows in one shot.
              </li>
              <li>
                Indexing runs in an <code>after()</code> hook, best-effort. If the embeddings key is unset the commit
                still succeeds; the record is just not yet searchable.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 04b the ladder (supporting) */}
        <Section num="04b" eyebrow="Cost control">
          <Claim>
            Start on the cheapest model. Climb only when <strong>confidence or the law</strong> demands it.
          </Claim>
          <Sub>
            Most documents are legible and settle on the first, cheapest model. The ladder escalates on low confidence,
            and forces the top tier for legally significant documents like rabies certificates where a wrong date has
            consequences.
          </Sub>
          <DiagramFrame caption="Escalation is conditional, and size caps stop the climb from paying for a call that cannot succeed.">
            <ExtractionLadder />
          </DiagramFrame>
          <Detail summary="Specifics: models and caps">
            <ul>
              <li>
                Tier 1 <code>google/gemini-2.5-flash-lite</code>, Tier 2 <code>google/gemini-2.5-flash</code>, Tier 3{" "}
                <code>anthropic/claude-sonnet-4.5</code>, all via OpenRouter.
              </li>
              <li>Rabies certificates are pinned to Tier 3; tier-1 confidence alone is not trusted for them.</li>
              <li>
                A normal document too large for a tier is capped one rung down up front; a must-run-top-tier document that
                is oversized fails loudly rather than paying for a guaranteed failure.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 05 THE SPINE */}
        <Section num="05" eyebrow="The spine" id="spine">
          <Claim>
            The whole schema is shaped by one requirement: the record has to <strong>outlive the owner</strong>.
          </Claim>
          <Sub>
            A puppy is bred, placed, maybe rehomed years later. In most pet apps the medical history is welded to the
            account that created it, so a change of owner means a fresh, empty start. Pawdex is built the other way. A
            pet&rsquo;s identity is an <code>Animal</code>, decoupled from any household, and ownership is a time-ranged{" "}
            <code>custodianship</code> rather than a column on the record. That one inversion is why a single database
            function can hand an entire clinical history to a new owner atomically, and it is why the schema is split the
            way it is.
          </Sub>
          <DiagramFrame caption="Identity is the anchor. Ownership is an interval that moves. The clinical record follows the animal.">
            <SpineDiagram />
          </DiagramFrame>
          <p
            style={{
              font: "400 15.5px/1.6 var(--font-inter), system-ui, sans-serif",
              color: "var(--pw-text-secondary)",
              margin: "26px 0 16px",
              maxWidth: "64ch",
            }}
          >
            The move is not a copy. <code style={{ font: "400 13px var(--font-jetbrains-mono), monospace", background: "var(--pw-surface-3)", border: "1px solid var(--pw-border)", borderRadius: "var(--pw-r-xs)", padding: "1px 5px", color: "var(--pw-text)" }}>transfer_animal()</code>{" "}
            re-parents the clinical record to the new household in one transaction. And the interesting part is what it
            refuses to bring: the origin household&rsquo;s business, consent, and comms history stay put, because moving
            them would leak the prior owner&rsquo;s activity to the new one.
          </p>
          <TransferLedger />
          <Detail summary="Specifics: the RPC and the handshake">
            <ul>
              <li>
                <code>transfer_animal()</code> is security-definer, so its body runs as one atomic statement. It re-points{" "}
                <code>household_id</code> across the clinical tables, copies and dedupes referenced vet clinics, and swaps
                the owner custodianship.
              </li>
              <li>
                The handshake mirrors share links and invitations: the origin creates a tokenized link, only the token
                hash is stored, and the public accept route re-hashes the URL token to match.
              </li>
              <li>
                Deliberately left behind: insurance, claims, estimates, price quotes, outbound email, records requests,
                the raw extractions, multi-pet documents, and the vector index.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 06 Output */}
        <Section num="06" eyebrow="Output">
          <Claim>
            Everything the user sees is the same record, <strong>re-shaped</strong> for a moment of need.
          </Claim>
          <Sub>
            There is one source of truth and many views onto it, each built for a specific situation rather than a generic
            dashboard.
          </Sub>
          <Bullets
            items={[
              <>
                <strong>Cited answers.</strong> Q&amp;A retrieves the top 8 matching record chunks by vector similarity and
                answers with Claude Sonnet 4.5, grounded in your documents and cited back to them.
              </>,
              <>
                <strong>The review screen.</strong> Every extracted fact sits beside the source page it came from, so
                approval is a glance, not an act of faith.
              </>,
              <>
                <strong>Situation packets.</strong> Boarding packets, EU travel packets, and a printable emergency card,
                each assembled from the record for one real-world checkpoint.
              </>,
              <>
                <strong>Expiring-soon.</strong> Vaccines and medications tracked against real requirements, surfaced before
                they lapse rather than after.
              </>,
            ]}
          />
        </Section>

        {/* 07 Self-service */}
        <Section num="07" eyebrow="Self-service">
          <Claim>
            You can leave, and take <strong>everything</strong>, without emailing anyone.
          </Claim>
          <Bullets
            items={[
              <>
                <strong>Export, always.</strong> Viewing and exporting your records is free forever, including after
                cancellation. Nothing holds your data hostage.
              </>,
              <>
                <strong>Deletion with an undo.</strong> Delete a pet, a household, or your whole account behind an
                escalating confirmation, with a 30-day restore window and an immediate hard-delete path for privacy
                requests.
              </>,
              <>
                <strong>Move between contexts.</strong> Switch households, invite members with roles, and transfer a pet to
                a new owner, all self-served.
              </>,
            ]}
          />
        </Section>

        {/* 08 Metering */}
        <Section num="08" eyebrow="Metering & limits">
          <Claim>
            Plans meter <strong>capacity</strong>, never access to your own records. And enforcement has one home.
          </Claim>
          <Sub>
            The free tier holds 2 pets and 10 AI extractions a month; paid tiers ($6 and $29 a month) lift both. Whatever
            the tier, viewing and exporting the record is never gated, by design.
          </Sub>
          <Detail summary="Specifics: source of truth and rate limits">
            <ul>
              <li>
                Entitlements live in one module (<code>lib/billing/entitlements.ts</code>); every limit check reads from
                there.
              </li>
              <li>
                Honest state: enforcement is currently advisory. The kill-switch (<code>canEnforce()</code>) returns false
                during the beta, so limits inform the UI without blocking. That flips at launch.
              </li>
              <li>
                Abuse throttles are separate from entitlements: the contact form is capped per IP per minute, and the
                token-guessing surfaces (share, transfer, invite, unsubscribe) carry their own per-IP cap.
              </li>
            </ul>
          </Detail>
        </Section>

        {/* 09 Tradeoffs */}
        <Section num="09" eyebrow="Tradeoffs">
          <Claim>
            What I would change next, and what each choice <strong>bought</strong>.
          </Claim>
          <Sub>Ranked by impact. None of these are surprises; they are the roadmap the current shape implies.</Sub>
          <Trade
            rank="01"
            title="Re-index on transfer accept"
            body="A transferred pet arrives with a complete, human-approved record but no vector index, so Q&A under-answers about it until its documents are re-embedded into the new household. The move is correct and leak-proof; the index just needs to follow on accept."
            bought="an atomic, leak-proof ownership transfer"
            paid="transferred pets are temporarily unsearchable in Q&A"
          />
          <Trade
            rank="02"
            title="Turn entitlement enforcement on"
            body="Limits are computed and shown but not enforced while the beta kill-switch is on. The upside was that nothing could ever wall off a paying beta user's records; the flip is a one-line change plus the tests that guard it."
            bought="no record is ever held hostage during the beta"
            paid="plan limits are advisory today, not binding"
          />
          <Trade
            rank="03"
            title="Move the rate limiter off-instance"
            body="The abuse throttle is an in-process sliding window: zero dependencies, but per-instance and reset on cold start. It is fine as defense-in-depth over 192-bit tokens, and thin against a coordinated flood. A shared store closes that."
            bought="a throttle with no new infrastructure"
            paid="not distributed; resets on cold start"
          />
          <Trade
            rank="04"
            title="Trim the per-request auth round trip"
            body="Middleware verifies the session on every request, which is what keeps the auth token refreshed and correct, but it is a second round trip on the hot path. Narrowing where it runs would shave latency without losing the refresh."
            bought="correct session refresh on every request"
            paid="an extra auth round trip on the hot path"
          />
          <Trade
            rank="05"
            title="Live with the identity split"
            body="Separating animals from pets is why the record can move at all, but it also means an extra join and two identifiers where a naive schema has one. That is the deliberate price of portability, and I would pay it again."
            bought="a record that outlives the owner"
            paid="more joins and two IDs instead of one"
          />
        </Section>
      </div>
    </main>
  );
}
