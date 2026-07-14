import { SkelPage, SkelCard, SkelSectionHead, SkelFormRows, Skel } from "../_skeleton";

// Breeding skeleton: page title + intro, a "New litter" form card, then the
// list of litters (icon tile + name/parents line + chevron).
export default function BreedingLoading() {
  return (
    <SkelPage maxWidth={860}>
      <div style={{ marginBottom: 24 }}>
        <Skel w={160} h={26} r={6} />
        <Skel w="80%" h={13} r={6} style={{ marginTop: 8 }} />
      </div>

      <section style={{ marginBottom: 32 }}>
        <SkelSectionHead titleW={110} subW={300} />
        <SkelCard style={{ padding: 18 }}>
          <SkelFormRows rows={3} />
          <Skel w={130} h={36} r={8} style={{ marginTop: 18 }} />
        </SkelCard>
      </section>

      <section>
        <SkelSectionHead titleW={80} subW={90} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelCard
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}
            >
              <Skel w={38} h={38} r={9} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skel w="35%" h={14} />
                <Skel w="60%" h={12} style={{ marginTop: 6 }} />
              </div>
              <Skel w={16} h={16} r={5} style={{ flexShrink: 0 }} />
            </SkelCard>
          ))}
        </div>
      </section>
    </SkelPage>
  );
}
