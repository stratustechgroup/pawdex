import { SkelPage, SkelCard, Skel } from "../_skeleton";

// Insurance skeleton: title plus a grid of policy cards.
export default function InsuranceLoading() {
  return (
    <SkelPage maxWidth={1100}>
      <Skel w={200} h={26} r={8} />
      <Skel w={320} h={14} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <SkelCard key={i} style={{ height: 172 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Skel w={120} h={16} />
              <Skel w={56} h={22} r={11} />
            </div>
            <Skel w="70%" h={13} style={{ marginTop: 16 }} />
            <Skel w="50%" h={13} style={{ marginTop: 10 }} />
            <Skel h={36} r={8} style={{ marginTop: 22 }} />
          </SkelCard>
        ))}
      </div>
    </SkelPage>
  );
}
