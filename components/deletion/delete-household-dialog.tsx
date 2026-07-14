"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TypeToConfirm, confirmMatches } from "@/components/deletion/type-to-confirm";
import { OtpConfirm } from "@/components/deletion/otp-confirm";
import {
  deleteHouseholdAction,
  sendHouseholdDeletionCodeAction,
} from "@/app/(app)/settings/household/actions";

/**
 * Confirmation ladder rung 2: delete the active household. Requires typing the
 * household name AND an emailed OTP. Offers an immediate (CCPA) hard delete at
 * the final step; otherwise soft-deletes with a 30-day restore window.
 */
export function DeleteHouseholdDialog({ householdName }: { householdName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setTyped("");
      setCode("");
      setImmediate(false);
    }
  }, [open]);

  const canDelete =
    confirmMatches(householdName, typed) && /^\d{6}$/.test(code) && !isPending;

  function onDelete() {
    if (!canDelete) return;
    startTransition(async () => {
      const r = await deleteHouseholdAction({ typedName: typed, code, immediate });
      if (r.ok) {
        toast.success(
          immediate
            ? "Household permanently deleted."
            : "Household deleted. You can restore it for 30 days from account settings.",
        );
        setOpen(false);
        router.push("/");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          style={{ background: "var(--pw-danger, #B4231F)", borderColor: "transparent" }}
        >
          Delete household
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--pw-text)" }}>
            Delete {householdName}?
          </DialogTitle>
          <DialogDescription style={{ color: "var(--pw-text-muted)" }}>
            This removes every pet, document, and record in this household. By
            default it is reversible for 30 days, then permanently purged.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p
            style={{
              margin: 0,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.55,
            }}
          >
            Export any records you want to keep from each pet&rsquo;s page first.
            Export stays free forever, including after deletion.
          </p>

          <TypeToConfirm
            phrase={householdName}
            value={typed}
            onChange={setTyped}
            id="delete-household-confirm"
          />

          <OtpConfirm
            code={code}
            onChange={setCode}
            sendCode={sendHouseholdDeletionCodeAction}
            id="delete-household-otp"
          />

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              cursor: "pointer",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-muted)",
              lineHeight: 1.5,
            }}
          >
            <Checkbox
              checked={immediate}
              onCheckedChange={(v) => setImmediate(v === true)}
              style={{ marginTop: 1 }}
            />
            <span>
              Delete immediately and skip the 30-day window. Use this for a
              privacy (CCPA) erasure request. This cannot be undone.
            </span>
          </label>
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
          <Button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            style={{ background: "var(--pw-danger, #B4231F)", borderColor: "transparent" }}
          >
            {isPending
              ? "Deleting…"
              : immediate
                ? "Delete permanently"
                : "Delete household"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
