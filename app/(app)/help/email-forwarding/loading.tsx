import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../../_skeleton";

// Email-forwarding help skeleton: breadcrumb, heading, the household inbox card,
// a grid of four provider "forwarding guide" cards (icon + title + step lines),
// then a privacy note bar.
export default function EmailForwardingHelpLoading() {
  return (
    <SkelPage maxWidth={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={70} h={12} r={6} />
          <Skel w={160} h={12} r={6} />
        </div>

        <SkelSectionHead titleW={260} subW={440} />

        {/* Household inbox card */}
        <SkelCard style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <Skel w={160} h={13} />
          <Skel h={40} r={8} />
          <Skel w="90%" h={12} />
          <Skel w="80%" h={12} />
        </SkelCard>

        {/* Provider guide cards */}
        <div style={{ display: "grid", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, g) => (
            <SkelCard
              key={g}
              style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--pw-border)",
                }}
              >
                <Skel w={32} h={32} r={8} style={{ flexShrink: 0 }} />
                <Skel w={200} h={14} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skel key={i} w={`${88 - ((i * 7) % 24)}%`} h={12} />
                ))}
              </div>
            </SkelCard>
          ))}
        </div>

        {/* Privacy note */}
        <SkelCard style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skel w="90%" h={12} />
          <Skel w="80%" h={12} />
        </SkelCard>
      </div>
    </SkelPage>
  );
}
