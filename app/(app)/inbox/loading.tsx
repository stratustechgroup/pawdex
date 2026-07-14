import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../_skeleton";

// Inbox skeleton: title + header action ("Set up auto-forwarding"), plus a list
// of document rows.
export default function InboxLoading() {
  return (
    <SkelPage maxWidth={900}>
      <SkelSectionHead titleW={100} subW={280} action style={{ marginBottom: 24 }} />
      <SkelCard style={{ padding: 8 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
            }}
          >
            <Skel w={32} h={40} r={6} />
            <div style={{ flex: 1 }}>
              <Skel w="55%" h={13} />
              <Skel w="30%" h={11} style={{ marginTop: 7 }} />
            </div>
            <Skel w={64} h={26} r={8} />
          </div>
        ))}
      </SkelCard>
    </SkelPage>
  );
}
