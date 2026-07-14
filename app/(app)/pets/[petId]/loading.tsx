import { Skel, SkelCard, SkelSlot, SkelSectionHead } from "../../_skeleton";

// Overview page-slot skeleton. Renders INSIDE the pet layout body (which
// supplies the gutters and keeps the header + stat strip + tabs on screen), so
// this file is header-less on purpose: the real header must never be doubled.
// Mirrors the overview: a KPI card row, then a two-column main / aside split
// that stacks under 980px (matching .pet-overview-grid in the real page).
export default function PetOverviewLoading() {
  return (
    <SkelSlot>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelCard key={i} style={{ height: 96 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Skel w={30} h={30} r={8} />
              <Skel w="55%" h={12} />
            </div>
            <Skel w="70%" h={18} r={6} style={{ marginTop: 16 }} />
          </SkelCard>
        ))}
      </div>

      <div className="pet-overview-skel-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SkelSectionHead titleW={150} subW={220} />
            <SkelCard style={{ padding: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                  }}
                >
                  <Skel w={38} h={38} r={8} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skel w="50%" h={13} />
                    <Skel w="30%" h={11} style={{ marginTop: 7 }} />
                  </div>
                  <Skel w={60} h={12} r={6} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </SkelCard>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SkelCard style={{ height: 180 }}>
            <Skel w={120} h={15} />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skel key={i} h={34} r={8} style={{ marginTop: 14 }} />
            ))}
          </SkelCard>
          <SkelCard style={{ height: 140 }}>
            <Skel w={100} h={15} />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skel key={i} h={34} r={8} style={{ marginTop: 14 }} />
            ))}
          </SkelCard>
        </aside>
      </div>

      <style>{`
        .pet-overview-skel-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 980px) {
          .pet-overview-skel-grid {
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 28px;
            align-items: start;
          }
        }
      `}</style>
    </SkelSlot>
  );
}
