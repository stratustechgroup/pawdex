
-- Phase 6.23 — three new intake fields surfaced on the Add Pet form.
--
-- microchip_implanted_on: closes the EU travel compliance gap we documented
-- in /pets/[id]/eu-travel (chip-before-rabies ordering can't be verified
-- without knowing the chip date).
-- acquired_on: useful for adoption tracking + answers "since when have you
-- had this pet" naturally — separate from date_of_birth.
-- allergies: structured short field for emergency-card visibility; long-form
-- behavioral notes still go in the existing notes column.

alter table pets
  add column if not exists microchip_implanted_on date,
  add column if not exists acquired_on date,
  add column if not exists allergies text;

comment on column pets.microchip_implanted_on is
  'Date the microchip was implanted. Used by /eu-travel to verify the EU-mandated chip-before-rabies ordering.';
comment on column pets.acquired_on is
  'Date the household acquired the pet (adoption / purchase / litter). Separate from date_of_birth.';
comment on column pets.allergies is
  'Free-text short summary of known allergies. Surfaces on the emergency card.';
