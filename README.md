# Allo Inventory Reservation System

## Live URL
https://allo-inventory-umber.vercel.app

## GitHub Repository
https://github.com/RoshiniS504/allo-inventory

---

## Local Setup

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) account (free) — hosted Postgres
- An [Upstash](https://upstash.com) account (free) — serverless Redis

### Steps

1. Clone the repo:
```bash
   git clone https://github.com/RoshiniS504/allo-inventory.git
   cd allo-inventory
```

2. Copy `.env.example` to `.env.local` (and `.env` for Prisma CLI):
```bash
   cp .env.example .env.local
   cp .env.example .env
```

3. Fill in the following variables in both files:
```env
   DATABASE_URL="postgresql://USER:PASS@HOST/DB?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://USER:PASS@HOST/DB"
   UPSTASH_REDIS_REST_URL="https://YOUR-URL.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="YOUR-TOKEN"
   CRON_SECRET="any-random-secret-string"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
   > `DATABASE_URL` uses the pooled Neon connection string. `DIRECT_URL` uses the
   > direct (non-pooled) string — required for Prisma migrations.

4. Install dependencies:
```bash
   npm install
```

5. Generate the Prisma client:
```bash
   npx prisma generate
```

6. Apply database migrations:
```bash
   npx prisma migrate dev --name init
```

7. Seed the database (products, warehouses, stock levels, one active reservation):
```bash
   npx prisma db seed
```

8. Start the development server:
```bash
   npm run dev
```
   Open [http://localhost:3000](http://localhost:3000).

---

## How the Expiry Mechanism Works in Production

The system uses a two-layer approach so that stock counts are always accurate
and the database stays clean.

**Layer 1 — Lazy cleanup on read (always active):**
`GET /api/products` calculates `availableUnits` by only counting `PENDING`
reservations where `expiresAt > NOW()`. Expired reservations are invisible to
the available count immediately — no background job is needed for reads to be
accurate. Even if the cron is delayed, customers never see falsely depleted stock.

**Layer 2 — Vercel Cron (every minute):**
`vercel.json` schedules `GET /api/cron/expire-reservations` every minute.
This route finds all `PENDING` reservations past their `expiresAt`, updates them
to `RELEASED`, and decrements `stock.reservedUnits` accordingly. This keeps the
database clean and `reservedUnits` numerically correct long-term.

The endpoint is secured via the `Authorization: Bearer <CRON_SECRET>` header.
Vercel injects this automatically on each scheduled invocation.

---

## Concurrency Approach

The naive pattern — read available stock, check if enough, then create the
reservation — has a race condition. Two simultaneous requests can both read
"1 unit available", both pass the check, and both succeed. One customer gets
a refund; ops cleans up manually.

This system guarantees correctness using a **PostgreSQL row-level lock** inside
a transaction:

1. A database transaction is started for each reservation request.
2. The stock row is queried with `SELECT * FROM "Stock" WHERE id = $1 FOR UPDATE`.
   This acquires a row-level lock on that specific row.
3. If a concurrent request targets the same stock row, PostgreSQL blocks the second
   transaction at the `FOR UPDATE` read until the first transaction commits or aborts.
4. When the first transaction commits, the second is unblocked. It re-reads the
   already-updated `reservedUnits`.
5. If the remaining units are now insufficient, it throws a business error and
   returns `409 Conflict`.

This guarantees exactly one winner for the last unit — no distributed locks
(e.g. Redlock) needed at the application layer. Correctness comes from the
database engine itself.

---

## Idempotency Key Implementation (Bonus)

`POST /api/reservations` accepts an optional `Idempotency-Key` header.

1. Before any database work, the server checks Upstash Redis for a cached
   response at `idempotency:<key>`.
2. If found, the cached response body and status code are returned immediately —
   no side effects repeat.
3. If not found, the request proceeds through Zod validation and the transactional
   reservation logic.
4. On any terminal response — `201` success **or** `409` stock conflict — the
   response is cached in Redis for 24 hours.

Caching `409` responses is intentional: if a request legitimately failed because
stock was insufficient, retrying with the same key should get the same failure,
not a fresh attempt. This protects against network-disconnect retries creating
duplicate inventory holds.

---

## Trade-offs and What I'd Add With More Time

- **Real-time updates**: Replace the 30-second SWR polling interval with
  WebSockets or Server-Sent Events so stock counts update instantly across
  all open browser tabs when a reservation is made or expires.
- **Distributed locking**: Add Upstash Redlock for correctness across
  multi-region Postgres deployments. The current `SELECT FOR UPDATE` approach
  is correct within a single Postgres primary but does not extend across
  globally distributed read replicas.
- **Authentication**: Integrate NextAuth.js or Clerk so reservations are tied
  to authenticated user sessions. Currently any client can confirm or release
  any reservation by ID.
- **Order history**: Build a user-facing portal showing active reservations
  and past purchases.
- **Confirmation webhooks**: Trigger downstream shipping or email confirmation
  services immediately on payment confirmation.
- **Rate limiting**: Add token-bucket rate limiting on `POST /api/reservations`
  per IP to prevent abuse.
- **Automated concurrency tests**: A k6 or Artillery script that fires 50
  simultaneous requests for the last available unit and asserts exactly one
  succeeds — to verify the `SELECT FOR UPDATE` guarantee under real load.
