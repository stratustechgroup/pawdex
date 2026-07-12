import { SkelPage, SkelCard, Skel } from "../../_skeleton";

// Pet detail skeleton: a photo + name header, a tab strip, and content cards.
export default function PetLoading() {
  return (
    <SkelPage maxWidth={1100}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 24 }}>
        <Skel w={72} h={72} r={36} />
        <div style={{ flex: 1 }}>
          <Skel w={220} h={26} r={8} />
          <Skel w={160} h={14} r={6} style={{ marginTop: 10 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} w={84} h={30} r={8} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <SkelCard style={{ height: 260 }}>
          <Skel w={140} h={16} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skel key={i} h={44} r={8} style={{ marginTop: 14 }} />
          ))}
        </SkelCard>
        <SkelCard style={{ height: 260 }}>
          <Skel w={120} h={16} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skel key={i} h={40} r={8} style={{ marginTop: 14 }} />
          ))}
        </SkelCard>
      </div>
    </SkelPage>
  );
}
