import { Skel, SkelCard, SkelSlot } from "../../../_skeleton";

// Breed risk page slot: heading and an explainer card. Header-less; the pet
// layout keeps its own header + tabs on screen.
export default function BreedRiskLoading() {
  return (
    <SkelSlot maxWidth={640}>
      <SkelCard style={{ padding: 20 }}>
        <Skel w={200} h={22} r={8} />
        <Skel w="80%" h={13} r={6} style={{ marginTop: 12 }} />
        <Skel w="60%" h={13} r={6} style={{ marginTop: 8 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skel key={i} h={40} r={8} style={{ marginTop: 16 }} />
        ))}
      </SkelCard>
    </SkelSlot>
  );
}
