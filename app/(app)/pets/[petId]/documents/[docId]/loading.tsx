import { Skel, SkelCard, SkelSlot } from "../../../../_skeleton";

// Single document page slot: a title row, then a large preview beside a meta
// sidebar that stacks under 900px. Header-less; the pet layout persists.
export default function DocumentLoading() {
  return (
    <SkelSlot>
      <Skel w={260} h={22} r={8} />
      <Skel w={180} h={12} r={6} style={{ marginTop: 8, marginBottom: 20 }} />
      <div className="pet-doc-skel-grid">
        <SkelCard style={{ minHeight: 460, padding: 0 }}>
          <Skel h={460} r={12} />
        </SkelCard>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SkelCard>
            <Skel w={120} h={14} />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skel key={i} h={28} r={6} style={{ marginTop: 12 }} />
            ))}
          </SkelCard>
          <SkelCard>
            <Skel w={100} h={14} />
            <Skel h={36} r={8} style={{ marginTop: 12 }} />
          </SkelCard>
        </aside>
      </div>

      <style>{`
        .pet-doc-skel-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 900px) {
          .pet-doc-skel-grid {
            grid-template-columns: minmax(0, 1fr) 300px;
            align-items: start;
          }
        }
      `}</style>
    </SkelSlot>
  );
}
