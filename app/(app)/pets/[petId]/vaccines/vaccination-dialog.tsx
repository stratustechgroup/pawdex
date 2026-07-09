"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  vaccinationFormSchema,
  vaccinationFormToPayload,
  type VaccinationFormValues,
} from "@/lib/schemas/vaccination";
import {
  computeExpiryFromFamily,
  getCatalogEntry,
  inferFamilyFromType,
} from "@/lib/clinical/vaccine-catalog";

import { createVaccination } from "./actions";

export function VaccinationDialog({
  petId,
  petDob,
}: {
  petId: string;
  petDob?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<VaccinationFormValues>({
    resolver: zodResolver(vaccinationFormSchema),
    defaultValues: {
      pet_id: petId,
      vaccine_type: "",
      administered_on: "",
      expires_on: "",
      lot_number: "",
      manufacturer: "",
      administering_vet: "",
      vet_clinic_name: "",
      notes: "",
    },
  });

  // Watch the two inputs that drive the catalog hint. When the user types a
  // recognizable vaccine name + picks an administered date but leaves "Expires"
  // blank, we offer a one-click default.
  const vaccineType = form.watch("vaccine_type");
  const administeredOn = form.watch("administered_on");
  const expiresOn = form.watch("expires_on");
  const suggested = useMemo(() => {
    if (expiresOn.trim()) return null;
    if (!administeredOn) return null;
    const family = inferFamilyFromType(vaccineType);
    if (!family) return null;
    const computed = computeExpiryFromFamily({
      family,
      administered_on: administeredOn,
      pet_date_of_birth: petDob ?? null,
    });
    if (!computed) return null;
    const entry = getCatalogEntry(family);
    return { family, computed, label: entry?.label ?? family };
  }, [vaccineType, administeredOn, expiresOn, petDob]);

  function onSubmit(values: VaccinationFormValues) {
    startTransition(async () => {
      const result = await createVaccination(vaccinationFormToPayload(values));
      if (result.ok) {
        toast.success("Vaccine added");
        form.reset({
          pet_id: petId,
          vaccine_type: "",
          administered_on: "",
          expires_on: "",
          lot_number: "",
          manufacturer: "",
          administering_vet: values.administering_vet,
          vet_clinic_name: values.vet_clinic_name,
          notes: "",
        });
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
        <Button>Add vaccine</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vaccine record</DialogTitle>
          <DialogDescription>
            You can paste in details from a paper certificate, or upload the document later
            to auto-fill.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vaccine_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vaccine</FormLabel>
                  <FormControl>
                    <Input placeholder="Rabies (1 year), DHPP, FVRCP…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="administered_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Administered</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expires_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    {suggested && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                          font: "400 11.5px var(--font-inter)",
                          color: "var(--pw-text-muted)",
                        }}
                      >
                        <span>
                          Catalog default:{" "}
                          <span
                            className="tnum"
                            style={{ color: "var(--pw-text)", fontWeight: 500 }}
                          >
                            {suggested.computed.expires_on}
                          </span>{" "}
                          ({suggested.computed.duration_months} mo
                          {suggested.computed.is_first_dose ? ", first dose" : ""})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            form.setValue(
                              "expires_on",
                              suggested.computed.expires_on,
                              { shouldDirty: true, shouldValidate: true },
                            )
                          }
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--pw-border-strong)",
                            background: "var(--pw-surface)",
                            color: "var(--pw-text)",
                            font: "500 11px var(--font-inter)",
                            cursor: "pointer",
                          }}
                        >
                          Use this
                        </button>
                        {suggested.computed.legally_sensitive && (
                          <span
                            title="State law controls — verify against your jurisdiction before relying on this expiry."
                            style={{
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: "var(--pw-status-due-bg)",
                              color: "var(--pw-status-due-fg)",
                              font: "600 9.5px var(--font-jetbrains)",
                              letterSpacing: "0.06em",
                            }}
                          >
                            VERIFY STATE LAW
                          </span>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="lot_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="administering_vet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vet</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Patel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vet_clinic_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic</FormLabel>
                    <FormControl>
                      <Input placeholder="Greenville Animal Hospital" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
