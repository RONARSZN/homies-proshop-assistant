# Accounts, Roles, and Admin Verification — Design

**Date:** 2026-08-26
**Branch:** `feat/neo-retro-restyle` (restyle in flight on the same branch)
**Status:** Approved in principle (approach A). Awaiting spec review.

## Problem

The app has three roles (`owner | manager | staff`) seeded by migration, no way to
create an account from the UI, and eleven `using (true)` read policies. It needs
self-signup, an ADMIN approval gate, two roles, and a restricted STAFF experience.

## Decisions taken

| Question | Decision |
|---|---|
| Role collapse | `owner → admin`, `manager → staff`, `staff → staff` |
| Account creation | Self-signup, ADMIN verifies before any access |
| Onboarding collects | Full name, phone, avatar photo |
| Email confirmation | No — ADMIN approval is the only gate |
| Gate mechanism | Approach A: `status` column + NULL role until active |

## The security problem this actually solves

Today every authenticated user can read the entire business. Eleven policies are
`using (true)`: `categories`, `products`, `profiles`, `sales`, `sale_items`,
`stock_movements`, `team_riders`, `rider_allocations`, `sale_payments`,
`reservations`, `reservation_items`.

That is safe only because accounts cannot currently be created. **Opening signup
without changing those policies would let any stranger read the full catalogue,
every sale, all margins, and every staff name directly from the API** — without
ever loading the UI. The gate must live in RLS, not in React.

Separately, `staff` today holds insert rights on `sales`, `sale_items`,
`stock_movements`, and `sale_payments`. Hiding the Sales tab does not remove them.

## Section 1 — Role migration

Create `public.app_role as enum ('admin','staff')`. Add `profiles.role_new`,
backfill by the mapping above, drop `profiles.role`, rename, drop
`public.profile_role`.

Policy rewrites:
- 58 checks of `= 'owner'` become `= 'admin'`
- 34 checks involving `'manager'` become `= 'admin'` — the manager tier disappears,
  so product, photo, and team management become admin-only
- 5 `*_insert_staff` / `*_update_seller_staff` policies on the sales tables narrow
  to `= 'admin'`; reservations keep staff access

`private.current_user_role()` keeps its name and signature so no call site moves.

## Section 2 — The pending gate

`profiles` gains:

| Column | Type | Notes |
|---|---|---|
| `status` | `public.profile_status` `('pending','active','rejected')` not null default `'pending'` | |
| `role` | becomes **nullable** | no role until an admin assigns one |
| `email` | text | copied from `auth.users` by trigger; the verify queue needs it |
| `phone` | text null | collected during onboarding |
| `avatar_path` | text null | object path in the `avatars` bucket |
| `verified_by` / `verified_at` | uuid / timestamptz | audit trail |

**Existing accounts must be backfilled to `active` in the same migration.** Adding
`status not null default 'pending'` to a populated table marks every current row
pending, which would lock out the owner and every working account the moment the
migration lands. The backfill runs in the same transaction as the column add:

```sql
alter table public.profiles add column status public.profile_status not null default 'pending';
update public.profiles set status = 'active';   -- every pre-existing account is already trusted
```

A trigger on `auth.users after insert` creates the profile row as `pending` with
`full_name` read from `raw_user_meta_data`. **There is no self-insert policy on
`profiles`** — the row can only come from the trigger, so a client cannot forge
itself an active admin row.

`private.current_user_role()` returns `role` only when `status = 'active'`,
otherwise NULL. Every existing write policy compares that to a literal, and
`NULL = 'admin'` is NULL, which RLS treats as deny. **All 58 write checks therefore
gate on verification with no rewrite.**

`private.is_active()` returns boolean. The eleven read policies become
`using ((select private.is_active()))`, except `profiles`, which becomes
`using (id = (select auth.uid()) or (select private.is_active()))` so a pending
user can still read their own row — `AuthProvider` depends on that.

## Section 3 — Role changes are admin-only

A `before update` trigger on `profiles` raises unless:
- `role` and `status` are unchanged, **or**
- `private.current_user_role() = 'admin'`

Plus two guards: nobody may change their **own** role or status, and the **last
active admin** cannot be demoted or rejected. The self-update policy is
`using (id = auth.uid())`; the trigger is what restricts which columns move,
since RLS cannot express column-level rules.

This is the rule "all account role changes can be done only by admins", enforced
in the database rather than the UI.

## Section 4 — Signup and onboarding

Signup collects **full name, email, password** together, because
`profiles.full_name` is `not null check (btrim(full_name) <> '')` and the trigger
needs a value at insert. Name is passed through `signUp({ options: { data } })`.

Onboarding then runs as steps against the user's own profile row:
1. Phone number
2. Avatar photo — new `avatars` storage bucket, reusing `downscaleImage()` in
   `src/image.ts` unchanged
3. Pending screen — "waiting for an admin"

Every step is skippable except the name. A pending user can reach only the
onboarding flow, the pending screen, and My Account.

## Section 5 — Verify tab

ADMIN only, surfaced in the More drawer. Lists `profiles where status = 'pending'`
showing avatar, name, email, phone, and requested-at. Each row offers **Approve as
ADMIN**, **Approve as STAFF**, or **Reject**. Approving writes `role`, `status`,
`verified_by`, `verified_at` in one update.

## Section 6 — Navigation

| | ADMIN | STAFF |
|---|---|---|
| Home `/` | Overview | **Inventory** |
| Inventory | yes | yes (read-only) |
| Sales / POS | yes | no |
| Reservations | yes | yes |
| Team | yes | no |
| Notes | yes | yes |
| Settings, Data problems, Export | yes | no |
| Verify | yes | no |
| My Account | yes | yes |

STAFF home is a search field over the catalogue plus a greeting card reading
**"Ano hanap mo?"** and nothing else.

Client-side route guards are UX only. RLS is the real boundary — a STAFF user who
types `/sales` gets a not-found screen, and would get nothing from the API anyway.

**Note:** Notes are `localStorage` (`src/App.tsx`), per-device and not shared.

## Section 7 — My Account

Available to every signed-in account including pending ones. Edits `full_name`,
`phone`, `avatar_path`. Role and status are displayed read-only, with a line
saying only an admin can change them.

## Out of scope

Admin-created accounts (needs an Edge Function and the `service_role` key, which
cannot ship in a Vite client bundle), email confirmation, password reset,
moving Notes into Postgres.
