"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { BreedCombobox } from "@/components/pawdex/breed-combobox";
import {
  petFormSchema,
  petFormToPayload,
  type PetFormValues,
} from "@/lib/schemas/pet";

import { archivePet, createPet, updatePet } from "./actions";

const DEFAULTS: PetFormValues = {
  name: "",
  species: "dog",
  breed: "",
  sex: "unknown",
  altered: "",
  date_of_birth: "",
  dob_is_estimated: false,
  acquired_on: "",
  color: "",
  markings: "",
  microchip_number: "",
  microchip_registry: "",
  microchip_implanted_on: "",
  weight_value: "",
  weight_unit: "lbs",
  allergies: "",
  notes: "",
};

export type PetFormMode = "create" | "edit";

export function PetForm({
  mode = "create",
  petId,
  initial,
}: {
  mode?: PetFormMode;
  petId?: string;
  initial?: PetFormValues;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isArchiving, startArchiveTransition] = useTransition();

  const form = useForm<PetFormValues>({
    resolver: zodResolver(petFormSchema),
    defaultValues: initial ?? DEFAULTS,
  });

  const speciesValue = form.watch("species");

  function onSubmit(values: PetFormValues) {
    const payload = petFormToPayload(values);
    startTransition(async () => {
      if (mode === "edit") {
        if (!petId) {
          toast.error("Missing pet id for edit");
          return;
        }
        const result = await updatePet(petId, payload);
        if (result && !result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Pet updated");
      } else {
        const result = await createPet(payload);
        if (result && !result.ok) {
          toast.error(result.error);
        }
      }
    });
  }

  function onArchive() {
    if (!petId) return;
    const confirmed = window.confirm(
      "Archive this pet? They'll be hidden from the dashboard. You can restore them from the database if needed.",
    );
    if (!confirmed) return;
    startArchiveTransition(async () => {
      const result = await archivePet(petId);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pet archived");
    });
  }

  const submitLabel =
    mode === "edit"
      ? isPending
        ? "Saving…"
        : "Save changes"
      : isPending
        ? "Saving…"
        : "Add pet";

  const formDisabled = isPending || isArchiving;
  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* ── Identity ───────────────────────────────────────────── */}
      <Section
        title="Identity"
        helper="The basics. You can fill the rest in later."
      >
        <Row>
          <Field label="Name" required error={errors.name?.message}>
            <input
              {...form.register("name")}
              placeholder="Bailey"
              style={inputStyle}
              autoFocus
            />
          </Field>
          <Field label="Species" required>
            <select
              {...form.register("species")}
              style={inputStyle}
            >
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field
            label="Breed"
            hint={
              speciesValue === "other"
                ? "Free text — pick whatever describes your pet."
                : "Start typing to search the catalog."
            }
          >
            <BreedCombobox
              name="breed"
              defaultValue={form.getValues("breed")}
              onChange={(v) => form.setValue("breed", v, { shouldDirty: true })}
              species={speciesValue}
              placeholder={
                speciesValue === "cat"
                  ? "Domestic Shorthair…"
                  : speciesValue === "dog"
                    ? "Golden Retriever…"
                    : "Free text"
              }
              key={speciesValue}
            />
          </Field>
          <Field label="Sex">
            <select {...form.register("sex")} style={inputStyle}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Spayed / Neutered">
            <select {...form.register("altered")} style={inputStyle}>
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <div /> {/* spacer to keep the 2-col grid balanced */}
        </Row>
      </Section>

      {/* ── Birth & history ────────────────────────────────────── */}
      <Section
        title="Birth & history"
        helper="Helps reminders + breed-aware screening land at the right age."
      >
        <Row>
          <Field label="Date of birth">
            <input
              type="date"
              {...form.register("date_of_birth")}
              style={inputStyle}
            />
          </Field>
          <Field label="Acquired on" hint="Adoption / litter / purchase date.">
            <input
              type="date"
              {...form.register("acquired_on")}
              style={inputStyle}
            />
          </Field>
        </Row>
        <CheckboxRow
          label="The date of birth is an estimate"
          register={form.register("dob_is_estimated")}
          checked={form.watch("dob_is_estimated")}
        />
      </Section>

      {/* ── Physical ────────────────────────────────────────────── */}
      <Section
        title="Physical"
        helper="Weight + markings — used for ID cards and dose calculations."
      >
        <Row>
          <Field label="Current weight">
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                {...form.register("weight_value")}
                placeholder="0.0"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                {...form.register("weight_unit")}
                style={{ ...inputStyle, width: 84 }}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </Field>
          <Field label="Color">
            <input
              {...form.register("color")}
              placeholder="Golden, black & white…"
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Distinguishing markings" full>
            <input
              {...form.register("markings")}
              placeholder="White chest patch, brown ear"
              style={inputStyle}
            />
          </Field>
        </Row>
      </Section>

      {/* ── Microchip ────────────────────────────────────────────── */}
      <Section
        title="Microchip"
        helper="ISO 11784/11785 standard is 15 digits. The implant date matters for international travel."
      >
        <Row>
          <Field label="Microchip number">
            <input
              {...form.register("microchip_number")}
              placeholder="985112004012345"
              style={{ ...inputStyle, fontFamily: "var(--font-jetbrains-mono)" }}
            />
          </Field>
          <Field label="Registry">
            <input
              {...form.register("microchip_registry")}
              placeholder="HomeAgain, AKC Reunite…"
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field
            label="Microchip implanted on"
            hint="EU travel requires rabies vax to be given after this date."
          >
            <input
              type="date"
              {...form.register("microchip_implanted_on")}
              style={inputStyle}
            />
          </Field>
          <div />
        </Row>
      </Section>

      {/* ── Medical ──────────────────────────────────────────────── */}
      <Section
        title="Medical"
        helper="Short summary now — full medical history populates from documents later."
      >
        <Row>
          <Field
            label="Known allergies"
            hint="Short — appears on the emergency card."
            full
          >
            <input
              {...form.register("allergies")}
              placeholder="Penicillin, chicken, bee stings…"
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Notes" full>
            <textarea
              {...form.register("notes")}
              rows={3}
              placeholder="Behavioral patterns, fearful around X, special diet, anything important…"
              style={{ ...textareaStyle }}
            />
          </Field>
        </Row>
      </Section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          paddingTop: 24,
          borderTop: "1px solid var(--pw-border)",
          marginTop: 8,
        }}
      >
        <div>
          {mode === "edit" && petId && (
            <button
              type="button"
              onClick={onArchive}
              disabled={formDisabled}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid #b54a4a",
                background: "transparent",
                color: "#b54a4a",
                font: "500 12.5px var(--font-inter)",
                cursor: formDisabled ? "not-allowed" : "pointer",
                opacity: formDisabled ? 0.55 : 1,
              }}
            >
              <Icon name="x" size={12} />
              {isArchiving ? "Archiving…" : "Archive pet"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={formDisabled}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 12.5px var(--font-inter)",
              cursor: formDisabled ? "not-allowed" : "pointer",
              opacity: formDisabled ? 0.55 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={formDisabled}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 16px",
              borderRadius: 6,
              border: "1px solid var(--pw-accent)",
              background: "var(--pw-accent)",
              color: "var(--pw-accent-fg)",
              font: "500 12.5px var(--font-inter)",
              cursor: formDisabled ? "wait" : "pointer",
              opacity: formDisabled ? 0.7 : 1,
            }}
          >
            <Icon name={mode === "edit" ? "check" : "plus"} size={12} />
            {submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}

