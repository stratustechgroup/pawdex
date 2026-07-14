import { SkelPage, SkelCard, Skel, SkelSectionHead } from "./_skeleton";

// Dashboard skeleton (also the default fallback for any (app) route without its
// own loading.tsx). Mirrors the cockpit shape: greeting, the "Needs attention"
// action strip, the pet-tile grid, then the two-column activity / upcoming
// layout, so the swap to real content barely shifts. Uses the same responsive
// grid classes as the real page (.pw-action-strip, .pw-tile-grid,
// .dashboard-grid) so it collapses identically on mobile.
export default function DashboardLoading() {
  return (
    <SkelPage>
      {/* Greeting + quick-add */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <Skel w={280} h={30} r={8} />
          <Skel w={220} h={14} r={6} style={{ marginTop: 12 }} />
        </div>
        <Skel w={132} h={38} r={8} />
      </div>

      {/* Needs attention: label + action strip */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Skel w={7} h={7} r={4} />
          <Skel w={130} h={14} r={6} />
        </div>
        <div className="pw-action-strip">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkelCard key={i} style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Skel w={30} h={30} r={8} />
                <div style={{ flex: 1 }}>
                  <Skel w="70%" h={13} />
                  <Skel w="45%" h={11} style={{ marginTop: 6 }} />
                </div>
                <Skel w={54} h={12} r={6} />
              </div>
            </SkelCard>
          ))}
        </div>
      </section>

      {/* Your pets: section head + tile grid */}
      <section style={{ marginBottom: 28 }}>
        <SkelSectionHead titleW={110} subW={200} action />
        <div className="pw-tile-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelCard key={i} style={{ height: 148 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Skel w={44} h={44} r={22} />
                <div style={{ flex: 1 }}>
                  <Skel w="60%" h={14} />
                  <Skel w="40%" h={12} style={{ marginTop: 8 }} />
                </div>
              </div>
              <Skel h={40} r={8} style={{ marginTop: 20 }} />
            </SkelCard>
          ))}
        </div>
      </section>

      {/* Main column (insights + activity) and Upcoming aside */}
      <div className="dashboard-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <SkelSectionHead titleW={130} subW={260} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
                gap: 12,
              }}
            >
              {Array.from({ length: 2 }).map((_, i) => (
                <SkelCard key={i} style={{ height: 120 }}>
                  <Skel w="55%" h={13} />
                  <Skel w="90%" h={12} style={{ marginTop: 12 }} />
                  <Skel w="70%" h={12} style={{ marginTop: 8 }} />
                </SkelCard>
              ))}
            </div>
          </section>

          <section>
            <SkelSectionHead titleW={150} subW={280} action />
            <SkelCard style={{ padding: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                  }}
                >
                  <Skel w={34} h={34} r={17} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skel w="55%" h={13} />
                    <Skel w="30%" h={11} style={{ marginTop: 7 }} />
                  </div>
                  <Skel w={48} h={11} r={6} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </SkelCard>
          </section>
        </div>

        <aside>
          <SkelSectionHead titleW={100} subW={110} />
          <SkelCard style={{ padding: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                }}
              >
                <div style={{ width: 32, textAlign: "center", flexShrink: 0 }}>
                  <Skel w={26} h={10} r={5} style={{ margin: "0 auto" }} />
                  <Skel w={18} h={14} r={5} style={{ margin: "6px auto 0" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skel w="70%" h={12} />
                  <Skel w="40%" h={11} style={{ marginTop: 6 }} />
                </div>
              </div>
            ))}
          </SkelCard>
        </aside>
      </div>
    </SkelPage>
  );
}
