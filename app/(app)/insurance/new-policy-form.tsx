"use client";

export function NewPolicyForm({
  pets,
  action,
}: {
  pets: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(2, 1fr)",
      }}
    >
      <Field label="Insurer" name="insurer_name" required />
      <Field label="Plan name" name="plan_name" />
      <Field label="Policy number" name="policy_number" />
      <SelectField label="Pet" name="pet_id">
        <option value="household">Whole household</option>
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <Field label="Premium per month ($)" name="premium_monthly" type="number" step="0.01" />
      <Field label="Annual deductible ($)" name="deductible_annual" type="number" step="0.01" />
      <Field label="Annual max ($)" name="annual_max" type="number" step="0.01" />
      <Field label="Reimbursement (%)" name="reimbursement_rate" type="number" step="1" min="0" max="100" />
      <Field label="Effective on" name="effective_on" type="date" />
      <Field label="Renews on" name="renews_on" type="date" />
      <div style={{ gridColumn: "1 / -1" }}>
        <Label>Exclusions (one per line)</Label>
        <textarea
          name="exclusions"
          rows={3}
          placeholder={"e.g.\nHip dysplasia\nDental cleanings\nBehavioral training"}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
            outline: "none",
            resize: "vertical",
          }}
        />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <Label>Notes</Label>
        <textarea
          name="notes"
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 13px var(--font-inter)",
            outline: "none",
            resize: "vertical",
          }}
        />
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 4,
        }}
      >
        <button
          type="submit"
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 6,
            border: "1px solid var(--pw-accent)",
            background: "var(--pw-accent)",
            color: "var(--pw-accent-fg)",
            font: "500 12.5px var(--font-inter)",
            cursor: "pointer",
          }}
        >
          Save policy
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  min,
  max,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Label>{label}</Label>
      <input
        type={type}
        name={name}
        step={step}
        min={min}
        max={max}
        required={required}
        style={{
          width: "100%",
          height: 34,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "400 13px var(--font-inter)",
          outline: "none",
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Label>{label}</Label>
      <select
        name={name}
        style={{
          width: "100%",
          height: 34,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid var(--pw-border-strong)",
          background: "var(--pw-surface)",
          color: "var(--pw-text)",
          font: "400 13px var(--font-inter)",
          outline: "none",
        }}
      >
        {children}
      </select>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
