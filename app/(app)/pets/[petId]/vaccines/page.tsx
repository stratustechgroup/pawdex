import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { cn, daysBetween } from "@/lib/utils";

import { VaccinationDialog } from "./vaccination-dialog";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  vaccine_type: string;
  administered_on: string;
  expires_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  is_rabies: boolean;
  vet_clinics: { name: string } | null;
};

function rowStatus(expires_on: string | null): {
  label: string;
  cls: string;
} {
  if (!expires_on) return { label: "No expiry", cls: "bg-muted text-muted-foreground" };
  const days = daysBetween(new Date(), new Date(expires_on));
  if (days < 0) return { label: `Overdue ${Math.abs(days)} d`, cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" };
  if (days <= 30) return { label: `Due in ${days} d`, cls: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" };
  return { label: `${days} d`, cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" };
}

export default async function VaccinesPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("vaccinations")
    .select(
      "id, vaccine_type, administered_on, expires_on, lot_number, manufacturer, is_rabies, vet_clinics(name)",
    )
    .eq("household_id", session.householdId)
    .eq("pet_id", petId)
    .order("expires_on", { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Vaccines</h2>
          <p className="text-muted-foreground text-sm">
            {rows.length === 0
              ? "No vaccinations on record yet."
              : `${rows.length} on record`}
          </p>
        </div>
        <VaccinationDialog petId={petId} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Add your first vaccine to start tracking expiration dates.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vaccine</TableHead>
                <TableHead>Administered</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Clinic</TableHead>
                <TableHead className="hidden md:table-cell">Lot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const status = rowStatus(r.expires_on);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.vaccine_type}
                        {r.is_rabies ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            Legal
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(r.administered_on), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {r.expires_on
                        ? format(new Date(r.expires_on), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("font-medium", status.cls)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {r.vet_clinics?.name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {r.lot_number ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
