import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import {
  listAuthorizationsForHousehold,
  type AuthorizationStateRow,
} from "@/lib/auth/authorizations";

import {
  grantAuthorizationAction,
  revokeAuthorizationAction,
} from "./actions";

export const metadata = { title: "Authorizations · Pawdex" };
export const dynamic = "force-dynamic";

export default async function AuthorizationsPage() {
  const session = await requireSession();
  const rows = await listAuthorizationsForHousehold(session.householdId);

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
        <Link
          href="/settings"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          Settings
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>Authorizations</span>
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
          Authorizations
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            maxWidth: 620,
          }}
        >
          Explicit consent for the outbound actions Pawdex takes on your behalf.
          Every grant is recorded with timestamp, IP, and the exact text you
          agreed to. You can revoke at any time.
        </p>
      </header>

      {session.role !== "owner" && (
        <div
          style={{
            padding: 12,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="shieldCheck" size={14} />
          Only the household owner can change most authorizations. You can still
          view current state.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map((row) => (
          <AuthorizationCard
            key={row.descriptor.type}
            row={row}
            canWrite={
              !row.descriptor.requiresOwner || session.role === "owner"
            }
          />
        ))}
      </div>
    </div>
  );
}

function AuthorizationCard({
  row,
  canWrite,
}: {
  row: AuthorizationStateRow;
  canWrite: boolean;
}) {
  const { descriptor, effective, history } = row;
  const isGranted = effective !== null;

  return (
    <section
      className="pw-card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        borderLeft: `3px solid ${
          isGranted ? "var(--pw-accent)" : "var(--pw-border)"
        }`,
      }}
    >
      <header
        style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: isGranted
              ? "var(--pw-accent-soft)"
              : "var(--pw-surface-muted)",
            color: isGranted
              ? "var(--pw-accent-fg-on-soft)"
              : "var(--pw-text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={descriptor.icon} size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                font: "600 15px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              {descriptor.label}
            </h2>
            <StatusPill granted={isGranted} effective={effective} />
          </div>
          <p
            style={{
              margin: "6px 0 0",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {descriptor.short}
          </p>
        </div>
      </header>

      <details
        style={{
          padding: 12,
          borderRadius: 8,
          background: "var(--pw-surface-muted)",
          border: "1px solid var(--pw-border)",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            font: "500 12px var(--font-inter)",
            color: "var(--pw-text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          What you&apos;re agreeing to
        </summary>
        <p
          style={{
            margin: "10px 0 0",
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text)",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {descriptor.scopeText}
        </p>
      </details>

      {history.length > 0 && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              font: "500 11.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            History ({history.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            {history.map((h) => (
              <li
                key={h.id}
                style={{
                  display: "flex",
                  gap: 8,
                  paddingBottom: 6,
                  borderBottom: "1px dashed var(--pw-border)",
                }}
              >
                <span
                  style={{
                    color:
                      h.revoked_at === null
                        ? "var(--pw-accent)"
                        : "var(--pw-text-muted)",
                    minWidth: 70,
                  }}
                >
                  {h.revoked_at === null ? "Granted" : "Revoked"}
                </span>
                <span>
                  {format(new Date(h.granted_at), "MMM d, yyyy 'at' h:mm a")}
                  {h.revoked_at &&
                    ` → revoked ${format(new Date(h.revoked_at), "MMM d, yyyy 'at' h:mm a")}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <footer
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        {isGranted ? (
          <form action={revokeAuthorizationAction}>
            <input type="hidden" name="type" value={descriptor.type} />
            <button
              type="submit"
              disabled={!canWrite}
              style={{
                ...buttonBaseStyle,
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                border: "1px solid var(--pw-border-strong)",
                opacity: canWrite ? 1 : 0.5,
                cursor: canWrite ? "pointer" : "not-allowed",
              }}
            >
              Revoke
            </button>
          </form>
        ) : (
          <form action={grantAuthorizationAction}>
            <input type="hidden" name="type" value={descriptor.type} />
            <button
              type="submit"
              disabled={!canWrite}
              style={{
                ...buttonBaseStyle,
                background: "var(--pw-accent)",
                color: "var(--pw-accent-fg)",
                border: "1px solid var(--pw-accent)",
                opacity: canWrite ? 1 : 0.5,
                cursor: canWrite ? "pointer" : "not-allowed",
              }}
            >
              Grant authorization
            </button>
          </form>
        )}
      </footer>
    </section>
  );
}

const buttonBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 14px",
  borderRadius: 6,
  font: "500 12.5px var(--font-inter)",
};

function StatusPill({
  granted,
  effective,
}: {
  granted: boolean;
  effective: NonNullable<AuthorizationStateRow["effective"]> | null;
}) {
  if (granted && effective) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 999,
          background: "var(--pw-accent-soft)",
          color: "var(--pw-accent-fg-on-soft)",
          font: "500 10.5px var(--font-inter)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <Icon name="checkCircle" size={10} />
        Granted {format(new Date(effective.granted_at), "MMM d, yyyy")}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--pw-surface-muted)",
        color: "var(--pw-text-muted)",
        font: "500 10.5px var(--font-inter)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      Not granted
    </span>
  );
}
