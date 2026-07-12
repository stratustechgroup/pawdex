import { SkelPage, SkelCard, Skel } from "../_skeleton";

// Inbox skeleton: title plus a list of document rows.
export default function InboxLoading() {
  return (
    <SkelPage maxWidth={1000}>
      <Skel w={160} h={26} r={8} />
      <Skel w={280} h={14} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
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
