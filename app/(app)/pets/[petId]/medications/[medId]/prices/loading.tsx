import { Skel, SkelCard, SkelSlot, SkelSectionHead, SkelListRows } from "../../../../../_skeleton";

// Medication prices page slot: section head, a lookup form card, then a list
// of price results. Header-less; the pet layout keeps its own header + tabs.
export default function MedPricesLoading() {
  return (
    <SkelSlot maxWidth={860}>
      <SkelSectionHead titleW={200} subW={300} />
      <SkelCard style={{ padding: 18, marginBottom: 20 }}>
        <Skel w={140} h={14} />
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
            gap: 10,
          }}
        >
          <Skel h={38} r={8} />
          <Skel h={38} r={8} />
        </div>
        <Skel w={140} h={38} r={8} style={{ marginTop: 14 }} />
      </SkelCard>
      <SkelListRows rows={5} icon={40} trailing={80} line1="50%" line2="35%" />
    </SkelSlot>
  );
}