// ── Layout primitives ──────────────────────────────────────────

function Section({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 240px) 1fr",
        gap: 32,
        padding: "24px 0",
        borderBottom: "1px solid var(--pw-border)",
      }}
      className="pw-form-section"
    >
      <header>
        <h2
          style={{
            margin: 0,
            font: "600 13.5px var(--font-inter)",
            color: "var(--pw-text)",
          }}
        >
          {title}
        </h2>
        {helper && (
          <p
            style={{
              margin: "6px 0 0",
              font: "400 12px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {helper}
          </p>
        )}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: "1fr 1fr",
      }}
      className="pw-form-row"
    >
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "500 11.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
        {required && (
          <span
            style={{
              color: "var(--pw-text-subtle)",
              font: "400 11.5px var(--font-inter)",
              letterSpacing: 0,
              textTransform: "none",
            }}
          >
            ·
          </span>
        )}
        {!required && (
          <span
            style={{
              font: "400 10.5px var(--font-inter)",
              color: "var(--pw-text-subtle)",
              letterSpacing: 0,
              textTransform: "none",
              fontStyle: "italic",
            }}
          >
            optional
          </span>
        )}
      </label>
      {children}
      {error ? (
        <span
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "#b54a4a",
          }}
        >
          {error}
        </span>
      ) : hint ? (
        <span
          style={{
            font: "400 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function CheckboxRow({
  label,
  register,
  checked,
}: {
  label: string;
  register: ReturnType<ReturnType<typeof useForm<PetFormValues>>["register"]>;
  checked: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        font: "400 13px var(--font-inter)",
        color: "var(--pw-text)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        {...register}
        style={{
          width: 14,
          height: 14,
          accentColor: "var(--pw-accent)",
        }}
      />
      <span style={{ opacity: checked ? 1 : 0.7 }}>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
  resize: "vertical",
};
