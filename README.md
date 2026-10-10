# ALAN.AI

**ALAN.AI** is a unified academic and career companion for college students, faculty and administrators. It brings together the Phase 1 academic workspace with Phase 2 opportunity discovery, learning roadmaps, curated resources, knowledge check-ins, interview practice and an optional AI companion.

## Stack

- Next.js App Router, React, TypeScript and Tailwind CSS
- Supabase Auth, PostgreSQL and row-level security (RLS)
- Server Actions for validated authenticated mutations
- Vitest for business-rule unit tests
- An optional server-side OpenAI-compatible provider for AI-assisted roadmaps and companion responses

The original Phase 2 archive was integrated into the existing application and data/auth model. Its standalone Vite/Express demo authentication and SQLite persistence are intentionally not included.

## Local setup

Requirements: Node.js 20.9+ and pnpm 10.18.0 (the package manager version is pinned).

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

The application is served on `http://localhost:3000`. Create a Supabase project, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supply any elevated Supabase key only as a server-side secret. Never commit `.env.local` or put a secret in a `NEXT_PUBLIC_*` variable.

## Supabase setup

Apply every migration in `supabase/migrations/` in ascending filename order using an isolated Supabase project first. Phase 1 supplies the academic tables, role policies and required server functions; `20261010140000_phase2_career_platform.sql` adds the namespaced career schema, RLS, server-scored assessment procedures, atomic roadmap creation, private conversation persistence and persistent AI-request throttling. Review all RLS policies with student, faculty and administrator test accounts before using live student data.

For safe sample content, apply `supabase/seed_phase2.sql` after the migrations. It contains curated resource links and a sample assessment. The example opportunity rows are expressly **unpublished and unverified**; replace them with current original employer sources, verify them, and only then publish them from `/admin/career`. The seed creates no student accounts and contains no credentials or real student data.

The project’s managed Supabase database was not migrated by this repository build. Apply migrations in the intended Supabase environment before enabling the database-backed career screens. Do not run write tests or seeds against a shared/production database.

### Administrator provisioning

Public registration creates student accounts only. Use a trusted, administrator-controlled provisioning flow to grant faculty/administrator access; never allow a client to set their own role. The existing Phase 1 admin-invitation workflow also requires a valid server-only Supabase administrative credential. If invitations fail, provision the first administrator through the Supabase dashboard or a trusted one-time server procedure, then verify the required RLS role policies.

## AI provider configuration

AI calls run **only on the server**. Configure `ALAN_AI_API_BASE` as an HTTPS OpenAI-compatible API base and optionally `ALAN_AI_MODEL`. Configure the three independent credentials as protected server secrets named `ALAN_AI_API_KEY_1`, `ALAN_AI_API_KEY_2` and `ALAN_AI_API_KEY_3`. The client rotates among available credentials sequentially on provider/network failure; none are returned to a browser, included in logs or committed to Git. The example values in `.env.example` are placeholders only.

Default base/model are `https://api.openai.com/v1` and `gpt-4o-mini`. During this build, each protected key passed a read-only models request and a minimal completion request from the current sandbox. That confirms the tested key/base/model combination there; published-runtime access still depends on those protected settings being present after deployment. A configured key does not guarantee every completion will succeed. If the provider needs a different base path or model, set them through protected server settings. The AI companion limits prompts and output, applies a persistent per-user short-term rate limit, uses a request timeout, and sends saved career preferences only when the student explicitly opts in for that reply. Career advice is educational support, not an official record, policy, or guarantee.

## Product areas

Students have their own academic dashboard, timetable, targeted notices/events, attendance history, in-app notifications, career reflections, verified opportunity bookmarks/application tracking, learning roadmaps, curated-resource bookmarks, private assessment history, interview-practice sessions and private companion conversations. Faculty operations are limited to assigned classes and authorized records. Administrators manage academic structure and settings and may add/verify/publish opportunities. Database RLS and server-side authorization protect records; hiding a UI action is not used as security.

## Commands

```bash
pnpm dev          # development server
pnpm typecheck    # strict TypeScript
pnpm lint         # ESLint
pnpm test         # Vitest business-rule tests
pnpm build        # production build
pnpm start        # production listener; honors PORT
```

## Deployment and current verification boundary

The managed Webdev preview uses port 3000. Configure the server-only Supabase and AI credentials via protected project settings. A green local build does not mean database migrations, provider credentials, production deployment or authenticated user flows have been verified. The currently supplied Supabase project still needs the versioned migrations to be applied; the configured administrative Supabase key may also need replacement before administrator invitations can work. Record the migration result and a safe provider connectivity result before calling the complete live service verified.

See [`docs/phase2-integration-notes.md`](docs/phase2-integration-notes.md), [`plan.md`](plan.md) and [`TODO.md`](TODO.md) for source provenance, architecture, full acceptance criteria and remaining verification.
