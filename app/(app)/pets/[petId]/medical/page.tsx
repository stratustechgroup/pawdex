import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MedicalPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("medical_events")
    .select("id, event_type, occurred_on, title, diagnosis, vet_clinics(name)")
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("occurred_on", { ascending: false });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    event_type: string;
    occurred_on: string;
    title: string;
    diagnosis: string | null;
    vet_clinics: { name: string } | null;
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Medical history</h2>
          <p className="text-muted-foreground text-sm">
            Visits, illnesses, surgeries, lab results.
          </p>
        </div>
        <Button disabled variant="outline" title="Add manual event — coming soon">
          Add event
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Nothing logged yet. In Phase 2, uploading a SOAP note will auto-create these.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Diagnosis</TableHead>
                <TableHead className="hidden md:table-cell">Clinic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.occurred_on), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground text-xs uppercase tracking-wide">
                    {r.event_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {r.diagnosis ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {r.vet_clinics?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
