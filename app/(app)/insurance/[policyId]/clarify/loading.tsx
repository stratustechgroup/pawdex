import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../../_skeleton";

// Ask-the-insurer: breadcrumb, heading, then the draft form card (question +
// optional policy language textareas and a draft button).
export default function ClarifyLoading() {
  return (
    <SkelPage maxWidth={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={90} h={12} r={6} />
          <Skel w={100} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={300} subW={380} />

        <SkelCard style={{ padding: 20 }}>
          <Skel w={200} h={11} r={6} />
          <Skel h={68} r={8} style={{ marginTop: 8 }} />
          <Skel w={220} h={11} r={6} style={{ marginTop: 16 }} />
          <Skel h={68} r={8} style={{ marginTop: 8 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <Skel w={116} h={34} r={6} />
          </div>
        </SkelCard>
      </div>
    </SkelPage>
  );
}
