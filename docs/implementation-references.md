# Implementation references

1. Supabase, **Creating a Supabase client for SSR**: https://supabase.com/docs/guides/auth/server-side/creating-a-client
   - Uses `@supabase/ssr` and separate browser and per-request server clients with cookie storage.
   - In Next.js 16 the session refresh file convention is `proxy.ts` (earlier versions use `middleware.ts`). Refresh token handling must propagate cookie changes to both the request and response and carry cache-prevention headers.
   - Server-side identity checks use verified `supabase.auth.getClaims()`; never trust raw cookies or `getSession()` alone for protected data.
   - Current Next.js public configuration names are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Supabase, **Use Supabase Auth with Next.js**: https://supabase.com/docs/guides/auth/quickstarts/nextjs
   - The App Router SSR quickstart uses cookie-based authentication, TypeScript, Tailwind and the Supabase project URL/publishable key.

This project also applies the Webdev Preview requirement: application session cookies use `SameSite=None; Secure` for public HTTPS Preview; cookie attributes are not selected based on the internal request scheme or `NODE_ENV`.


## Supabase API-key behavior checked during implementation

- Supabase recommends a publishable key in browser/client contexts and a secret key in server-controlled code. Publishable keys authorize `anon` or `authenticated` Postgres roles based on the separate Supabase Auth user JWT; secret keys act as the elevated `service_role` and bypass RLS, so they must stay server-side. Source: https://supabase.com/docs/guides/getting-started/api-keys (accessed 2026-10-10).
- The `GET /rest/v1/` root returns the exposed-schema OpenAPI document and can be rejected for publishable/anon keys. That response does not indicate ordinary table calls are broken. Supabase says ordinary `/rest/v1/<table>` calls remain supported. Source: https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key (published 2026-02-17; accessed 2026-10-10).
- During this build, the configured publishable key returned HTTP 200 from Supabase Auth health and a normal table request reached PostgREST (HTTP 404 because the Phase 1 migration-created table does not exist yet). This was a read-only check. The configured server-side service-role/secret candidate returned HTTP 401 invalid key and requires correction before privileged invitations/profile provisioning can be used.
