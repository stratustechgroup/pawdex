/**
 * Pure transfer logic — NO I/O, NO database, NO side effects.
 *
 * Split out of transfers.ts (which imports server-only + the Supabase service
 * client) so this can be unit-tested with synthetic fixtures and no env. The
 * exclusivity rule here mirrors, exactly, the document loop in
 * transfer_animal() (migration 0026). Keep the two in lockstep.
 */

/**
 * Association shape for one document relative to a pet transfer: its direct
 * `documents.pet_id` (if any) plus every pet it is linked to via
 * document_pet_links.
 */
export type DocumentAssociation = {
  documentId: string;
  directPetId: string | null;
  linkedPetIds: string[];
};

/**
 * Decide which documents move with a transferred pet. A document moves ONLY if
 * it is associated exclusively with the transferred pet — i.e. every one of its
 * associations (the direct pet_id and all link rows) points at that pet and no
 * other. Multi-pet documents stay with the origin household.
 */
export function documentsToMove(
  docs: DocumentAssociation[],
  transferPetId: string,
): string[] {
  return docs
    .filter((doc) => {
      const associated = new Set(doc.linkedPetIds);
      if (doc.directPetId) associated.add(doc.directPetId);
      // Must touch the transferred pet…
      if (!associated.has(transferPetId)) return false;
      // …and no other pet.
      for (const petId of associated) {
        if (petId !== transferPetId) return false;
      }
      return true;
    })
    .map((doc) => doc.documentId);
}
