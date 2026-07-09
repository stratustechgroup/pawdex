import Link from "next/link";

import { Icon } from "@/components/brand/icon";

import { PetForm } from "./pet-form";

export const metadata = { title: "Add a pet — Pawdex" };

export default function NewPetPage() {
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "32px 24px 56px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "400 12.5px var(--font-inter)",
          color: "var(--pw-text-muted)",
        }}
      >
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Pets
        </Link>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "var(--pw-text)" }}>New</span>
      </div>

      <header>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 28px var(--font-source-serif)",
            letterSpacing: "-0.02em",
            color: "var(--pw-text)",
          }}
        >
          Add a pet
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            maxWidth: 620,
          }}
        >
          Only the name and species are required. Everything else is optional —
          you can fill in the rest now or let it populate from documents later.
        </p>
      </header>

      <PetForm />
    </div>
  );
}
