// The 45 tables grouped by domain rather than listed alphabetically. Anchor
// tables (the ones the rest of the schema hangs off) are highlighted.

type Domain = { name: string; tables: string[]; keys?: string[] };

const DOMAINS: Domain[] = [
  {
    name: "Identity & ownership",
    keys: ["households", "animals", "custodianships"],
    tables: [
      "households",
      "household_members",
      "household_invitations",
      "profiles",
      "animals",
      "custodianships",
      "litters",
      "animal_transfers",
    ],
  },
  {
    name: "Clinical record",
    keys: ["pets"],
    tables: [
      "pets",
      "vaccinations",
      "medical_events",
      "medications",
      "medication_administrations",
      "lab_values",
      "weight_log",
      "qol_entries",
      "reminders",
      "reminder_preferences",
    ],
  },
  {
    name: "Documents & AI",
    keys: ["extraction_chunks"],
    tables: [
      "documents",
      "document_extractions",
      "document_pet_links",
      "extraction_feedback",
      "extraction_chunks",
      "invoice_items",
    ],
  },
  {
    name: "Insurance & cost",
    tables: [
      "insurance_policies",
      "claims",
      "claim_attachments",
      "cost_estimates",
      "medication_price_quotes",
    ],
  },
  {
    name: "Vets, comms & sharing",
    tables: [
      "vet_clinics",
      "outbound_emails",
      "pending_records_requests",
      "household_inbound_addresses",
      "share_links",
    ],
  },
  {
    name: "Consent & research",
    keys: ["authorizations"],
    tables: ["authorizations", "research_consents", "dataset_releases", "dataset_release_items"],
  },
  {
    name: "Lifecycle & audit",
    tables: ["audit_log", "deletion_log", "account_deletions"],
  },
  {
    name: "Billing",
    tables: ["billing_customers", "subscriptions"],
  },
  {
    name: "Growth",
    tables: ["waitlist_signups", "contact_messages"],
  },
];

export function DataDomains() {
  return (
    <div className="arch-domains">
      {DOMAINS.map((d) => (
        <div key={d.name} className="arch-domain">
          <div className="arch-domain-head">
            <span className="arch-domain-name">{d.name}</span>
            <span className="arch-domain-count">{d.tables.length}</span>
          </div>
          <div className="arch-domain-tables">
            {d.tables.map((t) => (
              <span key={t} className={d.keys?.includes(t) ? "arch-tbl arch-tbl-key" : "arch-tbl"}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
