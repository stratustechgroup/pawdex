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
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MedicationsPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("medications")
    .select("id, name, dose, frequency, started_on, ended_on, is_active, prescriber")
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("started_on", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    dose: string;
    frequency: string | null;
    started_on: string;
    ended_on: string | null;
    is_active: boolean;
    prescriber: string | null;
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Medications</h2>
          <p className="text-muted-foreground text-sm">
            Active and historical prescriptions.
          </p>
        </div>
        <Button disabled variant="outline" title="Add medication — coming soon">
          Add medication
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No medications logged yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Prescriber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.dose}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.frequency ?? "—"}
                  </TableCell>
                  <TableCell>{format(new Date(r.started_on), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "secondary"}>
                      {r.is_active ? "Active" : "Ended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {r.prescriber ?? "—"}
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
