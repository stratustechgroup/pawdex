"use client";

import { useState, useTransition } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MEDICATION_CONTEXTS,
  MEDICATION_CONTEXT_LABEL,
  medicationFormSchema,
  medicationFormToPayload,
  type MedicationFormValues,
} from "@/lib/schemas/medication";

import { createMedication } from "./actions";

function buildDefaults(petId: string): MedicationFormValues {
  return {
    pet_id: petId,
    name: "",
    dose: "",
    frequency: "",
    started_on: "",
    ended_on: "",
    duration_days: "",
    medication_context: "prescribed_takehome",
    prescriber: "",
    indication: "",
    vet_clinic_name: "",
    notes: "",
  };
}

export function MedicationDialog({ petId }: { petId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: buildDefaults(petId),
  });

  const context = form.watch("medication_context");
  const isHistoricalContext =
    context === "intraoperative" || context === "injection_in_office";

  function onSubmit(values: MedicationFormValues) {
    startTransition(async () => {
      const result = await createMedication(medicationFormToPayload(values));
      if (result.ok) {
        toast.success("Medication added");
        form.reset({
          ...buildDefaults(petId),
          // Keep clinic + prescriber sticky for follow-up entries.
          prescriber: values.prescriber,
          vet_clinic_name: values.vet_clinic_name,
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
        <Button>Add medication</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add medication</DialogTitle>
          <DialogDescription>
            Log a prescription, in-office injection, or OTC recommendation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medication</FormLabel>
                  <FormControl>
                    <Input placeholder="Apoquel, Carprofen, Cerenia…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose</FormLabel>
                    <FormControl>
                      <Input placeholder="16 mg, 1 tablet…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <FormControl>
                      <Input placeholder="Twice daily, q12h…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="started_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Started</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ended_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ends</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="7"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="medication_context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEDICATION_CONTEXTS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {MEDICATION_CONTEXT_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isHistoricalContext && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        font: "400 12px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      Won&apos;t appear under &ldquo;Active medications&rdquo; — recorded as
                      historical.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="prescriber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescriber</FormLabel>
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
              name="indication"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indication</FormLabel>
                  <FormControl>
                    <Input placeholder="Why was it prescribed?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
