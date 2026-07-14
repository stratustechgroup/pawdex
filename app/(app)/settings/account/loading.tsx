import {
  SkelPage,
  SkelCard,
  SkelSectionHead,
  SkelFormRows,
  Skel,
} from "../../_skeleton";

// Account settings skeleton: breadcrumb, header, then Profile / Email / Password
// / Connected accounts / Delete-account cards. maxWidth 760, 32px section gap.
export default function AccountLoading() {
  return (
    <SkelPage maxWidth={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Breadcrumb: Settings > Account */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={54} h={12} r={6} />
          <Skel w={10} h={10} r={3} />
          <Skel w={62} h={12} r={6} />
        </div>

        <div>
          <Skel w={130} h={28} r={8} />
          <Skel w={300} h={14} r={6} style={{ marginTop: 10 }} />
        </div>

        {/* Profile */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={80} subW={280} />
          <SkelFormRows rows={1} />
        </SkelCard>

        {/* Email */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={70} subW={300} />
          <SkelFormRows rows={1} />
        </SkelCard>

        {/* Password */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={100} subW={320} />
          <SkelFormRows rows={2} />
        </SkelCard>

        {/* Connected accounts */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={180} subW={280} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel h={48} r={8} />
          </div>
        </SkelCard>

        {/* Delete account */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={130} subW={260} />
          <Skel w="85%" h={12} r={6} style={{ marginTop: 2 }} />
        </SkelCard>
      </div>
    </SkelPage>
  );
}
