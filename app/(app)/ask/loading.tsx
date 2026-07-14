import { SkelPage, SkelSectionHead, Skel } from "../_skeleton";

// Ask skeleton: heading, then the question composer (textarea + submit), then
// the "Try asking" example box. maxWidth 860, 24px section gap.
export default function AskLoading() {
  return (
    <SkelPage maxWidth={860}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SkelSectionHead titleW={60} subW={320} />

        {/* Question composer: a textarea-sized field with a trailing Ask button. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skel h={88} r={8} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Skel w={92} h={36} r={6} />
          </div>
        </div>

        {/* Try asking box: label + a few example lines. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 14,
            background: "var(--pw-surface-muted)",
            borderRadius: 8,
            border: "1px solid var(--pw-border)",
          }}
        >
          <Skel w={70} h={11} r={5} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["70%", "55%", "80%", "60%"].map((w, i) => (
              <Skel key={i} w={w} h={13} r={6} />
            ))}
          </div>
        </div>
      </div>
    </SkelPage>
  );
}
