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
import { kgToLbs } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WeightPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("weight_log")
    .select("id, recorded_on, weight_kg, source, notes")
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("recorded_on", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    recorded_on: string;
    weight_kg: number;
    source: string;
    notes: string | null;
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Weight</h2>
          <p className="text-muted-foreground text-sm">
            Weigh-ins from vet visits or at-home checks.
          </p>
        </div>
        <Button disabled variant="outline" title="Log weight — coming soon">
          Log weight
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No weight entries yet. Phase 4 adds a trend chart.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead className="hidden sm:table-cell">Source</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.recorded_on), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    {kgToLbs(Number(r.weight_kg))} lbs
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({Number(r.weight_kg)} kg)
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-xs uppercase tracking-wide">
                    {r.source}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {r.notes ?? "—"}
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
