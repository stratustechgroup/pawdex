"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveDisplayName } from "./actions";
import { fieldStyle, labelStyle, primaryButtonStyle } from "./ui";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = name.trim() !== initialName.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const r = await saveDisplayName(name);
      if (r.ok) {
        toast.success("Display name saved");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label htmlFor="display_name" style={labelStyle}>
        Display name
      </label>
      <input
        id="display_name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Your name"
        disabled={isPending}
        style={fieldStyle}
      />
      <div>
        <button
          type="submit"
          disabled={isPending || !dirty}
          style={primaryButtonStyle(isPending || !dirty)}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
