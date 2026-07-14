import { Skel, SkelCard, SkelSlot } from "../../../_skeleton";

// Upload page slot: heading, a dashed dropzone, and a short form. Header-less;
// the pet layout keeps its own header + tabs on screen.
export default function UploadLoading() {
  return (
    <SkelSlot maxWidth={720}>
      <Skel w={220} h={24} r={8} />
      <Skel w={320} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <div
        style={{
          border: "1px dashed var(--pw-border-strong)",
          borderRadius: 14,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Skel w={44} h={44} r={22} />
        <Skel w={200} h={13} />
        <Skel w={140} h={11} />
      </div>
      <SkelCard style={{ marginTop: 16 }}>
        <Skel w={120} h={12} />
        <Skel h={38} r={8} style={{ marginTop: 8 }} />
        <Skel w={140} h={38} r={8} style={{ marginTop: 20 }} />
      </SkelCard>
    </SkelSlot>
  );
}
