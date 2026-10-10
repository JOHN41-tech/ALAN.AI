# Phase 2 source and integration notes

## Source

- Requested source repository: [JOHN41-tech/ALAN.AI](https://github.com/JOHN41-tech/ALAN.AI)
- Source README and package: `phase2-career-platform/README.md`, `phase2-career-platform/package.json`
- Source client: `phase2-career-platform/src/main.tsx`
- Source API: `phase2-career-platform/server/index.js`
- Source schema draft: `phase2-career-platform/supabase/migrations/202610100001_phase2_foundation.sql`
- Source tests: `phase2-career-platform/tests/core.test.ts`

The source repo package contains a supplied Phase 2 archive; its standalone code was inspected but is not copied as a second Vite/Express application. The merged product is a single Next.js App Router application using Phase 1 Supabase Auth, profiles, Postgres and RLS.

## Preserved product capabilities

The integration includes student opportunity discovery, owner-only saves and application tracking; career-discovery preferences with transparent heuristic recommendations; persistent AI-generated learning roadmaps and milestone progress; curated resources and private bookmarks; server-scored quizzes with private attempt history; persisted mock interview sessions; and a private AI study/career companion with persisted conversation history.

## Security and operations changes

- Phase 1's authenticated `profiles.id` remains the owner key; no demo login, HMAC cookie, SQLite database, duplicate Express server or browser AI credential is introduced.
- The Phase 2 migration `supabase/migrations/20261010140000_phase2_career_platform.sql` namespaces its tables, enables RLS, scopes private records to `auth.uid()`, withholds correct-answer columns from direct client access, scores only in a database function, binds AI rate limits to the authenticated user, and persists chat turns atomically.
- AI credentials are supplied only by protected project settings under the three names documented in `.env.example`; the provider makes server-to-server HTTPS requests and rotates through the available keys sequentially on failure. The endpoint/model are configurable without placing credentials in source.
- All three protected keys passed a read-only model-list request and a minimal completion from this Sandbox during integration. Published-runtime availability still depends on the same protected configuration being present after deployment.
- Opportunity seed rows are intentionally unpublished, unverified placeholders. A college administrator must independently check an original employer source and explicitly mark a listing verified before publishing it.
- Run the Phase 2 migration followed by `supabase/seed_phase2.sql` to enable seeded resources and the sample assessment. These commands are not run against the shared managed database as part of code verification.

## Known boundary

The archive's fake/demo auth and standalone server were not retained. Phase 2 uses the already established Phase 1 role model, login and account provisioning. AI tool use is bounded by per-user database rate limiting, request/output lengths, a timeout and a provider-key fallback cycle. The model remains an external dependency and may be unavailable even when keys exist.
