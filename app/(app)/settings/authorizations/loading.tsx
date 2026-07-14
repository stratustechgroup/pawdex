import { SkelPage, SkelCard, Skel } from "../../_skeleton";

// Authorizations skeleton: breadcrumb, header, then a stack of consent cards.
// Each card has an accent left border, an icon tile, title + status pill, a
// short line, and a trailing action button. maxWidth 820, 28px section gap.
export default function AuthorizationsLoading() {
  return (
    <SkelPage maxWidth={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Breadcrumb: Settings > Authorizations */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Skel w={54} h={12} r={6} />
          <Skel w={10} h={10} r={3} />
          <Skel w={100} h={12} r={6} />
        </div>

        <div>
          <Skel w={200} h={28} r={8} />
          <Skel w="80%" h={13} r={6} style={{ marginTop: 10 }} />
          <Skel w="55%" h={13} r={6} style={{ marginTop: 7 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkelCard
              key={i}
              style={{ padding: 20, borderLeft: "3px solid var(--pw-border)" }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Skel w={36} h={36} r={8} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Skel w={180} h={15} r={6} />
                    <Skel w={90} h={16} r={999} />
                  </div>
                  <Skel w="70%" h={13} r={6} style={{ marginTop: 8 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <Skel w={130} h={34} r={6} />
              </div>
            </SkelCard>
          ))}
        </div>
      </div>
    </SkelPage>
  );
}
