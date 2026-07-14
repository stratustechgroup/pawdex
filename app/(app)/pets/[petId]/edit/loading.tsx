import { Skel, SkelCard, SkelSlot, SkelFormRows } from "../../../_skeleton";

// Edit pet page slot: a heading and a sectioned edit form. Renders inside the
// pet layout body, so it is header-less (the pet header + tabs persist).
export default function EditPetLoading() {
  return (
    <SkelSlot maxWidth={720}>
      <Skel w={200} h={24} r={8} />
      <Skel w={300} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <SkelCard style={{ padding: 20 }}>
        <SkelFormRows rows={6} />
        <Skel w={140} h={38} r={8} style={{ marginTop: 24 }} />
      </SkelCard>
    </SkelSlot>
  );
}
