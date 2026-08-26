# Homies Proshop Assistant go-live runbook

This is the operational runbook for the installable Homies Proshop Assistant PWA. The production branch is `main`; Cloudflare Pages publishes the plain Vite output from `dist` to a private `.pages.dev` URL.

## Deployment

- GitHub repository: private repository named `homies-proshop-assistant` (confirm the owner/name before creating or connecting it).
- Cloudflare Pages production branch: `main`.
- Build command: `npm run build:cf`.
- Output directory: `dist`.
- Build environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Never add `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, or any database password to Cloudflare, Vite, source, or logs.
- The existing `npm run build` remains the OpenAI Sites-compatible fallback and is not the Cloudflare build proof.

## Supabase and Auth

Keep the hosted project on the free tier. Set the Supabase Auth Site URL to the final production Pages URL and add only the required Pages preview/production redirect URLs. The approved flow is self-sign-up followed by in-app admin verification. Email confirmation should be off for this design; do not blanket-confirm users. Mark verifies the intended identities, then corrects only those accounts through supported Supabase administration.

The current role policy makes STAFF catalogue/reservations-only. ADMIN is required for sales, payments, product management, and reservation conversion. UI hiding is not permission enforcement: test the direct database writes as STAFF and record the RLS rejection. The existing active admin must be verified before release; do not run first-admin bootstrap SQL while an active admin exists.

Use the strongest password minimum available on the free plan. Leaked-password protection is a documented free-tier limitation if the dashboard reports it unavailable; do not claim it is enabled.

## Release sequence and rollback

1. Run the backup wrapper with local environment variables and store its timestamped output outside Git.
2. Confirm local and hosted migration histories, apply the missing migration through the approved Supabase mechanism, and verify `public.sales.sold_at` defaults to `now()` without rewriting existing timestamps.
3. Run `npm run lint`, `npm run build`, and `npm run build:cf`.
4. Push the release branch and deploy its Cloudflare preview. Verify direct nested-route navigation, sign-in, live reads, manifest, icons, service worker, and standalone behavior.
5. Complete role/Auth and reservation/sale checks, then fast-forward `main` to the verified release commit.
6. Wait for Cloudflare status `succeeded` and verify the final URL independently.

Rollback is a Git release rollback: identify the last known-good commit, create a revert or rollback branch, run the complete verification suite, fast-forward `main` to the reviewed rollback commit, push, and wait for a successful Cloudflare deployment. Do not restore database data as part of an ordinary frontend rollback. Use the backup restore procedure only for confirmed database corruption, in a disposable environment first, with a documented decision and row/object checks.

## Backup and restore

Run from the app repository:

```powershell
$env:SUPABASE_DB_URL = 'local-only database connection string'
$env:SUPABASE_URL = 'https://project-ref.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'local-only service role key'
node scripts/backup.mjs
```

The wrapper writes schema, data, roles, a non-secret manifest, row-count checks, SHA-256 checksums, and private Storage bytes for `avatars` and `product-photos` outside the repository. Keep multiple dated copies off-repo. Restore into disposable local Supabase/Postgres using the current Supabase CLI documentation, then verify key tables, sales rows, checksums, and every Storage object before treating the backup as restorable. Record the restore result in the release evidence. The wrapper intentionally does not print secrets.

The trusted machine runs this weekly without an interactive terminal. The operator checks failures weekly, retains multiple dated backups, and performs a monthly restore drill (or at minimum a documented recurring restore verification). Target a same-day recovery for the app and a separately documented database recovery time after restore validation.

## Installation and onboarding

Phone guide: open the production URL → sign up → add phone/avatar if desired → wait for admin approval → install.

Android/Chromium: open the URL, use the browser's install prompt or browser menu, and confirm the icon appears in the launcher. iPhone/iPad Safari: open the URL, tap Share, choose **Add to Home Screen**, and launch the new icon. Verify standalone mode, icon, and safe-area spacing on both platforms. The app has no offline sales queue; offline mode must not permit sales, reservation conversion, payments, inventory updates, or other database mutation.

Start with Mark plus one Android staff member and one iPhone staff member. After one real shift without blocking issues, onboard the remaining staff. Keep the update prompt user-controlled: a new release should show “New version available — Reload”; never force a reload during a sale.

## Emergency response

If the app is unavailable, capture the Cloudflare deployment status and browser error, then roll back to the last known-good commit. If live data is wrong, stop operational writes, preserve the evidence, and compare the affected rows with the latest backup and stock ledger. If an account appears unauthorized, disable or reject it in Supabase Auth/admin verification, revoke sessions where appropriate, and review RLS evidence before reopening writes. Never use a service-role key in the browser or Cloudflare.
