import { SkelPage, SkelCard, Skel } from "../_skeleton";

// Expiring/radar skeleton: a title and a stack of due-item rows.
export default function ExpiringLoading() {
  return (
    <SkelPage maxWidth={900}>
      <Skel w={220} h={26} r={8} />
      <Skel w={300} h={14} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <SkelCard style={{ padding: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
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
            <Skel w={36} h={36} r={8} />
            <div style={{ flex: 1 }}>
              <Skel w="45%" h={13} />
              <Skel w="25%" h={11} style={{ marginTop: 7 }} />
            </div>
            <Skel w={72} h={28} r={8} />
          </div>
        ))}
      </SkelCard>
    </SkelPage>
  );
}
