# ALAN.AI — Integrated Academic and Career Platform Plan

## Scope and architecture

Build the Phase 1 academic-management product and integrate the Phase 2 career package from `JOHN41-tech/ALAN.AI` into one deployable ALAN.AI web application. The initialized project is a Next.js App Router application with strict TypeScript, React, Tailwind CSS, Supabase Auth/PostgreSQL/RLS, and a managed server runtime on port 3000; its managed database capability remains disabled because Supabase is explicitly requested. Preserve Phase 1 academic features, add Phase 2 career, opportunities, roadmap, resources, assessments, mock interview and AI companion features, and do not substitute the standalone package's demo auth, SQLite persistence or Vite runtime.

Use Next.js for the public site, authenticated academic/career shell, role-specific pages, Server Actions/Route Handlers, and server-side business operations. Use `@supabase/supabase-js` and `@supabase/ssr`: separate browser and per-request server clients; refresh auth cookies through the version-appropriate Next.js proxy; validate server identity with verified claims rather than trusting a cookie or client role. Keep the Supabase publishable key browser-safe; the optional service-role key, if used for controlled provisioning, remains server-only. All user data uses authenticated context and database RLS. Assign student roles only during public registration; faculty/admin provisioning uses the trusted admin-controlled path.

The database is normalized and migration-first. Profiles reference Supabase Auth identities and structured academic entities (departments, programs, academic years, semesters, sections and courses). Course enrollments and faculty assignments provide authorization relationships. Recurring `timetable_entries` describe weekly patterns; dated `class_sessions` represent actual meetings and can be changed, substituted or cancelled independently. Attendance is unique by student and dated session, excludes cancelled sessions from conducted counts, and records authorship/correction history. Announcements and their audience targets/read rows, academic events, notifications and administrative audit records remain separate entities. Add foreign keys, checks, uniqueness constraints and indexes for common date, section, subject, audience and user queries. RLS is enabled for exposed tables and reviewed per role. Bulk attendance submission and sensitive corrections use an atomic database function/transaction with assignment validation and an audit trail.

The authoritative attendance calculation is counted attended sessions divided by counted conducted sessions, multiplied by 100. Define treatment of excused absences through an explicit configurable policy; cancelled sessions do not count as conducted. With zero conducted classes, show a clear not-yet-available state. Any future-class estimate is labeled as an estimate, never a guarantee.

Supabase is an explicitly requested external dependency. Protected project settings contain a public URL and publishable key; a prior read-only health check confirmed Auth/PostgREST respond. The required Phase 1/2 tables are not present yet, so migrations remain versioned but unapplied and no external schema writes have been made. The configured server-only elevated key was rejected by the API; administrator invitations will remain unavailable until the user supplies a valid key through protected project settings. Three explicitly supplied AI keys have been accepted into protected project settings as `ALAN_AI_API_KEY_1`, `_2` and `_3`, with a dedicated input-card confirmation. Keep them out of source/logs/Git; use them only server-side in sequential fallback rotation against a configurable OpenAI-compatible API endpoint. All three keys have now passed a read-only model-list request and a minimal completion in this Sandbox environment; production runtime availability remains unverified until publish. Do not replace real product records with fabricated production data.

## Routes and user experiences

- Public: `/` landing page; `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/auth/callback` authentication flows.
- Public visual demonstration: `/preview/dashboard` shows the signed-in student dashboard shell with clearly labeled synthetic data only; it is read-only, never authenticates or writes data, and links back to the real sign-in flow.
- Academic application: `/app` role-aware redirect; `/dashboard`; `/timetable`; `/calendar`; `/announcements` plus `/announcements/[announcementId]`; `/attendance`; `/profile`; `/notifications`.
- Career application: `/career`, `/career/opportunities`, `/career/discovery`, `/career/roadmaps` and `/career/roadmaps/[roadmapId]`, `/career/resources`, `/career/assessments`, `/career/interviews`, and `/career/companion`.
- Faculty: `/faculty/classes` and `/faculty/attendance/[sessionId]` for assigned classes and reviewed attendance submission.
- Administration: `/admin`, `/admin/structure`, `/admin/users`, `/admin/timetable`, `/admin/events`, `/admin/announcements`, `/admin/attendance`, `/admin/settings`, and `/admin/career` for authorized academic, career-listing and audited policy operations.

