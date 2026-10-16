# LUMA backend

## Setup

1. Copy `.env.example` to `.env` and set the project's PostgreSQL `DATABASE_URL`.
2. Set `PAYMENT_VERIFICATION_TOKEN` to a long random secret. Payment verification and reversal of a verified payment are disabled until this secret is configured.
3. Run `npm install` to generate the Prisma client, then `npm run dev`.

Apply reviewed migrations with `npm exec -- prisma migrate deploy` from this directory. Do not use `migrate reset` on a database with application data.

## Payment verification limitation

The application currently has no user accounts, roles, or identity provider. The shared server-side token protects verification actions and is requested through SweetAlert2 for each action. It is not a per-user authorization system, so the history records the action and timestamp but cannot identify an individual verifier. Keep the token server-side and provide it only to authorized staff. A future authentication system should replace this shared-secret workflow and record an authenticated user ID.
