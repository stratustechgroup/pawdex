import { Skel, SkelCard, SkelSlot, SkelSectionHead, SkelTable } from "../../../_skeleton";

// Weight subtab page slot: heading, a trend-chart card, then the readings
// table (Date / Weight / Notes). Header-less by design.
export default function WeightLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkelSectionHead titleW={140} subW={240} action />
        <SkelCard style={{ height: 220 }}>
          <Skel w={120} h={13} />
          <Skel h={150} r={10} style={{ marginTop: 16 }} />
        </SkelCard>
        <SkelTable cols={3} rows={6} />
      </div>
    </SkelSlot>
  );
}
