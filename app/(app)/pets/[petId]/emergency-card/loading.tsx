import { Skel, SkelCard, SkelSlot } from "../../../_skeleton";

// Emergency card page slot: heading and a grid of printable card previews.
// Header-less; the pet layout keeps its own header + tabs on screen.
export default function EmergencyCardLoading() {
  return (
    <SkelSlot maxWidth={860}>
      <Skel w={240} h={24} r={8} />
      <Skel w={340} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 360px))",
          gap: 16,
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <SkelCard key={i} style={{ height: 220 }}>
            <Skel w="55%" h={16} />
            <Skel w="40%" h={12} style={{ marginTop: 10 }} />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skel key={j} h={28} r={6} style={{ marginTop: 12 }} />
            ))}
          </SkelCard>
        ))}
      </div>
    </SkelSlot>
  );
}
