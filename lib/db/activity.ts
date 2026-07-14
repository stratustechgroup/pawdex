import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * A single household event for the dashboard activity feed. Every item carries
 * an actor (who did it, best-effort), a deep link to the thing it concerns, and
 * an icon/kind the renderer maps to tone. The feed is a quiet timeline, not a
 * notification center.
 */
export type ActivityItem = {
  id: string;
  kind:
    | "document_added"
    | "document_reviewed"
    | "member_joined"
    | "pet_transferred";
  title: string;
  detail: string | null;
  petName: string | null;
  actorName: string | null;
  at: string; // ISO timestamp
  href: string | null;
  icon: string;
};

const DOC_TYPE_LABEL: Record<string, string> = {
  vaccine_certificate: "Vaccine certificate",
  vet_visit_summary: "Visit summary",
  lab_result: "Lab result",
  invoice: "Invoice",
  prescription: "Prescription",
  imaging: "Imaging",
  adoption_record: "Adoption record",
  microchip_record: "Microchip record",
  other: "Document",
  unknown: "Document",
};

/**
 * Build the household activity timeline from real tables, deduplicated by
 * canonical source so one event never appears twice:
 *   - `documents` is canonical for the document lifecycle. A document appears
 *     once as "added" (uploaded_at) and, if confirmed, once as "reviewed and
 *     saved" (confirmed_at). We deliberately do NOT also pull the matching
 *     `commit_extraction` audit row, because in this app confirming a document
 *     IS the record-commit moment, so that would double the same event.
 *   - `audit_log` is canonical only for events with no document row: a member
 *     joining the household.
 *   - `animal_transfers` supplies completed ownership handoffs.
 */
export async function listRecentActivity(
  householdId: string,
  limit = 8,
): Promise<ActivityItem[]> {
  const supabase = await createClient();

  const [docsRes, auditRes, transfersRes, petsRes] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, original_filename, doc_type, processing_status, uploaded_at, confirmed_at, created_by, pet_id",
      )
      .eq("household_id", householdId)
      .order("uploaded_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("audit_log")
      .select("id, action, actor_id, entity_id, created_at, diff")
      .eq("household_id", householdId)
      .in("action", ["accept_invitation", "invite_member"])
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("animal_transfers")
      .select("id, animal_id, accepted_at, accepted_by, created_by")
      .or(
        `from_household_id.eq.${householdId},accepted_household_id.eq.${householdId}`,
      )
      .not("accepted_at", "is", null)
      .order("accepted_at", { ascending: false })
      .limit(limit),
    supabase
      .from("pets")
      .select("id, name, animal_id")
      .eq("household_id", householdId)
      .is("deleted_at", null),
  ]);

  const pets = petsRes.data ?? [];
  const petNameById = new Map<string, string>();
  const petIdByAnimalId = new Map<string, string>();
  for (const p of pets) {
    petNameById.set(p.id, p.name);
    if (p.animal_id) petIdByAnimalId.set(p.animal_id, p.id);
  }

  const items: ActivityItem[] = [];

  for (const d of docsRes.data ?? []) {
    // A document tied to a soft-deleted pet is hidden with the pet.
    if (d.pet_id && !petNameById.has(d.pet_id)) continue;
    const petName = d.pet_id ? (petNameById.get(d.pet_id) ?? null) : null;
    const label = DOC_TYPE_LABEL[d.doc_type] ?? "Document";
    const filename = d.original_filename ?? "Untitled document";
    const href = d.pet_id
      ? `/pets/${d.pet_id}/documents/${d.id}`
      : "/inbox";
    if (
      (d.processing_status === "confirmed" || d.processing_status === "extracted") &&
      d.confirmed_at
    ) {
      items.push({
        id: `doc-review-${d.id}`,
        kind: "document_reviewed",
        title: `${label} reviewed and saved`,
        detail: filename,
        petName,
        actorName: null,
        at: d.confirmed_at,
        href,
        icon: "fileCheck",
      });
    }
    items.push({
      id: `doc-add-${d.id}`,
      kind: "document_added",
      title: `${label} added`,
      detail: filename,
      petName,
      actorName: null,
      at: d.uploaded_at,
      href,
      icon: "fileText",
    });
  }

  for (const a of auditRes.data ?? []) {
    const diff = (a.diff ?? {}) as Record<string, unknown>;
    const who =
      (typeof diff.email === "string" && diff.email) ||
      (typeof diff.display_name === "string" && diff.display_name) ||
      null;
    items.push({
      id: `audit-${a.id}`,
      kind: "member_joined",
      title:
        a.action === "accept_invitation"
          ? "A member joined the household"
          : "A member was invited",
      detail: who,
      petName: null,
      actorName: null,
      at: a.created_at,
      href: "/settings/household",
      icon: "user",
    });
  }

  for (const t of transfersRes.data ?? []) {
    const petId = petIdByAnimalId.get(t.animal_id) ?? null;
    items.push({
      id: `transfer-${t.id}`,
      kind: "pet_transferred",
      title: "Ownership transfer completed",
      detail: petId ? (petNameById.get(petId) ?? null) : null,
      petName: petId ? (petNameById.get(petId) ?? null) : null,
      actorName: null,
      at: t.accepted_at as string,
      href: petId ? `/pets/${petId}` : null,
      icon: "refresh",
    });
  }

  // Resolve actor display names in one batch for document authors.
  const actorIds = new Set<string>();
  for (const d of docsRes.data ?? []) if (d.created_by) actorIds.add(d.created_by);
  for (const a of auditRes.data ?? []) if (a.actor_id) actorIds.add(a.actor_id);
  if (actorIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(actorIds));
    const nameById = new Map<string, string | null>();
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
    const docActorById = new Map<string, string | null>();
    for (const d of docsRes.data ?? []) {
      if (d.created_by) docActorById.set(d.id, nameById.get(d.created_by) ?? null);
    }
    for (const it of items) {
      if (it.kind === "document_added" || it.kind === "document_reviewed") {
        const docId = it.id.replace(/^doc-(add|review)-/, "");
        it.actorName = docActorById.get(docId) ?? null;
      }
    }
    for (const a of auditRes.data ?? []) {
      const actor = a.actor_id ? (nameById.get(a.actor_id) ?? null) : null;
      const target = items.find((it) => it.id === `audit-${a.id}`);
      if (target) target.actorName = actor;
    }
  }

  items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  return items.slice(0, limit);
}
