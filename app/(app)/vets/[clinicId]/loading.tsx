import { SkelPage, SkelCard, SkelGrid, Skel } from "../../_skeleton";

// Clinic detail skeleton: breadcrumb, large icon + title header with an edit
// action, a contact-fields card, then three list cards (vaccines, visits, meds).
export default function VetClinicLoading() {
  return (
    <SkelPage maxWidth={1100}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Skel w={90} h={12} r={6} />
        <Skel w={110} h={12} r={6} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <Skel w={52} h={52} r={12} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skel w={240} h={26} r={6} />
          <Skel w={200} h={13} r={6} style={{ marginTop: 8 }} />
        </div>
        <Skel w={104} h={32} r={8} style={{ flexShrink: 0 }} />
      </div>

      {/* Contact fields */}
      <SkelCard
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: 14,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skel w={54} h={10} r={5} />
            <Skel w="70%" h={13} r={6} />
          </div>
        ))}
      </SkelCard>

      {/* Three list cards */}
      <SkelGrid min={280} gap={18} style={{ marginTop: 28 }}>
        {["Vaccinations", "Visits & events", "Medications"].map((_, c) => (
          <SkelCard key={c} style={{ padding: 14 }}>
            <Skel w={140} h={13} r={6} style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--pw-surface-2)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skel w="60%" h={12} />
                    <Skel w="40%" h={10} style={{ marginTop: 6 }} />
                  </div>
                  <Skel w={62} h={11} r={5} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </SkelCard>
        ))}
      </SkelGrid>
    </SkelPage>
  );
}
