import { Skel, SkelCard, SkelSlot, SkelSectionHead } from "../../../_skeleton";

// Labs subtab page slot: section head, a summary card, then per-analyte result
// cards each with a small 3-up stat row. Header-less by design.
export default function LabsLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SkelSectionHead titleW={140} subW={280} action />
        <SkelCard style={{ padding: 18 }}>
          <Skel w={160} h={14} />
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
              gap: 12,
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skel w="60%" h={11} />
                <Skel w="45%" h={16} r={6} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        </SkelCard>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkelCard key={i} style={{ padding: 18 }}>
            <Skel w={140} h={14} />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skel key={j} h={34} r={8} style={{ marginTop: 12 }} />
            ))}
          </SkelCard>
        ))}
      </div>
    </SkelSlot>
  );
}
