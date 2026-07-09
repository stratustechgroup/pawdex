"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";

import { deleteVetClinic, updateVetClinic } from "./actions";

type InitialClinic = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  website: string | null;
  notes: string | null;
};

export function VetClinicEditForm({
  initial,
  canDelete,
  searchUrl,
}: {
  initial: InitialClinic;
  canDelete: boolean;
  searchUrl: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address_line1 ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  function cancel() {
    setName(initial.name);
    setPhone(initial.phone ?? "");
    setEmail(initial.email ?? "");
    setAddress(initial.address_line1 ?? "");
    setWebsite(initial.website ?? "");
    setNotes(initial.notes ?? "");
    setIsEditing(false);
  }

  function save() {
    startTransition(async () => {
      const r = await updateVetClinic({
        clinicId: initial.id,
        name,
        phone: phone || null,
        email: email || null,
        address_line1: address || null,
        website: website || null,
        notes: notes || null,
      });
      if (r.ok) {
        toast.success("Clinic updated");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Delete this clinic? Only allowed when nothing references it — you can always re-create it from an uploaded doc.",
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteVetClinic(initial.id);
      if (r && !r.ok) toast.error(r.error);
    });
  }

  if (!isEditing) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          style={btnSecondary}
        >
          <Icon name="edit" size={13} />
          Edit details
        </button>
        <a
          href={searchUrl}
          target="_blank"
          rel="noreferrer"
          style={{ ...btnSecondary, textDecoration: "none" }}
        >
          <Icon name="externalLink" size={13} />
          Look up on Google
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            style={{
              ...btnSecondary,
              color: "var(--pw-status-overdue-fg)",
              borderColor: "var(--pw-status-overdue-bg)",
            }}
          >
            <Icon name="x" size={13} />
            Delete
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="pw-card"
      style={{ padding: 16, marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <Field label="Clinic name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            style={inputStyle}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Website">
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            style={inputStyle}
          />
        </Field>
      </div>
      <Field label="Address (street, city, state, zip)">
        <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Notes">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, height: "auto", padding: "8px 12px", resize: "vertical" }}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={cancel} disabled={isPending} style={btnGhost}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={isPending || !name.trim()} style={btnPrimary}>
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "500 12.5px var(--font-inter)",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  ...btnSecondary,
  borderColor: "transparent",
  color: "var(--pw-text-muted)",
};

const btnPrimary: React.CSSProperties = {
  ...btnSecondary,
  background: "var(--pw-accent)",
  color: "#fff",
  borderColor: "var(--pw-accent)",
};
