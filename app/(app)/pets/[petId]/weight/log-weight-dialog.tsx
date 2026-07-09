"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lbsToKg } from "@/lib/utils";

import { logWeight } from "./actions";

type Unit = "lbs" | "kg";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LogWeightDialog({
  petId,
  triggerLabel = "Log weight",
  variant = "primary",
}: {
  petId: string;
  triggerLabel?: string;
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<Unit>("lbs");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Reset to a clean slate every time the dialog opens.
  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setValue("");
      setUnit("lbs");
      setNotes("");
    }
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a weight greater than zero");
      return;
    }
    if (!date) {
      toast.error("Pick a date");
      return;
    }
    const weight_kg = unit === "kg" ? num : lbsToKg(num);

    startTransition(async () => {
      const result = await logWeight({
        pet_id: petId,
        recorded_on: date,
        weight_kg,
        notes: notes.trim() || null,
      });
      if (result.ok) {
        toast.success("Weight logged");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            borderRadius: 6,
            cursor: "pointer",
            font: "500 12.5px var(--font-inter)",
            background:
              variant === "primary" ? "var(--pw-accent)" : "var(--pw-surface)",
            border:
              variant === "primary"
                ? "1px solid var(--pw-accent)"
                : "1px solid var(--pw-border-strong)",
            color: variant === "primary" ? "#fff" : "var(--pw-text)",
          }}
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--pw-text)" }}>
            Log weight
          </DialogTitle>
          <DialogDescription style={{ color: "var(--pw-text-muted)" }}>
            Record a weigh-in from a vet visit or at-home scale.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="weight-date" style={{ color: "var(--pw-text)" }}>
              Date
            </Label>
            <Input
              id="weight-date"
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="weight-value" style={{ color: "var(--pw-text)" }}>
              Weight
            </Label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                id="weight-value"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder={unit === "lbs" ? "e.g. 24.5" : "e.g. 11.1"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <div
                role="group"
                aria-label="Weight unit"
                style={{
                  display: "inline-flex",
                  border: "1px solid var(--pw-border-strong)",
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "var(--pw-surface)",
                }}
              >
                {(["lbs", "kg"] as const).map((u) => {
                  const active = unit === u;
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      aria-pressed={active}
                      style={{
                        padding: "0 12px",
                        height: 36,
                        font: "500 12.5px var(--font-inter)",
                        cursor: "pointer",
                        background: active
                          ? "var(--pw-accent)"
                          : "transparent",
                        color: active ? "#fff" : "var(--pw-text-muted)",
                        border: "none",
                        borderRight:
                          u === "lbs"
                            ? "1px solid var(--pw-border-strong)"
                            : "none",
                      }}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="weight-notes" style={{ color: "var(--pw-text)" }}>
              Notes
              <span
                style={{
                  marginLeft: 6,
                  color: "var(--pw-text-muted)",
                  font: "400 11.5px var(--font-inter)",
                }}
              >
                optional
              </span>
            </Label>
            <Textarea
              id="weight-notes"
              rows={2}
              placeholder="Vet visit, home scale, after grooming…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
