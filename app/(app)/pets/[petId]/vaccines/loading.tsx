import { SkelSlot, SkelSectionHead, SkelTable } from "../../../_skeleton";

// Vaccines subtab page slot: heading + a couple of summary cards + the
// vaccine table (Vaccine / Given / Expires / Status). Header-less: the pet
// layout keeps its own header, stat strip, and tabs on screen.
export default function VaccinesLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkelSectionHead titleW={150} subW={260} action />
        <SkelTable cols={4} rows={6} />
      </div>
    </SkelSlot>
  );
}
