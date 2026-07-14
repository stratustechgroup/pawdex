import { SkelPage, SkelCard, SkelFormRows, Skel } from "../../_skeleton";

// Litter detail skeleton: back link, litter title + parents line, the puppies
// list (photo + name/breed + placement control + record button), then an
// "Add a puppy" form card.
export default function LitterDetailLoading() {
  return (
    <SkelPage maxWidth={860}>
      <Skel w={90} h={13} r={6} style={{ marginBottom: 16 }} />

      <div style={{ marginBottom: 24 }}>
        <Skel w={180} h={26} r={6} />
        <Skel w="70%" h={13} r={6} style={{ marginTop: 8 }} />
      </div>

      <section style={{ marginBottom: 30 }}>
        <Skel w={130} h={14} r={6} style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelCard
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                flexWrap: "wrap",
              }}
            >
              <Skel w={38} h={38} r={19} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                <Skel w="45%" h={14} />
                <Skel w="60%" h={12} style={{ marginTop: 6 }} />
              </div>
              <Skel w={120} h={32} r={8} style={{ flexShrink: 0 }} />
              <Skel w={90} h={32} r={6} style={{ flexShrink: 0 }} />
            </SkelCard>
          ))}
        </div>
      </section>

      <section>
        <Skel w={110} h={14} r={6} style={{ marginBottom: 12 }} />
        <SkelCard style={{ padding: 18 }}>
          <SkelFormRows rows={4} />
          <Skel w={120} h={36} r={8} style={{ marginTop: 18 }} />
        </SkelCard>
      </section>
    </SkelPage>
  );
}
