# Puppy

AI-native pet medical records — upload any vet document (vaccine cert, SOAP note, lab report, invoice) and Puppy keeps your pets' history searchable and on schedule.

Personal use first, multi-tenant from day one so monetization is a flip-the-switch later.

## Stack

- Next.js 16 (App Router, Turbopack) on Vercel
- Supabase (Postgres + Auth + Storage + RLS)
- OpenRouter (`@openrouter/ai-sdk-provider`) → Gemini 2.5 Flash-Lite for extraction
- Resend for transactional email
- shadcn/ui + Tailwind v4

## Phase 1 setup

This branch ships Phase 1 — auth, manual data entry, dashboard. AI extraction lands in Phase 2.

### 1. Provision Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. From **Settings → API**, copy the URL, anon key, and service-role key.
3. Apply the migrations in `supabase/migrations/` in numeric order via the SQL editor or the Supabase CLI:
   ```bash
   pnpm dlx supabase link --project-ref <ref>
   pnpm dlx supabase db push
   ```
4. (Recommended) Regenerate the typed database to replace the hand-authored types:
   ```bash
   pnpm dlx supabase gen types typescript --project-id <ref> > lib/supabase/types.gen.ts
   ```
   Then update `lib/supabase/types.ts` to re-export from `types.gen.ts`.

### 2. Configure auth

In the Supabase dashboard → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (dev) or your production URL
- Redirect URLs: add `http://localhost:3000/auth/callback`

### 3. Local environment

```bash
cp .env.local.example .env.local
# Fill in the Supabase values; OpenRouter / Resend keys are not needed until Phase 2/3.
```

Generate the cron and unsubscribe secrets (Phase 3 will use them):

```bash
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # REMINDER_UNSUBSCRIBE_SECRET
```

### 4. Run the dev server

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Magic-link sign-in via the email you configured on Supabase Auth. After the first login, a household is auto-created and you land on the dashboard.

## Project layout

```
app/
  (app)/            # authenticated app (dashboard, pets, settings)
  login/            # magic-link auth
  auth/callback/    # Supabase OAuth callback
  onboarding/       # post-login household bootstrap
components/ui/      # shadcn primitives
components/         # shared product components (PetCard, etc.)
lib/
  auth/             # session + household resolver, post-login bootstrap
  db/               # typed query helpers
  schemas/          # Zod schemas + form↔payload converters
  supabase/         # server, browser, service-role clients + middleware
proxy.ts            # Next 16 Proxy (formerly middleware) — session refresh
supabase/migrations/
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_storage_policies.sql
scripts/
  check-rls.ts      # RLS smoke test
```

## Verification

After provisioning Supabase and applying the migrations:

```bash
# Type-check
pnpm exec tsc --noEmit

# Build
pnpm build

# RLS smoke test — anon role should see zero pets across households
pnpm dlx tsx scripts/check-rls.ts
```

## Roadmap

See the full architecture plan at `~/.claude/plans/i-want-to-create-immutable-diffie.md`. Phases:

1. ✅ Skeleton + manual data entry (this branch)
2. Document ingestion + Gemini extraction
3. Reminders via Supabase Edge Functions + Resend
4. Polish (weight chart, household sharing, audit log)
5. AI-native differentiators (email forwarding, doc Q&A, longitudinal trends, pre-visit briefing, compliance packet)
6. V1.5 high-ROI features
7. Monetization (Stripe via Vercel Marketplace)
