// What the atomic move carries and what it deliberately leaves behind. The
// split is the design: the pet's clinical record is the pet's, but the origin
// household's business, consent, and comms history stay put. One casualty of
// that rule is the AI index, which is the honest failure mode.

const TRAVELS = [
  "pets",
  "weight_log",
  "vaccinations",
  "medical_events",
  "medications",
  "medication_administrations",
  "lab_values",
  "qol_entries",
  "reminders (pet-scoped)",
  "documents (exclusive)",
  "document_pet_links",
  "vet_clinics (copied + deduped)",
];

const STAYS = [
  "insurance_policies",
  "cost_estimates",
  "claims",
  "claim_attachments",
  "medication_price_quotes",
  "outbound_emails",
  "pending_records_requests",
  "document_extractions",
  "documents (multi-pet)",
];

export function TransferLedger() {
  return (
    <div>
      <div className="arch-domains" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div className="arch-domain">
          <div className="arch-domain-head">
            <span className="arch-domain-name">Travels with the pet</span>
            <span className="arch-domain-count">{TRAVELS.length} tables</span>
          </div>
          <div className="arch-domain-tables">
            {TRAVELS.map((t) => (
              <span key={t} className="arch-tbl arch-tbl-key">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="arch-domain">
          <div className="arch-domain-head">
            <span className="arch-domain-name">Stays with the origin household</span>
            <span className="arch-domain-count">{STAYS.length} tables</span>
          </div>
          <div className="arch-domain-tables">
            {STAYS.map((t) => (
              <span key={t} className="arch-tbl">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid var(--pw-status-overdue-dot)",
          background: "var(--pw-status-overdue-bg)",
          borderRadius: "var(--pw-r-md)",
          padding: "14px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            font: "600 13px var(--font-inter), system-ui, sans-serif",
            color: "var(--pw-status-overdue-fg)",
          }}
        >
          The casualty: the AI index stays behind
        </p>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px/1.6 var(--font-inter), system-ui, sans-serif",
            color: "var(--pw-text-secondary)",
          }}
        >
          <code
            style={{
              font: "400 12.5px var(--font-jetbrains-mono), ui-monospace, monospace",
              color: "var(--pw-text)",
            }}
          >
            extraction_chunks
          </code>{" "}
          is scoped to the origin household, so it does not move. A transferred pet arrives with a complete, human-approved
          record, but the AI Q&amp;A under-answers about that pet until the documents are re-embedded into the new household.
          Known, bounded, and on the roadmap: re-index on transfer accept.
        </p>
      </div>
    </div>
  );
}