Protect every private route on the server and enforce permissions again in database RLS and sensitive mutations. The public landing page describes the integrated academic and career scope honestly, distinguishes live/configuration-dependent features, and does not claim provider or opportunity data is available when it is not.

Student pages query only the student’s own profile, sessions, attendance, targeted announcements/events/notifications, career preferences, applications, roadmaps, assessments, interviews and conversations. Faculty pages scope data to assigned/substitute classes; administrators manage academic structure, college settings and verified career opportunities. Career recommendation is a clearly labeled transparent heuristic, sample job records stay unpublished until verified, and curated learning resources carry their real source URLs. Correct assessment keys stay in a protected SQL scoring function. The AI companion and AI roadmap generation call a configurable OpenAI-compatible provider only from the server, rotate the three project-protected keys on provider/network failures, limit requests persistently per account, minimize context and do not send profile data without explicit consent. No client-supplied user ID may scope a mutation. Never give staff access to private student career conversations by default. Avoid describing static mock-interview rubric feedback as an AI evaluation.

## Project structure

- `src/app/`: App Router routes, layouts, loading/error boundaries, route handlers and server actions.
- `src/components/`: shared navigation, responsive shell, accessible form primitives, dialogs, tables, empty/error/loading states and domain presentation components.
- `src/features/auth/`: registration/login/password-reset/callback flows and role-aware access.
- `src/features/dashboard/`, `timetable/`, `calendar/`, `announcements/`, `attendance/`, `profile/`, `notifications/`, `admin/`, `career/`: feature-specific types, schemas, data services, OpenAI-compatible server integration and UI.
- `src/lib/supabase/`: browser/server clients and request-scoped helpers; `src/lib/auth/` for verified identity and authorization; `src/lib/validation/` for shared schemas; `src/lib/errors/` for safe error mapping.
- `src/types/`: application and generated Supabase database types.
- `supabase/migrations/`: versioned schema, constraints, helper functions, RLS and policies.
- `supabase/seed.sql`: repeatable synthetic development records, never real student data or credentials.
- `tests/unit/`, `tests/integration/`, `tests/e2e/`: isolated academic/career business-rule, authorization/data-policy and primary workflow checks.
- `public/manus-routes.json`: exact page route manifest, synchronized with source before the dev server starts and after route changes.
- Root configuration/docs: `app.config.ts`, `.env.example`, `README.md`, this `plan.md`, and `TODO.md`.

## Feature implementation order

1. Set up the Next.js/TypeScript/Tailwind project, pinned package manager/dependencies, diagnostics, route manifest, environment validation and design tokens.
2. Add Supabase browser/server clients, session refresh, authentication forms/callback/reset, profile provisioning safeguards, and server-side role checks.
3. Build the responsive shell and role-based navigation, then public landing page and student/faculty/admin dashboard frames with real configuration/empty states.
4. Create normalized SQL migrations, constraints, RLS/helper functions, generated types and a safe synthetic seed process; implement academic structure management and faculty/enrollment assignments.
5. Implement recurring and dated timetable data, conflict validation, student/faculty views and authorized admin create/edit/deactivate/cancel workflows.
6. Implement targeted academic events and the monthly/weekly calendar.
7. Implement announcement draft/publish/expiry/targeting/search/read workflows and idempotent user-specific in-app notifications.
8. Implement attendance calculation, student reports/history/filters/thresholds/estimates, faculty bulk entry for assigned classes, and authorized admin correction/audit workflows.
9. Integrate Phase 2 through the existing Supabase Auth/profile model: opportunity discovery and owner-only application tracking; heuristic career reflection; AI-generated, validated and persisted roadmaps; curated resources/bookmarks; database-scored private assessment attempts; private persisted interview reflection; and a rate-limited, consent-aware AI companion with server-side key rotation.
10. Integrate all role dashboards, polish responsive/accessibility/loading/empty/error states, validate critical security boundaries, and complete setup/deployment/security documentation and the requested GitHub push.

