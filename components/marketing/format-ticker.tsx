// A quiet flex: the actual document formats the pipeline handles today.
// Doubled track for a seamless CSS marquee; pauses on hover.
const FORMATS = [
  "Cornerstone exports",
  "AVImark printouts",
  "ezyVet summaries",
  "eVetPractice invoices",
  "IDEXX lab reports",
  "Form 51 rabies certificates",
  "EU pet passports",
  "iPhone photos (yes, HEIC)",
  "forwarded clinic emails",
  "boarding vaccine letters",
  "discharge summaries",
  "insurance policies",
];

export function FormatTicker() {
  const row = (key: string, hidden: boolean) => (
    <div key={key} aria-hidden={hidden || undefined} style={{ display: "flex" }}>
      {FORMATS.map((f) => (
        <span key={f} className="mk-ticker-item">
          {f}
        </span>
      ))}
    </div>
  );
  return (
    <div
      className="mk-ticker"
      role="marquee"
      aria-label="Document formats Pawdex reads"
    >
      <div className="mk-ticker-track">
        {row("a", false)}
        {row("b", true)}
      </div>
    </div>
  );
}
