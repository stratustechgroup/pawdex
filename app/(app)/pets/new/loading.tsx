import { Skel, SkelCard, SkelPage, SkelFormRows } from "../../_skeleton";

// New pet page. This lives under the pets/ segment, so it needs its own loading
// state to avoid inheriting the pet-shell skeleton from pets/loading.tsx. It is
// a standalone (app) page, so it uses the full-page container. Mirrors the
// centered "Add a pet" form.
export default function NewPetLoading() {
  return (
    <SkelPage maxWidth={920}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Skel w={200} h={26} r={8} />
        <Skel w={300} h={13} r={6} style={{ marginTop: 10, marginBottom: 24 }} />
        <SkelCard style={{ padding: 20 }}>
          <SkelFormRows rows={6} />
          <Skel w={150} h={40} r={8} style={{ marginTop: 24 }} />
        </SkelCard>
      </div>
    </SkelPage>
  );
}
