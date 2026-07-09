import Link from "next/link";
import { PawPrint } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, ageFromDob } from "@/lib/utils";
import type { PetWithStatus } from "@/lib/db/pets";

const STATUS_LABEL = {
  up_to_date: "Up to date",
  due_soon: "Due soon",
  overdue: "Overdue",
  incomplete: "Incomplete",
} as const;

const STATUS_CLASS = {
  up_to_date: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  due_soon: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  overdue: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  incomplete: "bg-muted text-muted-foreground",
} as const;

export function PetCard({
  pet,
  photoUrl,
}: {
  pet: PetWithStatus;
  photoUrl: string | null;
}) {
  const age = ageFromDob(pet.date_of_birth);
  const details = [
    pet.breed,
    pet.sex !== "unknown" ? pet.sex : null,
    age,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/pets/${pet.id}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start gap-4 p-5">
          <Avatar className="h-14 w-14 ring-2 ring-border">
            {photoUrl ? <AvatarImage src={photoUrl} alt={pet.name} /> : null}
            <AvatarFallback>
              <PawPrint className="h-6 w-6 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold leading-none">{pet.name}</h3>
              <Badge
                variant="secondary"
                className={cn("shrink-0 text-[11px] font-medium", STATUS_CLASS[pet.status])}
              >
                {STATUS_LABEL[pet.status]}
              </Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {details || pet.species}
            </p>
            {pet.next_due_label ? (
              <p className="truncate text-xs text-muted-foreground">{pet.next_due_label}</p>
            ) : (
              <p className="truncate text-xs text-muted-foreground/70">
                No vaccinations on record yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
