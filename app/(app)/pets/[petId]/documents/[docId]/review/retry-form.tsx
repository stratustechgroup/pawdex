import { revalidatePath } from "next/cache";

import { reextractDocument } from "@/app/(app)/pets/[petId]/upload/actions";

export function RetryExtractionForm({
  documentId,
  petId,
}: {
  documentId: string;
  petId: string;
}) {
  async function action() {
    "use server";
    await reextractDocument(documentId);
    revalidatePath(`/pets/${petId}/documents/${documentId}/review`);
  }

  return (
    <form action={action} style={{ display: "inline-flex" }}>
      <button
        type="submit"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 36,
          padding: "0 14px",
          borderRadius: 6,
          background: "var(--pw-accent)",
          color: "#fff",
          border: "1px solid var(--pw-accent)",
          font: "500 13px var(--font-inter)",
          cursor: "pointer",
        }}
      >
        Try again with premium model
      </button>
    </form>
  );
}