## Validation approach

Use focused Vitest tests for attendance arithmetic (including zero classes, excused policy and cancelled sessions), timetable time/conflict rules, audience matching, notification idempotency and role guards. Add database policy tests where a configured isolated Supabase test project is available; never run destructive or write tests against a shared/production database. Add Playwright smoke workflows for public navigation, signed-out route protection, student views, faculty submission and admin flows only against isolated test data. Run diagnostics, lint, typecheck, tests and a production build; report each result accurately. Keep checks independent from credentials where possible, but do not claim authenticated/data-backed behavior was verified without a configured Supabase project.

## Deployment and constraints

Deploy as a Next.js server application on the existing managed Webdev server capability, with the project’s declared runtime on port 3000 and an unauthenticated health endpoint. Keep build output and secrets separate; runtime credentials must not be needed during compilation. Configure environment values via protected project secrets, never source files. Provide an `.env.example` containing names and safe placeholder descriptions only. Publish/checkpoint only through the project’s canonical Manus Git workflow; do not enable auto-publish. Successful local/Preview readiness is not a claim of production deployment.

Known prerequisite: live Supabase authentication and database acceptance require an external Supabase project and configured URL/publishable key; any service-role secret is optional and server-only, not used in browser code. The project must explain migration application, initial administrator provisioning, synthetic seed use, test-account setup, production deployment, known unverified paths and Phase 2 extension points.

## Design system

- **Design movement:** editorial campus software—an orderly student workspace with the clarity of a modern academic journal and the utility of a focused SaaS product.
- **Core principles:** data-first; calm but warm; role-aware clarity; direct, accessible interaction.
- **Color philosophy:** warm paper-white surfaces keep long schedules readable; deep midnight ink grounds navigation and typography; an ownable **Campus Cobalt** (`#3157D5`) signals focus and action; restrained amber flags urgency without turning every notice into an alert. Neutral borders and subdued semantic colors maintain contrast and reduce dashboard fatigue.
- **Layout paradigm:** persistent, compact left rail on desktop and a small-screen drawer/bottom-priority navigation on mobile. Use a broad main reading column with a narrow “today / next up” utility rail where space permits rather than equal-width widget grids. In the timetable, use a clear vertical time axis; on small screens, switch to a stacked single column.
- **Signature elements:** a cobalt “course thread” rule connecting schedule items; compact academic context chips for section/semester; thin progress rings for attendance with labeled counts and threshold text.
- **Interaction philosophy:** actions stay close to the data they affect; confirmation is reserved for consequential edits; save states are explicit; filters are keyboard accessible; empty states guide setup without fabricated values.
- **Animation:** 140–180 ms opacity/short translate transitions for menus, drawers and disclosure panels; subtle focus/hover changes; no parallax, pulsing dashboard metrics or blocking entrance animation; respect `prefers-reduced-motion`.
- **Typography:** Geist Sans for UI/body and Geist Mono only for time/identifier micro-labels. Use a restrained type scale: strong page title, medium section headers, readable 14–16 px body, compact but legible metadata.
- **Brand essence:** “Your college day and next chapter, connected.” Personality: clear, steady, encouraging.
- **Brand voice:** practical, optimistic and specific. Example lines: “Your week, with fewer surprises.” “Build momentum one step at a time.” Avoid generic filler, official-record claims or guaranteed outcomes.
- **Wordmark/logo:** an authored `A`-path monogram suggesting an open book and a forward route beside a crisp ALAN.AI wordmark; use an authored SVG mark and compact monochrome variant for the navigation rail.
- **Signature brand color:** Campus Cobalt (`#3157D5`), used consistently for primary actions and active navigation rather than as a decorative wash.
