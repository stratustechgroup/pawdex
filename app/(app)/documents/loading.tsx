import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../_skeleton";

// Documents skeleton: heading with an upload action, two filter chip rows
// (pet + type), then date-bucketed cards of document rows (thumb + two lines +
// date + open button).
export default function DocumentsLoading() {
  return (
    <SkelPage maxWidth={1320}>
      <SkelSectionHead titleW={170} subW={280} action />

      {/* Filter chip rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {[6, 5].map((count, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Skel w={36} h={11} r={5} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Array.from({ length: count }).map((_, i) => (
                <Skel key={i} w={70 + ((i * 13) % 40)} h={26} r={13} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Date buckets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {["Today", "This week"].map((_, b) => (
          <section key={b}>
            <Skel w={90} h={11} r={5} style={{ marginBottom: 8 }} />
            <SkelCard style={{ padding: "4px 0" }}>
              {Array.from({ length: b === 0 ? 3 : 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                  }}
                >
                  <Skel w={32} h={40} r={4} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skel w="50%" h={13} />
                    <Skel w="35%" h={11} style={{ marginTop: 7 }} />
                  </div>
                  <Skel w={36} h={11} r={5} style={{ flexShrink: 0 }} />
                  <Skel w={58} h={26} r={6} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </SkelCard>
          </section>
        ))}
      </div>
    </SkelPage>
  );
}
