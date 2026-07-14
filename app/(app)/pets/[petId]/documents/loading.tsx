import { SkelSlot, SkelSectionHead, SkelListRows } from "../../../_skeleton";

// Documents subtab page slot: heading + a list of document rows (thumb, name +
// meta, open action). Header-less by design.
export default function PetDocumentsLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkelSectionHead titleW={150} subW={260} action />
        <SkelListRows rows={6} icon={32} iconR={6} trailing={64} line1="55%" line2="30%" />
      </div>
    </SkelSlot>
  );
}
