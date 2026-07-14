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
import { OtpConfirm } from "@/components/deletion/otp-confirm";
import {
  deleteAccountAction,
  getAccountDeletionPreviewAction,
  sendAccountDeletionCodeAction,
} from "@/app/(app)/settings/account/actions";

type Preview = {
  soleOwned: Array<{ id: string; name: string }>;
  sharedOrMember: Array<{ id: string; name: string; role: string }>;
};

/**
 * Confirmation ladder rung 3: delete the whole account. Emailed OTP plus a
 * clear grace-period notice and an explicit enumeration of which households are
 * destroyed (solely owned) versus merely left (shared / member). An immediate
 * (CCPA) hard delete is offered at the final step.
 */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [code, setCode] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [ack, setAck] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setCode("");
    setImmediate(false);
    setAck(false);
    setPreview(null);
    getAccountDeletionPreviewAction()
      .then(setPreview)
      .catch(() => toast.error("Could not load what will be deleted."));
  }, [open]);

  const canDelete = /^\d{6}$/.test(code) && ack && !isPending;

  function onDelete() {
    if (!canDelete) return;
    startTransition(async () => {
      const r = await deleteAccountAction({ code, immediate });
      if (r.ok) {
        if (immediate) {
          toast.success("Your account and data have been permanently deleted.");
          router.push("/login");
        } else {
          toast.success("Account scheduled for deletion.");
          router.push("/account-deletion");
        }
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
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--pw-text)" }}>
            Delete your account?
          </DialogTitle>
          <DialogDescription style={{ color: "var(--pw-text-muted)" }}>
            By default your account enters a 30-day grace period. You can restore
            it any time before then by signing back in.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {preview === null ? (
            <p style={{ margin: 0, font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
              Checking what will be deleted…
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {preview.soleOwned.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 4px", font: "600 12px var(--font-inter)", color: "var(--pw-text)" }}>
                    These households and everything in them will be deleted:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
                    {preview.soleOwned.map((h) => (
                      <li key={h.id}>{h.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.sharedOrMember.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 4px", font: "600 12px var(--font-inter)", color: "var(--pw-text)" }}>
                    You&rsquo;ll simply leave these (they have other owners):
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, font: "400 12.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
                    {preview.sharedOrMember.map((h) => (
                      <li key={h.id}>
                        {h.name} <span style={{ opacity: 0.7 }}>({h.role})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ margin: 0, font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)", lineHeight: 1.5 }}>
                Export anything you want to keep first. Export stays free forever.
              </p>
            </div>
          )}

          <OtpConfirm
            code={code}
            onChange={setCode}
            sendCode={sendAccountDeletionCodeAction}
            id="delete-account-otp"
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
              Delete immediately and skip the 30-day window (privacy / CCPA
              erasure). This cannot be undone.
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              cursor: "pointer",
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text)",
              lineHeight: 1.5,
            }}
          >
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              style={{ marginTop: 1 }}
            />
            <span>I understand what will be deleted.</span>
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
              ? "Working…"
              : immediate
                ? "Delete permanently"
                : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
