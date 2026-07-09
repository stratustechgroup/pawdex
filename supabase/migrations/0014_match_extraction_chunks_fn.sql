
-- Phase 5.7 — pgvector cosine similarity search for doc Q&A.
-- The function is SECURITY DEFINER but explicitly filters by household_id
-- passed in from the trusted server context (RLS would be skipped otherwise).

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
  order by ec.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_extraction_chunks is
  'Cosine-similarity search over extraction_chunks scoped to a single household. Caller must enforce household membership before invoking.';
