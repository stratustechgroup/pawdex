import { Skel, SkelCard, SkelSlot, SkelTable } from "../../../_skeleton";

// Briefing page slot: heading and an article-style summary (text blocks and a
// records table). Header-less; the pet layout keeps its own header + tabs.
export default function BriefingLoading() {
  return (
    <SkelSlot maxWidth={820}>
      <Skel w={260} h={26} r={8} />
      <Skel w={360} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <SkelCard style={{ padding: 20, marginBottom: 20 }}>
        <Skel w={160} h={15} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel key={i} w={i === 3 ? "70%" : "100%"} h={12} style={{ marginTop: 12 }} />
        ))}
      </SkelCard>
      <Skel w={140} h={14} r={6} style={{ marginBottom: 12 }} />
      <SkelTable cols={4} rows={5} />
    </SkelSlot>
  );
}
