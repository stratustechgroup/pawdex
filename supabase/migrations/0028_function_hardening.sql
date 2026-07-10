-- 0028_function_hardening.sql
--
-- Addresses Supabase security-advisor findings surfaced after the 0024-0027
-- push. Two classes of fix, neither changes behavior for the app:
--
-- 1) function_search_path_mutable: five pre-identity invoker functions had no
--    pinned search_path, leaving them open to temp-schema shadowing. Their
--    bodies reference only pg_catalog built-ins (always implicitly searched),
--    schema-qualified tables (public.*), or auth.uid(), so an empty path is
--    safe. Exception: match_extraction_chunks uses the pgvector <=> operator,
--    and unqualified OPERATORS resolve via search_path; the vector extension
--    lives in the "extensions" schema, so that function pins to it.
--
-- 2) *_security_definer_function_executable: default EXECUTE grants exposed
--    definer functions over PostgREST RPC. Trigger and event-trigger
--    functions need no role EXECUTE at fire time (privilege is checked at
--    trigger creation), so they lose all API-role grants. The RLS helper
--    booleans must stay executable by authenticated (policies evaluate them
--    as the querying role), but anon has no policy path that needs them:
--    anon queries now fail closed with a permission error instead of an
--    empty result, which scripts/check-rls.ts already counts as a pass.

-- 1) Pin search_path on invoker functions flagged by the advisor.
alter function public.set_updated_at() set search_path = '';
alter function public.vaccine_family_of(text) set search_path = '';
alter function public.touch_vet_clinic_last_seen() set search_path = '';
alter function public.normalize_phone(text) set search_path = '';
alter function public.match_extraction_chunks(extensions.vector, integer, uuid)
  set search_path = extensions;

-- 2) Trigger + event-trigger functions are never legitimate RPC targets.
revoke execute on function public.sync_animal_from_pet() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_vet_clinic_last_seen() from public, anon, authenticated;

-- 3) RLS helper booleans: authenticated (policy evaluation) and service_role
--    only; anon loses the default PUBLIC grant.
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.has_household_write(uuid) from public, anon;
revoke execute on function public.is_animal_custodian(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.has_household_write(uuid) to authenticated, service_role;
grant execute on function public.is_animal_custodian(uuid) to authenticated, service_role;
