-- Token and cost accounting for every LLM call.
--
-- Until now all ten call sites discarded the SDK's `usage` object, and
-- document_extractions recorded `model` but no tokens and no cost. That left no
-- way to answer the questions that decide whether this product's unit economics
-- work: what does a document cost to process, which household or feature is
-- driving spend, and how often does tier 1 escalate to Sonnet (which is where
-- the money actually goes).
--
-- Rows are written fire-and-forget from the service client after a call
-- completes. A failure to record usage must never fail the user's request, so
-- nothing here is on the critical path.
--
-- No RLS policy is added: this is operator telemetry, not household data. RLS
-- is enabled and left with no policy, so it is fail-closed to every client and
-- reachable only via the service role. household_id is nullable and kept for
-- attribution; it is intentionally ON DELETE SET NULL so cost history survives
-- a household deletion (an aggregate that must outlive the tenant, like
-- deletion_log) without retaining a pointer to a deleted tenant.

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- What was called. `feature` is a stable slug ('extract', 'qa', 'policy',
  -- 'pec-refine', 'embed'); `tier` distinguishes the escalation ladder rungs.
  feature text not null,
  tier smallint,
  model text not null,

  -- What it consumed. Nullable because not every provider reports every field,
  -- and an embeddings call has no output tokens.
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cached_input_tokens integer,
  reasoning_tokens integer,

  -- What it cost, in micro-USD (millionths of a dollar) so exact integer maths
  -- works at the fractions-of-a-cent scale these calls operate at. Sourced from
  -- OpenRouter's usage accounting, not a local price table.
  cost_microusd bigint,

  -- How it went.
  latency_ms integer,
  ok boolean not null default true,

  -- Attribution. All nullable: a failed call may not know its document yet.
  household_id uuid references public.households(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  extraction_id uuid references public.document_extractions(id) on delete set null
);

-- Cost over time, the default operator query.
create index idx_ai_usage_created on public.ai_usage(created_at desc);
-- Spend by household, for per-tenant unit economics and abuse investigation.
create index idx_ai_usage_household on public.ai_usage(household_id, created_at desc);
-- Spend by feature and model, for "where is the money going".
create index idx_ai_usage_feature on public.ai_usage(feature, model, created_at desc);

alter table public.ai_usage enable row level security;

-- Deliberately no policy: fail-closed to anon and authenticated alike. Operator
-- telemetry is read with the service role or from the SQL editor.

comment on table public.ai_usage is
  'Per-call LLM token and cost accounting. Operator telemetry, not household data: RLS on with no policy, service-role only. cost_microusd comes from OpenRouter usage accounting.';
comment on column public.ai_usage.cost_microusd is
  'Exact charge in millionths of a USD, from OpenRouter usage accounting. Null when the provider did not report a cost.';
