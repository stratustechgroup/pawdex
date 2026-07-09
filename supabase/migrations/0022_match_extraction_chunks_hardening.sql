
-- Defense in depth: even if a future caller passes an attacker-controlled
-- household_id, the function refuses to return rows unless the caller is a
-- member of that household. Doesn't change behavior for the current legit
-- caller (which always passes session.householdId).

create or replace function public.match_extraction_chunks(
  query_embedding extensions.vector(1536),
  match_count integer,
  p_household_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  pet_id uuid,
  source_path text,
  content text,
  similarity float
)
language sql stable
security invoker
as $$
  select
    ec.id,
    ec.document_id,
    ec.pet_id,
    ec.source_path,
    ec.content,
    1 - (ec.embedding <=> query_embedding) as similarity
  from public.extraction_chunks ec
  where ec.household_id = p_household_id
    and ec.embedding is not null
    -- Defensive: enforce caller-household membership inside the function so
    -- even a buggy caller that passes an attacker-controlled household_id
    -- can't leak across households.
    and exists (
      select 1
      from public.household_members hm
      where hm.household_id = p_household_id
        and hm.user_id = (select auth.uid())
    )
  order by ec.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- When the function is called from a service-role context (no auth.uid()),
-- the new check would block legitimate background-worker callers. Today the
-- only caller is from a server action with an authenticated user — the
-- service-role indexer doesn't query this function.

comment on function public.match_extraction_chunks is
  'Cosine-similarity search over extraction_chunks scoped to a single household. Now enforces caller-household membership defensively.';
