import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function PetOverviewPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [vaccinesRes, medsRes, eventsRes] = await Promise.all([
    supabase
      .from("vaccinations")
      .select("id, vaccine_type, administered_on, expires_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("expires_on", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("medications")
      .select("id, name, dose, frequency, is_active, started_on, ended_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .eq("is_active", true)
      .order("started_on", { ascending: false })
      .limit(5),
    supabase
      .from("medical_events")
      .select("id, event_type, title, occurred_on")
      .eq("household_id", session.householdId)
      .eq("pet_id", petId)
      .order("occurred_on", { ascending: false })
      .limit(5),
  ]);

  const vaccines = vaccinesRes.data ?? [];
  const meds = medsRes.data ?? [];
  const events = eventsRes.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Upcoming vaccines</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/pets/${petId}/vaccines`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {vaccines.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No vaccinations on record yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {vaccines.map((v: { id: string; vaccine_type: string; administered_on: string; expires_on: string | null }) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{v.vaccine_type}</span>
                  <span className="text-muted-foreground">
                    {v.expires_on
                      ? `expires ${format(new Date(v.expires_on), "MMM d, yyyy")}`
                      : `given ${format(new Date(v.administered_on), "MMM d, yyyy")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Active medications</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/pets/${petId}/medications`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {meds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active medications.</p>
          ) : (
            <ul className="space-y-2">
              {meds.map((m: { id: string; name: string; dose: string; frequency: string | null }) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.dose}
                    {m.frequency ? ` · ${m.frequency}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Recent medical events</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/pets/${petId}/medical`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No visits or events logged yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((e: { id: string; title: string; event_type: string; occurred_on: string }) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{e.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs uppercase tracking-wide">
                      {e.event_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {format(new Date(e.occurred_on), "MMM d, yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
