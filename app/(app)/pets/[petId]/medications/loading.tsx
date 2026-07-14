import { Skel, SkelSlot, SkelSectionHead, SkelTable } from "../../../_skeleton";

// Medications subtab page slot: heading, an active-meds section, and a table
// (Name / Dose / Frequency / Started / Status). Header-less by design.
export default function MedicationsLoading() {
  return (
    <SkelSlot>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SkelSectionHead titleW={160} subW={260} action />
        <section>
          <Skel w={120} h={13} style={{ marginBottom: 12 }} />
          <SkelTable cols={5} rows={4} />
        </section>
        <section>
          <Skel w={100} h={13} style={{ marginBottom: 12 }} />
          <SkelTable cols={5} rows={3} />
        </section>
      </div>
    </SkelSlot>
  );
}
