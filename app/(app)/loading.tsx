import { SkelPage, SkelCard, Skel } from "./_skeleton";

// Dashboard skeleton (also the default fallback for any (app) route without its
// own loading.tsx). Mirrors the cockpit shape: greeting, a pet-tile grid, then
// the two-column activity / upcoming layout, so the swap to real content barely
// shifts.
export default function DashboardLoading() {
  return (
    <SkelPage>
      <div style={{ marginBottom: 28 }}>
        <Skel w={280} h={30} r={8} />
        <Skel w={200} h={14} r={6} style={{ marginTop: 12 }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
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

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
        <SkelCard style={{ height: 320 }}>
          <Skel w={160} h={16} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skel key={i} h={44} r={8} style={{ marginTop: 14 }} />
          ))}
        </SkelCard>
        <SkelCard style={{ height: 320 }}>
          <Skel w={120} h={16} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skel key={i} h={40} r={8} style={{ marginTop: 14 }} />
          ))}
        </SkelCard>
      </div>
    </SkelPage>
  );
}
