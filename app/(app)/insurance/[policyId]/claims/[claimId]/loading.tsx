import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../../../_skeleton";

// Claim detail: breadcrumb, heading, then the edit form as a 2-column grid
// (status + notes span full width) with a save button, and a delete link.
export default function ClaimDetailLoading() {
  return (
    <SkelPage maxWidth={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={110} h={12} r={6} />
          <Skel w={70} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={150} subW={360} />

        <SkelCard style={{ padding: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <FormField full label={110} />
            <FormField label={90} />
            <FormField label={110} />
            <FormField label={100} />
            <FormField label={90} />
            <FormField label={110} />
            <FormField label={130} />
            <FormField label={120} />
            <FormField label={150} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Skel w={70} h={11} r={6} />
              <Skel h={70} r={8} style={{ marginTop: 8 }} />
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Skel w={120} h={34} r={6} />
            </div>
          </div>
        </SkelCard>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skel w={110} h={14} r={6} />
        </div>
      </div>
    </SkelPage>
  );
}

function FormField({ label, full }: { label: number; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <Skel w={label} h={11} r={6} />
      <Skel h={34} r={6} style={{ marginTop: 6 }} />
    </div>
  );
}
