import { SkelPage, SkelCard, SkelSectionHead, Skel } from "../_skeleton";

// Reminders skeleton: heading with a "run cron" action, then grouped sections
// (Scheduled / Sent) each a card of reminder rows (status chip + two text lines).
export default function RemindersLoading() {
  return (
    <SkelPage maxWidth={1100}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <SkelSectionHead titleW={150} subW={280} style={{ marginBottom: 0 }} />
          <Skel w={128} h={32} r={8} />
        </div>

        {[0, 1].map((s) => (
          <section key={s}>
            <Skel w={110} h={14} r={6} style={{ marginBottom: 10 }} />
            <SkelCard style={{ padding: "4px 0" }}>
              {Array.from({ length: s === 0 ? 5 : 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--pw-border)",
                  }}
                >
                  <Skel w={28} h={28} r={8} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Skel w="40%" h={13} />
                    <Skel w="55%" h={11} style={{ marginTop: 7 }} />
                  </div>
                </div>
              ))}
            </SkelCard>
          </section>
        ))}
      </div>
    </SkelPage>
  );
}
