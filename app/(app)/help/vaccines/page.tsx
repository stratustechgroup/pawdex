import Link from "next/link";

import { Icon } from "@/components/brand/icon";
import { SectionHead } from "@/components/pawdex/chips";
import { VACCINE_CATALOG_LIST } from "@/lib/clinical/vaccine-catalog";

export const metadata = { title: "Vaccine durations — Pawdex" };

const SPECIES_LABEL: Record<"dog" | "cat" | "both", string> = {
  dog: "Dogs",
  cat: "Cats",
  both: "Dogs + Cats",
};

const SPECIES_ORDER: Array<"dog" | "cat" | "both"> = ["dog", "cat", "both"];

export default function VaccineCatalogHelpPage() {
  const grouped = SPECIES_ORDER.map((species) => ({
    species,
    entries: VACCINE_CATALOG_LIST.filter((e) => e.species === species),
  })).filter((g) => g.entries.length > 0);

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
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
        <span style={{ color: "var(--pw-text)" }}>Vaccine durations</span>
      </div>

      <SectionHead
        title="How Pawdex computes vaccine expirations"
        sub="When a vet certificate doesn't list an expiry, Pawdex falls back to these catalog defaults from AAHA / AAFP guidelines. You can always override on a per-row basis — the catalog is just a smart default, never a hard rule."
      />

      <section
        className="pw-card"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--pw-status-due-bg)",
          borderColor: "var(--pw-status-due-dot)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div
            style={{
              color: "var(--pw-status-due-fg)",
              marginTop: 1,
            }}
          >
            <Icon name="shield" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                font: "600 13px var(--font-inter)",
                color: "var(--pw-status-due-fg)",
              }}
            >
              Rabies is state-law-controlled
            </div>
            <p
              style={{
                margin: "4px 0 0",
                font: "400 12.5px var(--font-inter)",
                color: "var(--pw-text-secondary)",
              }}
            >
              The catalog default for rabies is the AAHA maximum (3 years for
              adult boosters, 1 year for the first dose). Your state may
              require annual boosters regardless of product label — verify
              against your jurisdiction before relying on these dates for
              boarding, travel, or licensing.
            </p>
          </div>
        </div>
      </section>

      {grouped.map(({ species, entries }) => (
        <section
          key={species}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <h2
            style={{
              margin: 0,
              font: "600 14px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            {SPECIES_LABEL[species]}
          </h2>
          <div className="pw-card" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "400 13px var(--font-inter)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--pw-surface-2)" }}>
                  <Th>Vaccine</Th>
                  <Th>Default duration</Th>
                  <Th>Alternates</Th>
                  <Th>First dose</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.family}
                    style={{ borderTop: "1px solid var(--pw-border)" }}
                  >
                    <Td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontWeight: 500, color: "var(--pw-text)" }}>
                          {entry.label}
                        </span>
                        {entry.legally_sensitive && (
                          <span
                            title="State law controls"
                            style={{
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: "var(--pw-surface-2)",
                              color: "var(--pw-text-muted)",
                              font: "600 9.5px var(--font-jetbrains)",
                              letterSpacing: "0.06em",
                            }}
                          >
                            <Icon name="shield" size={9} /> LEGAL
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="tnum" style={{ color: "var(--pw-text)" }}>
                        {monthsToHuman(entry.default_duration_months)}
                      </span>
                    </Td>
                    <Td>
                      {entry.alt_durations_months.length === 0 ? (
                        <span style={{ color: "var(--pw-text-subtle)" }}>—</span>
                      ) : (
                        <span
                          className="tnum"
                          style={{ color: "var(--pw-text-secondary)" }}
                        >
                          {entry.alt_durations_months
                            .map(monthsToHuman)
                            .join(", ")}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {entry.first_dose_is_one_year ? (
                        <span
                          style={{
                            padding: "1px 6px",
                            borderRadius: 3,
                            background: "var(--pw-surface-2)",
                            color: "var(--pw-text-secondary)",
                            font: "500 11px var(--font-inter)",
                          }}
                        >
                          1 year
                        </span>
                      ) : (
                        <span style={{ color: "var(--pw-text-subtle)" }}>
                          Same
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span
                        style={{
                          color: "var(--pw-text-muted)",
                          font: "400 12px var(--font-inter)",
                          display: "block",
                          maxWidth: 380,
                        }}
                      >
                        {entry.notes}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section
        className="pw-card"
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
      >
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          How Pawdex picks first-dose vs booster
        </h2>
        <p
          style={{
            margin: 0,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-secondary)",
          }}
        >
          For vaccines where AAHA mandates a 1-year duration on the initial
          dose (Rabies, DHPP, FVRCP), Pawdex checks the pet&apos;s date of
          birth at the time of administration:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <li>
            If the pet is <strong>18 months or younger</strong> on the
            administered date, the dose is treated as the initial dose and
            expiry is set to 1 year out.
          </li>
          <li>
            Older than 18 months, the dose is assumed to be an adult booster
            and the catalog default duration applies (3 years for rabies /
            DHPP / FVRCP when the product label permits).
          </li>
          <li>
            If the source document is explicit (&quot;initial dose&quot;,
            &quot;puppy series&quot;, &quot;1-year booster&quot;), the
            extraction prompt will pass that hint through and override the age
            heuristic.
          </li>
        </ul>
      </section>

      <section
        className="pw-card"
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
      >
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          Sources
        </h2>
        <p
          style={{
            margin: 0,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-secondary)",
          }}
        >
          The catalog is built from the{" "}
          <strong>2022 AAHA Canine Vaccination Guidelines</strong>, the{" "}
          <strong>2020 AAFP Feline Vaccination Guidelines</strong>, the CDC
          rabies compendium, and individual product labels for commonly used
          vaccines (Nobivac, Vanguard, PUREVAX, Bronchi-Shield).
        </p>
      </section>
    </div>
  );
}

function monthsToHuman(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        font: "500 11.5px var(--font-inter)",
        color: "var(--pw-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: "1px solid var(--pw-border)",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        verticalAlign: "top",
        font: "400 13px var(--font-inter)",
        color: "var(--pw-text)",
      }}
    >
      {children}
    </td>
  );
}
