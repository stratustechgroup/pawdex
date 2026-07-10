-- Pawdex Phase 6.41 — animal transfer handshake (expand phase).
--
-- A transfer moves an animal's ownership (and its clinical record) from one
-- household to another via a tokenized accept flow, mirroring the
-- household_invitations pattern: the raw token leaves the server once, we store
-- only its SHA-256 hash.

-- =========================================================
-- animal_transfers
-- =========================================================

create table public.animal_transfers (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  from_household_id uuid not null references public.households(id) on delete cascade,
  -- SHA-256 hex of the raw token; the token itself is never stored.
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  recipient_email text,
  message text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_household_id uuid references public.households(id) on delete set null,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_animal_transfers_from_household
  on public.animal_transfers(from_household_id, created_at desc);
create index idx_animal_transfers_animal on public.animal_transfers(animal_id);

alter table public.animal_transfers enable row level security;

-- Only the origin household's members can see their outgoing transfers. The
-- public accept route (/transfer/[token]) uses the service-role client and
-- re-hashes the URL token, exactly like share_links.
create policy "animal_transfers_select" on public.animal_transfers
  for select to authenticated
  using (public.is_household_member(from_household_id));

-- All writes (create / revoke / accept) go through the service role.

-- =========================================================
-- transfer_animal — atomic ownership + record move.
--
-- Re-parents the animal's CLINICAL RECORD to the target household and swaps
-- the owner custodianship. Runs as a single transaction (a security-definer
-- function body is atomic with its caller's statement).
--
-- TABLES RE-PARENTED (household_id set to the target household):
--   pets                        (the legacy row; household_id follows the animal)
--   weight_log
--   vaccinations
--   medical_events
--   medications
--   medication_administrations
--   lab_values
--   qol_entries
--   reminders                   (pet-scoped rows only; pet_id is not null)
--   documents                   (only docs linked EXCLUSIVELY to this pet)
--   document_pet_links          (link rows for those exclusive docs)
--   vet_clinics                 (referenced clinics COPIED into the target,
--                                deduped, then moved rows repointed)
--
-- TABLES DELIBERATELY LEFT WITH THE ORIGIN HOUSEHOLD (not the pet's clinical
-- record — they are the origin household's business, consent, and comms
-- history, and moving them would leak the prior owner's activity):
--   insurance_policies, cost_estimates, claims, claim_attachments,
--   medication_price_quotes, outbound_emails, pending_records_requests,
--   extraction_chunks, document_extractions, multi-pet documents.
--
-- Records hang off `pets`, so the record move resolves the pet from the
-- animal. An animal with no pet row (created directly post-expand) still swaps
-- custodianship cleanly; the record re-parenting is simply a no-op.
-- =========================================================

create or replace function public.transfer_animal(
  p_animal_id uuid,
  p_to_household_id uuid,
  p_transfer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer   record;
  v_cust_id    uuid;
  v_from_house uuid;
  v_pet_id     uuid;
  v_pet_house  uuid;
  v_clinic     record;
  v_new_clinic uuid;
  v_doc        record;
begin
  -- Validate the transfer row and its lifecycle state.
  select * into v_transfer from public.animal_transfers where id = p_transfer_id;
  if not found then
    raise exception 'transfer_animal: transfer % not found', p_transfer_id;
  end if;
  if v_transfer.animal_id <> p_animal_id then
    raise exception 'transfer_animal: transfer % is not for animal %', p_transfer_id, p_animal_id;
  end if;
  if v_transfer.accepted_at is not null then
    raise exception 'transfer_animal: transfer % already accepted', p_transfer_id;
  end if;
  if v_transfer.revoked_at is not null or v_transfer.declined_at is not null then
    raise exception 'transfer_animal: transfer % is revoked or declined', p_transfer_id;
  end if;
  if v_transfer.expires_at < now() then
    raise exception 'transfer_animal: transfer % has expired', p_transfer_id;
  end if;

  -- Find the active OWNER custodianship (the thing being handed over). Other
  -- active roles (foster, co_owner) are intentionally left untouched.
  select id, household_id into v_cust_id, v_from_house
  from public.custodianships
  where animal_id = p_animal_id and role = 'owner' and ended_at is null
  limit 1;
  if v_cust_id is null then
    raise exception 'transfer_animal: no active owner custodianship for animal %', p_animal_id;
  end if;

  -- Swap ownership: close the old, open a new one in the target household.
  update public.custodianships set ended_at = now() where id = v_cust_id;
  insert into public.custodianships (animal_id, household_id, role, started_at, created_by)
  values (p_animal_id, p_to_household_id, 'owner', now(), v_transfer.accepted_by);

  -- Resolve the legacy pet, if any. Its household_id is the source for the
  -- record re-parenting (should match v_from_house, but pets is authoritative
  -- for record rows).
  select id, household_id into v_pet_id, v_pet_house
  from public.pets where animal_id = p_animal_id;

  if v_pet_id is not null then
    -- (1) Copy referenced vet clinics into the target household (dedupe on the
    -- existing unique key: household_id, lower(name), coalesce(phone,'')), then
    -- repoint the moved rows. Done while rows still reference the origin clinic.
    for v_clinic in
      select vc.*
      from public.vet_clinics vc
      where vc.household_id = v_pet_house
        and vc.id in (
          select vet_clinic_id from public.vaccinations
            where pet_id = v_pet_id and vet_clinic_id is not null
          union
          select vet_clinic_id from public.medical_events
            where pet_id = v_pet_id and vet_clinic_id is not null
          union
          select vet_clinic_id from public.medications
            where pet_id = v_pet_id and vet_clinic_id is not null
        )
    loop
      select id into v_new_clinic
      from public.vet_clinics
      where household_id = p_to_household_id
        and lower(name) = lower(v_clinic.name)
        and coalesce(phone, '') = coalesce(v_clinic.phone, '');

      if v_new_clinic is null then
        insert into public.vet_clinics (
          household_id, name, phone, email, website, address_line1,
          address_line2, city, region, postal_code, country, notes
        ) values (
          p_to_household_id, v_clinic.name, v_clinic.phone, v_clinic.email,
          v_clinic.website, v_clinic.address_line1, v_clinic.address_line2,
          v_clinic.city, v_clinic.region, v_clinic.postal_code,
          v_clinic.country, v_clinic.notes
        )
        returning id into v_new_clinic;
      end if;

      update public.vaccinations set vet_clinic_id = v_new_clinic
        where pet_id = v_pet_id and vet_clinic_id = v_clinic.id;
      update public.medical_events set vet_clinic_id = v_new_clinic
        where pet_id = v_pet_id and vet_clinic_id = v_clinic.id;
      update public.medications set vet_clinic_id = v_new_clinic
        where pet_id = v_pet_id and vet_clinic_id = v_clinic.id;
    end loop;

    -- (2) Re-parent the pet and its clinical record rows.
    update public.pets set household_id = p_to_household_id where id = v_pet_id;
    update public.weight_log set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.vaccinations set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.medical_events set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.medications set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.medication_administrations set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.lab_values set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.qol_entries set household_id = p_to_household_id where pet_id = v_pet_id;
    update public.reminders set household_id = p_to_household_id
      where pet_id = v_pet_id and pet_id is not null;

    -- (3) Documents: move only those associated EXCLUSIVELY with this pet.
    -- A doc is exclusive when every association it has (direct documents.pet_id
    -- and every document_pet_links row) points at this pet and no other.
    for v_doc in
      select d.id
      from public.documents d
      where (
              d.pet_id = v_pet_id
              or exists (
                select 1 from public.document_pet_links l
                where l.document_id = d.id and l.pet_id = v_pet_id
              )
            )
        and (d.pet_id is null or d.pet_id = v_pet_id)
        and not exists (
          select 1 from public.document_pet_links l2
          where l2.document_id = d.id and l2.pet_id <> v_pet_id
        )
    loop
      update public.documents set household_id = p_to_household_id where id = v_doc.id;
      update public.document_pet_links set household_id = p_to_household_id
        where document_id = v_doc.id;
    end loop;
  end if;

  -- (4) Stamp the transfer as accepted.
  update public.animal_transfers
  set accepted_at = now(),
      accepted_household_id = p_to_household_id
  where id = p_transfer_id;

  -- (5) Audit both sides.
  insert into public.audit_log (household_id, actor_id, action, entity_type, entity_id, diff)
  values (
    v_from_house, v_transfer.accepted_by, 'update', 'animal_transfer', p_animal_id,
    jsonb_build_object('direction', 'out', 'to_household', p_to_household_id, 'transfer_id', p_transfer_id)
  );
  insert into public.audit_log (household_id, actor_id, action, entity_type, entity_id, diff)
  values (
    p_to_household_id, v_transfer.accepted_by, 'update', 'animal_transfer', p_animal_id,
    jsonb_build_object('direction', 'in', 'from_household', v_from_house, 'transfer_id', p_transfer_id)
  );
end;
$$;

-- Service role only. The accept action authenticates the recipient, sets
-- accepted_by on the transfer row, then calls this with the service client.
-- Revoke the default PUBLIC grant, then grant back explicitly to service_role
-- so the RPC caller (service key) still works while anon/authenticated cannot.
revoke execute on function public.transfer_animal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_animal(uuid, uuid, uuid) to service_role;
