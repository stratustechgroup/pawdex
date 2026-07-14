import { Skel, SkelCard, SkelSlot, SkelTable } from "../../../../_skeleton";

// APHIS 7001 form page slot: heading, a table of entries, and a two-up detail
// grid. Header-less; the pet layout keeps its own header + tabs on screen.
export default function Aphis7001Loading() {
  return (
    <SkelSlot maxWidth={820}>
      <Skel w={260} h={26} r={8} />
      <Skel w={360} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
      <SkelTable cols={4} rows={5} />
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <SkelCard key={i} style={{ height: 120 }}>
            <Skel w="50%" h={13} />
            <Skel h={16} r={6} style={{ marginTop: 12 }} />
            <Skel w="70%" h={16} r={6} style={{ marginTop: 10 }} />
          </SkelCard>
        ))}
      </div>
    </SkelSlot>
  );
}
