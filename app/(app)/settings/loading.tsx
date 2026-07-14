import {
  SkelPage,
  SkelCard,
  SkelSectionHead,
  SkelGrid,
  SkelFormRows,
  Skel,
} from "../_skeleton";

// Settings hub skeleton: page header, then Account / Reminders / Forward-by-email
// / Authorizations cards, then a 3-up links grid. Matches the real page's
// maxWidth 760 and 32px section gap.
export default function SettingsLoading() {
  return (
    <SkelPage maxWidth={760}>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          <Skel w={130} h={28} r={8} />
          <Skel w={220} h={14} r={6} style={{ marginTop: 10 }} />
        </div>

        {/* Account card: heading + Manage action, then a small detail list. */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={100} subW={180} action />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 24 }}>
                <Skel w={90} h={12} r={6} />
                <Skel w="45%" h={12} r={6} />
              </div>
            ))}
          </div>
        </SkelCard>

        {/* Reminders card: heading + a stack of preference rows. */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={120} subW={280} />
          <SkelFormRows rows={4} />
        </SkelCard>

        {/* Forward documents by email: heading + address chip + note. */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={220} subW={300} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skel h={44} r={8} />
            <Skel w="80%" h={12} r={6} />
          </div>
        </SkelCard>

        {/* Authorizations card: heading + Manage action + info banner. */}
        <SkelCard style={{ padding: 20 }}>
          <SkelSectionHead titleW={150} subW={240} action />
          <Skel h={56} r={8} />
        </SkelCard>

        {/* Bottom 3-up quick-links grid (auto-fit minmax 220px). */}
        <SkelGrid min={220} gap={12}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkelCard key={i} style={{ padding: 16, display: "flex", gap: 12 }}>
              <Skel w={32} h={32} r={8} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <Skel w="60%" h={13} />
                <Skel w="90%" h={11} style={{ marginTop: 6 }} />
              </div>
            </SkelCard>
          ))}
        </SkelGrid>
      </div>
    </SkelPage>
  );
}
