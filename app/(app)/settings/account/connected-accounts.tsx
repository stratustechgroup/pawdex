"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { createClient } from "@/lib/supabase/browser";

import { secondaryButtonStyle } from "./ui";

export type IdentitySummary = {
  identityId: string;
  provider: string;
  createdAt: string | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  email: "Email",
  google: "Google",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function ConnectedAccounts({
  identities,
  googleEnabled,
}: {
  identities: IdentitySummary[];
  googleEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  const hasGoogle = identities.some((i) => i.provider === "google");
  // Unlinking the last identity would lock the user out entirely, so it's only
  // offered when more than one identity is connected.
  const canUnlink = identities.length > 1;

  function handleConnectGoogle() {
    startTransition(async () => {
      const { error } = await supabase.auth.linkIdentity({ provider: "google" });
      // On success the browser is redirected to Google, so we only reach here on
      // error (e.g. the provider isn't enabled).
      if (error) toast.error(error.message);
    });
  }

  function handleUnlink(summary: IdentitySummary) {
    if (
      !window.confirm(
        `Disconnect ${providerLabel(summary.provider)} from your Pawdex account?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      // unlinkIdentity needs the full identity object; fetch the live list and
      // match by identity_id.
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error || !data) {
        toast.error(error?.message ?? "Couldn't load your connected accounts.");
        return;
      }
      const identity = data.identities.find(
        (i) => (i.identity_id ?? i.id) === summary.identityId,
      );
      if (!identity) {
        toast.error("That connection is no longer available.");
        return;
      }
      const res = await supabase.auth.unlinkIdentity(identity);
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success(`${providerLabel(summary.provider)} disconnected`);
        window.location.reload();
      }
    });
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {identities.map((identity) => (
        <li key={identity.identityId} style={rowStyle}>
          <Icon
            name={identity.provider === "email" ? "mail" : "link"}
            size={15}
            style={{ color: "var(--pw-text-muted)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={primaryTextStyle}>{providerLabel(identity.provider)}</div>
            <div style={subTextStyle}>
              {identity.createdAt
                ? `Connected ${format(new Date(identity.createdAt), "MMM d, yyyy")}`
                : "Connected"}
            </div>
          </div>
          {canUnlink && (
            <button
              type="button"
              onClick={() => handleUnlink(identity)}
              disabled={isPending}
              style={secondaryButtonStyle(isPending)}
            >
              Disconnect
            </button>
          )}
        </li>
      ))}

      {!hasGoogle && (
        <li style={rowStyle}>
          <Icon
            name="link"
            size={15}
            style={{ color: "var(--pw-text-muted)", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={primaryTextStyle}>Google</div>
            <div style={subTextStyle}>
              {googleEnabled
                ? "Link your Google account to sign in with one tap."
                : "Google sign-in is coming soon."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnectGoogle}
            disabled={!googleEnabled || isPending}
            style={secondaryButtonStyle(!googleEnabled || isPending)}
            title={googleEnabled ? undefined : "Google sign-in is coming soon"}
          >
            Connect
          </button>
        </li>
      )}
    </ul>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  background: "var(--pw-surface-2)",
  borderRadius: 8,
};

const primaryTextStyle: React.CSSProperties = {
  font: "500 13px var(--font-inter)",
  color: "var(--pw-text)",
};

const subTextStyle: React.CSSProperties = {
  font: "400 11.5px var(--font-inter)",
  color: "var(--pw-text-muted)",
};
