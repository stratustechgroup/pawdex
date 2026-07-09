"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "" },
  { label: "Vaccines", href: "/vaccines" },
  { label: "Medical", href: "/medical" },
  { label: "Medications", href: "/medications" },
  { label: "Weight", href: "/weight" },
];

export function PetTabs({ petId }: { petId: string }) {
  const pathname = usePathname();
  const base = `/pets/${petId}`;

  return (
    <nav className="border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const href = `${base}${t.href}`;
          const isActive =
            t.href === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={t.label}>
              <Link
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center border-b-2 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
