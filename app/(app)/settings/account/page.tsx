import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { requireSession } from "@/lib/auth/household";
import { getExternalProviders } from "@/lib/auth/auth-settings";
import { createClient } from "@/lib/supabase/server";

import { ProfileForm } from "./profile-form";
import { EmailForm } from "./email-form";
import { PasswordForm } from "./password-form";
import { ConnectedAccounts, type IdentitySummary } from "./connected-accounts";

export const metadata = { title: "Account — Pawdex" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: userData }, providers] = await Promise.all([
    supabase.auth.getUser(),
    getExternalProviders(),
  ]);

  // App-maintained flag written by the setPassword action. See that action for
  // why auth.users.encrypted_password can't be used to detect password presence.
  const hasPassword = userData?.user?.user_metadata?.password_set === true;

  const identities: IdentitySummary[] = (userData?.user?.identities ?? []).map(
    (i) => ({
      identityId: i.identity_id ?? i.id,
      provider: i.provider,
      createdAt: i.created_at ?? null,
    }),
  );

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
        <span style={{ color: "var(--pw-text)" }}>Account</span>
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
          Account
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Your profile, sign-in email, password, and connected accounts.
        </p>
      </header>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead title="Profile" sub="The name shown across Pawdex and to your household." />
        <ProfileForm initialName={session.displayName ?? ""} />
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead title="Email" sub="The address you sign in with and where account emails go." />
        <EmailForm currentEmail={session.email ?? ""} />
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead
          title="Password"
          sub={
            hasPassword
              ? "Change the password you use to sign in."
              : "You sign in with magic links. Add a password for a second way in."
          }
        />
        <PasswordForm hasPassword={hasPassword} />
      </section>

      <section className="pw-card" style={{ padding: 20 }}>
        <SectionHead
          title="Connected accounts"
          sub="Sign in faster by linking a provider to your Pawdex account."
        />
        <ConnectedAccounts
          identities={identities}
          googleEnabled={providers.google}
        />
      </section>

      <section
        className="pw-card"
        style={{
          padding: 20,
          borderColor: "var(--pw-border)",
        }}
      >
        <SectionHead title="Delete account" sub="Permanently remove your account and data." />
        <p
          style={{
            margin: 0,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Account deletion isn&apos;t self-serve yet. To close your account and
          erase your data, email{" "}
          <a
            href="mailto:support@pawdex.app"
            style={{ color: "var(--pw-accent)", textDecoration: "none" }}
          >
            support@pawdex.app
          </a>{" "}
          and we&apos;ll take care of it.
        </p>
      </section>
    </div>
  );
}
