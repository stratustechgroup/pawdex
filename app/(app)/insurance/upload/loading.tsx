import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../_skeleton";

// Upload policy: breadcrumb (2 crumbs), heading, and the upload form card with
// a pet select, a dashed file dropzone, hint text, and a submit button.
export default function UploadPolicyLoading() {
  return (
    <SkelPage maxWidth={720}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={64} h={12} r={6} />
          <Skel w={60} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={280} subW={420} />

        <SkelCard style={{ padding: 20 }}>
          <Skel w={110} h={11} r={6} />
          <Skel h={34} r={6} style={{ marginTop: 6 }} />

          <Skel w={130} h={11} r={6} style={{ marginTop: 16 }} />
          <div
            style={{
              marginTop: 6,
              border: "1px dashed var(--pw-border-strong)",
              borderRadius: 6,
              background: "var(--pw-surface-muted)",
              padding: 10,
            }}
          >
            <Skel w="60%" h={18} r={6} />
          </div>
          <Skel w="90%" h={11} r={6} style={{ marginTop: 8 }} />

          <Skel w={150} h={38} r={8} style={{ marginTop: 18 }} />
        </SkelCard>
      </div>
    </SkelPage>
  );
}
