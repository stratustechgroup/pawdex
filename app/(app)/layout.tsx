import { requireSession } from "@/lib/auth/household";
import { TopNavClient } from "./top-nav-client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const userInitials = (() => {
    const seed = (session.email ?? "?").split("@")[0] ?? "?";
    const parts = seed.split(/[._-]/).filter(Boolean);
    const first = parts[0]?.charAt(0) ?? "?";
    const last = parts[1]?.charAt(0) ?? "";
    return (first + last).toUpperCase() || "AO";
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--pw-bg)",
      }}
    >
      <TopNavClient
        householdName={session.householdName}
        userInitials={userInitials}
      />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
