"use client";

import { useState } from "react";

import type { PlanSpecies } from "@/lib/clinical/first-year";

import { ConsentStep } from "./consent-step";
import { IdentityStep } from "./identity-step";
import { PetStep, type CreatedPet } from "./pet-step";
import { Progress, Shell } from "./ui";
import { ValueStep } from "./value-step";

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({
  householdId,
  initialDisplayName,
  initialHouseholdName,
  suggestedHouseholdName,
}: {
  householdId: string;
  initialDisplayName: string;
  initialHouseholdName: string;
  suggestedHouseholdName: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [pet, setPet] = useState<CreatedPet | null>(null);

  return (
    <Shell>
      <Progress step={step} />

      {step === 1 ? (
        <IdentityStep
          initialDisplayName={initialDisplayName}
          initialHouseholdName={initialHouseholdName}
          suggestedHouseholdName={suggestedHouseholdName}
          onDone={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <PetStep
          householdId={householdId}
          onDone={(created) => {
            setPet(created);
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 ? (
        <ConsentStep onDone={() => setStep(4)} onBack={() => setStep(2)} />
      ) : null}

      {step === 4 && pet ? (
        <ValueStep
          pet={{
            id: pet.id,
            name: pet.name,
            species: pet.species as PlanSpecies,
            birthDate: pet.birthDate,
          }}
          onBack={() => setStep(3)}
        />
      ) : null}
    </Shell>
  );
}
