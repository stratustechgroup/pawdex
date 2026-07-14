import { Skel, SkelCard, SkelSlot, SkelSectionHead } from "../../../_skeleton";

// Quality-of-life subtab page slot: section head, an assessment summary card,
// then a couple of detail cards. Header-less by design.
export default function QualityOfLifeLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SkelSectionHead titleW={180} subW={300} action />
        <SkelCard style={{ padding: 20 }}>
          <Skel w={160} h={15} />
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))",
              gap: 14,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skel w="70%" h={11} />
                <Skel w="40%" h={20} r={6} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        </SkelCard>
        {Array.from({ length: 2 }).map((_, i) => (
          <SkelCard key={i} style={{ padding: 20 }}>
            <Skel w={140} h={14} />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skel key={j} h={38} r={8} style={{ marginTop: 12 }} />
            ))}
          </SkelCard>
        ))}
      </div>
    </SkelSlot>
  );
}
