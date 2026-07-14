"use client";

import { usePathname } from "next/navigation";

import { PrefetchLink } from "@/components/pawdex/prefetch-link";

// NOTE: "Risk" tab intentionally removed pending an editorial process for
// veterinary medical claims. The /breed-risk route + lib/clinical/breed-risk.ts
// remain in the repo — re-enable by restoring this entry once we have:
//  (1) reviewer-gated content workflow, (2) ≥70 breeds × ≥10 conditions
//  matrix, (3) per-claim source citations, (4) liability framing reviewed
//  by counsel. See README "Phase 6.37 — Breed risk pulled".
const TABS = [
  { label: "Overview", href: "" },
  { label: "Vaccines", href: "/vaccines" },
  { label: "Medical", href: "/medical" },
  { label: "Labs", href: "/labs" },
  { label: "Medications", href: "/medications" },
  { label: "Weight", href: "/weight" },
  { label: "QoL", href: "/quality-of-life" },
  { label: "Documents", href: "/documents" },
] as const;

export function PetTabs({
  petId,
  counts,
}: {
  petId: string;
  counts: Partial<Record<(typeof TABS)[number]["label"], number>>;
}) {
  const pathname = usePathname();
  const base = `/pets/${petId}`;

  return (
    <nav className="pet-tabs" aria-label="Pet sections">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const isActive =
          t.href === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);
        const count = counts[t.label];
        return (
          <PrefetchLink
            key={t.label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="pet-tab"
          >
            {t.label}
            {count !== undefined && count > 0 && (
              <span className="tab-count">{count}</span>
            )}
          </PrefetchLink>
        );
      })}
    </nav>
  );
}
