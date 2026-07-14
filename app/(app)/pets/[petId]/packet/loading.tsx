import { Skel, SkelCard, SkelSlot, SkelTable } from "../../../_skeleton";

// Compliance packet page slot: heading, a two-up detail grid, a records table,
// and a footer detail grid. Header-less; the pet layout keeps its own header.
export default function PacketLoading() {
  return (
    <SkelSlot maxWidth={820}>
      <Skel w={280} h={26} r={8} />
      <Skel w={360} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <SkelCard key={i} style={{ height: 130 }}>
            <Skel w="50%" h={14} />
            {Array.from({ length: 2 }).map((_, j) => (
              <Skel key={j} h={16} r={6} style={{ marginTop: 12 }} />
            ))}
          </SkelCard>
        ))}
      </div>
      <SkelTable cols={4} rows={5} />
    </SkelSlot>
  );
}
