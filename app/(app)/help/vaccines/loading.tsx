import { SkelPage, SkelCard, SkelSectionHead, SkelTable, Skel } from "../../_skeleton";

// Vaccine durations help skeleton: breadcrumb, heading, the rabies callout card,
// three species groups (label + 5-column table), then two explainer cards.
export default function VaccineHelpLoading() {
  return (
    <SkelPage maxWidth={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={70} h={12} r={6} />
          <Skel w={140} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={340} subW={420} />

        {/* Rabies callout */}
        <SkelCard style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Skel w={16} h={16} r={5} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <Skel w={220} h={13} />
            <Skel w="95%" h={12} style={{ marginTop: 8 }} />
            <Skel w="85%" h={12} style={{ marginTop: 6 }} />
          </div>
        </SkelCard>

        {/* Species groups */}
        {["Dogs", "Cats", "Dogs + Cats"].map((_, i) => (
          <section key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel w={110} h={14} r={6} />
            <SkelTable cols={5} rows={i === 2 ? 3 : 5} minWidth={640} />
          </section>
        ))}

        {/* Explainer cards */}
        {[0, 1].map((i) => (
          <SkelCard key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skel w="45%" h={13} />
            <Skel w="95%" h={12} style={{ marginTop: 2 }} />
            <Skel w="88%" h={12} />
            <Skel w="70%" h={12} />
          </SkelCard>
        ))}
      </div>
    </SkelPage>
  );
}
