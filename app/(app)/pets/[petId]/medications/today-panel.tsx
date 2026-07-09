import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";

import { markDoseGiven, undoDose } from "./dose-actions";

type ActiveMed = {
  id: string;
  name: string;
  dose: string;
  frequency: string | null;
};

type AdminRow = {
  id: string;
  medication_id: string;
  administered_at: string | null;
};

export function TodayPanel({
  petId,
  activeMeds,
  todaysAdministrations,
}: {
  petId: string;
  activeMeds: ActiveMed[];
  todaysAdministrations: AdminRow[];
}) {
  if (activeMeds.length === 0) return null;

  // Group administrations by med so we can show count + per-row buttons.
  const adminsByMed = new Map<string, AdminRow[]>();
  for (const a of todaysAdministrations) {
    const list = adminsByMed.get(a.medication_id) ?? [];
    list.push(a);
    adminsByMed.set(a.medication_id, list);
  }

  return (
    <section
      className="pw-card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              font: "600 14px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            Today&apos;s doses
          </h2>
          <div
            style={{
              marginTop: 3,
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            {format(new Date(), "EEEE, MMM d")} · {activeMeds.length} active
            medication{activeMeds.length === 1 ? "" : "s"} · {" "}
            {todaysAdministrations.length} dose
            {todaysAdministrations.length === 1 ? "" : "s"} logged
          </div>
        </div>
      </header>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {activeMeds.map((m) => {
          const admins = adminsByMed.get(m.id) ?? [];
          return (
            <li
              key={m.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: 12,
                borderRadius: 8,
                background:
                  admins.length > 0
                    ? "var(--pw-accent-soft)"
                    : "var(--pw-surface-muted)",
                color:
                  admins.length > 0
                    ? "var(--pw-accent-fg-on-soft)"
                    : "var(--pw-text)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background:
                    admins.length > 0
                      ? "var(--pw-accent)"
                      : "var(--pw-surface)",
                  color:
                    admins.length > 0
                      ? "var(--pw-accent-fg)"
                      : "var(--pw-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={admins.length > 0 ? "check" : "pill"} size={13} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "600 13.5px var(--font-inter)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    font: "400 12px var(--font-inter)",
                    opacity: 0.8,
                  }}
                >
                  <span className="mono">{m.dose}</span>
                  {m.frequency && <> · {m.frequency}</>}
                  {admins.length > 0 && admins[0].administered_at && (
                    <>
                      {" · last "}
                      {format(new Date(admins[0].administered_at), "h:mm a")}
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {admins.length > 0 && admins[0] && (
                  <form action={undoDose}>
                    <input type="hidden" name="administration_id" value={admins[0].id} />
                    <input type="hidden" name="pet_id" value={petId} />
                    <button
                      type="submit"
                      title="Undo last dose"
                      style={{
                        height: 30,
                        padding: "0 10px",
                        borderRadius: 6,
                        border: "1px solid currentColor",
                        background: "transparent",
                        color: "inherit",
                        font: "500 11.5px var(--font-inter)",
                        cursor: "pointer",
                        opacity: 0.7,
                      }}
                    >
                      Undo
                    </button>
                  </form>
                )}
                <form action={markDoseGiven}>
                  <input type="hidden" name="medication_id" value={m.id} />
                  <input type="hidden" name="pet_id" value={petId} />
                  <button
                    type="submit"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      height: 30,
                      padding: "0 12px",
                      borderRadius: 6,
                      border:
                        admins.length > 0
                          ? "1px solid currentColor"
                          : "1px solid var(--pw-accent)",
                      background:
                        admins.length > 0
                          ? "var(--pw-surface)"
                          : "var(--pw-accent)",
                      color:
                        admins.length > 0
                          ? "var(--pw-text)"
                          : "var(--pw-accent-fg)",
                      font: "500 12px var(--font-inter)",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="plus" size={11} />
                    {admins.length > 0
                      ? `Log another (${admins.length})`
                      : "Mark given"}
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
