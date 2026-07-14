import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../_skeleton";

// Generic help skeleton. The /help segment has no page of its own (its children
// carry their own loading states), so this is a lightweight fallback: breadcrumb,
// heading, and a couple of content cards.
export default function HelpLoading() {
  return (
    <SkelPage maxWidth={900}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <Skel w={80} h={12} r={6} />
        <Skel w={110} h={12} r={6} />
      </div>

      <SkelSectionHead titleW={260} subW={340} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <SkelCard key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel w="40%" h={14} />
            <Skel w="90%" h={12} />
            <Skel w="75%" h={12} />
          </SkelCard>
        ))}
      </div>
    </SkelPage>
  );
}
