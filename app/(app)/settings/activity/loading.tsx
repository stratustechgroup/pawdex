import { SkelPage, SkelSectionHead, SkelListRows, Skel } from "../../_skeleton";

// Activity log skeleton: breadcrumb, heading, then a card of icon + text +
// timestamp rows (the real page is a <ul>, not a table). maxWidth 900, 24px gap.
export default function ActivityLoading() {
  return (
    <SkelPage maxWidth={900}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Breadcrumb: Settings > Activity */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={54} h={12} r={6} />
          <Skel w={10} h={10} r={3} />
          <Skel w={60} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={140} subW={220} />

        <SkelListRows
          rows={8}
          icon={28}
          iconR={8}
          padding={14}
          line1="55%"
          line2="30%"
          trailing={90}
        />
      </div>
    </SkelPage>
  );
}
