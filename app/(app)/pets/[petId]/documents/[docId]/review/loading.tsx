import { Skel, SkelCard, SkelSlot, SkelFormRows } from "../../../../../_skeleton";

// Document review page slot: heading and a review form card. Header-less; the
// pet layout keeps its own header + tabs on screen.
export default function DocumentReviewLoading() {
  return (
    <SkelSlot maxWidth={720}>
      <Skel w={220} h={24} r={8} />
      <Skel w={320} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <SkelCard style={{ padding: 20 }}>
        <SkelFormRows rows={5} />
        <Skel w={160} h={38} r={8} style={{ marginTop: 24 }} />
      </SkelCard>
    </SkelSlot>
  );
}
