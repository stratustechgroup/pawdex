-- Fix doc Q&A retrieval recall.
--
-- PROBLEM
-- 0010 created an ivfflat index on extraction_chunks with lists = 100, and its
-- own comment conceded it was built on an empty table ("Build after data lands;
-- cheap empty"). It never was rebuilt. Centroids derived from zero rows are
-- meaningless, and pgvector defaults to ivfflat.probes = 1, so a query searches
-- one of 100 degenerate lists. match_extraction_chunks then filters by
-- household_id, which eliminates most of the little that was found.
--
-- Measured on production (359 chunks, 23 documents):
--   * A semantic query against a household with 3 chunks returned 0 rows.
--   * A query using a chunk's OWN embedding (distance 0, guaranteed nearest
--     neighbour) returned that chunk but only 1 of 50 chunks in the household,
--     with match_count = 5. Correct behaviour returns 5.
-- The feature is unusable: Ask retrieves at most one chunk and usually none.
--
-- FIX
-- Drop the approximate index and let the query do an exact scan within the
-- household. match_extraction_chunks is ALWAYS scoped to a single household_id,
-- and idx_extraction_chunks_household_pet already makes that filter cheap. The
-- remaining vector comparison runs over one household's chunks — tens to low
-- hundreds today, and a few thousand for a heavy user years out. Exact search
-- over that is sub-millisecond and, unlike ivfflat, has 100% recall.
--
-- Correctness is worth more than latency here. This is a medical-records Q&A
-- surface: silently missing a vaccination record because an approximate index
-- probed the wrong list is a real harm, and an invisible one.
--
-- Verified before this migration: with the table at 3 rows the planner chose a
-- seq scan and retrieval was exact (correct chunk, 0.697 similarity). Dropping
-- the index restores that path at every table size.
--
-- WHEN TO REVISIT
-- If a single household ever exceeds ~10k chunks and per-query latency becomes
-- measurable, add HNSW rather than ivfflat:
--   create index ... using hnsw (embedding extensions.vector_cosine_ops)
--     with (m = 16, ef_construction = 64);
-- HNSW does not depend on data being present at build time and has far better
-- recall. Validate recall against an exact scan before trusting it, using the
-- self-match check described above.

drop index if exists public.idx_extraction_chunks_embedding;

comment on index public.idx_extraction_chunks_household_pet is
  'Primary access path for match_extraction_chunks: filter to one household, then scan that household''s chunks exactly. No approximate vector index by design — see 0037.';
