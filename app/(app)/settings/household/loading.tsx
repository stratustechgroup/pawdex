import {
  SkelPage,
  SkelCard,
  SkelSectionHead,
  SkelFormRows,
  SkelListRows,
  Skel,
} from "../../_skeleton";

// Household settings skeleton: breadcrumb, header (household name), then the
// household-type / new-household / invite / people cards. Mirrors the common
// owner view. maxWidth 760, 32px section gap.
export default function HouseholdLoading() {
  return (
    <SkelPage maxWidth={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Breadcrumb: Settings > Household */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={54} h={12} r={6} />
          <Skel w={10} h={10} r={3} />
          <Skel w={78} h={12} r={6} />
        </div>

        <div>
          <Skel w={200} h={28} r={8} />
          <Skel w={320} h={14} r={6} style={{ marginTop: 10 }} />
        </div>

        {/* Household type */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={130} subW={300} />
          <Skel h={64} r={8} />
        </SkelCard>

        {/* New household */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={130} subW={320} />
          <SkelFormRows rows={2} />
        </SkelCard>

        {/* Invite a member */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={140} subW={280} />
          <SkelFormRows rows={1} />
        </SkelCard>

        {/* People */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={80} subW={null} />
          <div style={{ marginTop: 4 }}>
            <SkelListRows rows={3} icon={32} iconR={999} line1="40%" line2="25%" trailing={72} />
          </div>
        </SkelCard>
      </div>
    </SkelPage>
  );
}
