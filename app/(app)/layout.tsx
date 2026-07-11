import { requireSession } from "@/lib/auth/household";
import { CommandPalette } from "@/components/pawdex/cockpit/command-palette";
import { listPetsForNav } from "@/lib/db/cockpit";
import { TopNavClient } from "./top-nav-client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const navPets = await listPetsForNav(session.householdId);

  const userInitials = (() => {
    const seed = (session.displayName || session.email?.split("@")[0] || "?").trim();
    const parts = seed.split(/[\s._-]+/).filter(Boolean);
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
      <a href="#main" className="pw-skip">
        Skip to content
      </a>
      <TopNavClient
        households={session.households}
        userInitials={userInitials}
        displayName={session.displayName}
        email={session.email}
      />
      <main id="main" style={{ flex: 1 }}>
        {children}
      </main>
      <CommandPalette
        pets={navPets}
        isBreeder={session.householdKind === "breeder"}
      />
    </div>
  );
}
