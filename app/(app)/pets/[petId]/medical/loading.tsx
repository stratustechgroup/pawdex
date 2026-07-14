import { Skel, SkelCard, SkelSlot, SkelSectionHead, SkelTable } from "../../../_skeleton";

// Medical subtab page slot: heading + a summary callout card + the medical
// events table (Date / Type / Title / Clinic). Header-less by design.
export default function MedicalLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkelSectionHead titleW={160} subW={280} action />
        <SkelCard>
          <Skel w="40%" h={13} />
          <Skel w="65%" h={12} style={{ marginTop: 10 }} />
        </SkelCard>
        <SkelTable cols={4} rows={6} />
      </div>
    </SkelSlot>
  );
}
