import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../_skeleton";

// Policy-detail subtree fallback. There is no page.tsx at this segment (the
// policy opens straight into a sub-tab), so this is the outer Suspense boundary
// that can surface on a cross-segment nav into /insurance/[policyId]/*. Generic
// shape: breadcrumb, a section heading, and a single content card.
export default function PolicyDetailLoading() {
  return (
    <SkelPage maxWidth={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={90} h={12} r={6} />
          <Skel w={70} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={230} subW={340} />

        <SkelCard style={{ padding: 20 }}>
          <Skel w={140} h={14} r={6} />
          <Skel h={38} r={8} style={{ marginTop: 14 }} />
          <Skel h={38} r={8} style={{ marginTop: 12 }} />
          <Skel w="55%" h={38} r={8} style={{ marginTop: 12 }} />
        </SkelCard>
      </div>
    </SkelPage>
  );
}
