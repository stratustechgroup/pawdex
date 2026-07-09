"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { PetPhoto } from "@/components/pawdex/pet-photo";
import { createClient } from "@/lib/supabase/browser";
import { setPetPhoto } from "@/app/(app)/pets/[petId]/edit/actions";

const SIZE = 96;

export function PetPhotoUploader({
  petId,
  householdId,
  currentPhotoUrl,
  currentInitial,
  tint,
}: {
  petId: string;
  householdId: string;
  currentPhotoUrl: string | null;
  currentInitial: string;
  tint?: 1 | 2 | 3 | 4;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  const hasPhoto = Boolean(currentPhotoUrl);

  const handleFile = useCallback(
    async (file: File) => {
      if (busy) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file.");
        return;
      }
      setBusy(true);
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 512,
          useWebWorker: true,
          initialQuality: 0.85,
          fileType: "image/jpeg",
        });

        const uuid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const storagePath = `${householdId}/${petId}/${uuid}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("pet-photos")
          .upload(storagePath, compressed, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadErr) {
          toast.error(uploadErr.message);
          setBusy(false);
          return;
        }

        const result = await setPetPhoto(petId, storagePath);
        if (!result.ok) {
          toast.error(result.error);
          // try to clean up the orphan upload
          try {
            await supabase.storage.from("pet-photos").remove([storagePath]);
          } catch {
            // ignore
          }
          setBusy(false);
          return;
        }

        toast.success("Photo updated");
        startTransition(() => router.refresh());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [busy, householdId, petId, router, supabase],
  );

  const handleRemove = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await setPetPhoto(petId, null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Photo removed");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }, [busy, petId, router]);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        disabled={busy}
        aria-label="Change pet photo"
        style={{
          position: "relative",
          width: SIZE,
          height: SIZE,
          padding: 0,
          border: "none",
          background: "transparent",
          borderRadius: "50%",
          cursor: busy ? "wait" : "pointer",
          display: "inline-block",
        }}
      >
        <PetPhoto
          name={currentInitial}
          src={currentPhotoUrl}
          size={SIZE}
          tint={tint}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.45)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: busy || hover ? 1 : 0,
            transition: "opacity 120ms ease",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {busy ? (
            <Spinner />
          ) : (
            <>
              <Icon name="camera" size={18} />
              <span
                style={{
                  font: "500 10.5px var(--font-inter)",
                  lineHeight: 1,
                }}
              >
                {hasPhoto ? "Change" : "Add photo"}
              </span>
            </>
          )}
        </span>
      </button>

      {hasPhoto ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            font: "500 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
            cursor: busy ? "wait" : "pointer",
            textDecoration: "underline",
          }}
        >
          Remove photo
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="animate-spin"
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: "2px solid rgba(255,255,255,0.35)",
        borderTopColor: "#fff",
        borderRadius: "50%",
      }}
    />
  );
}
