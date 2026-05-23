# Allo Inventory Reservation System

## Live URL
[https://allo-inventory.vercel.app](https://allo-inventory.vercel.app)

## Local setup
1. Clone the repo:
   ```bash
   git clone https://github.com/RoshiniS504/allo-inventory.git
   cd allo-inventory
   ```
2. Copy `.env.example` to `.env.local` (and `.env` for Prisma CLI) and fill in the connection details:
   ```bash
   cp .env.example .env.local
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
5. Apply database migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
6. Seed the database with initial products, warehouses, stock, and reservations:
   ```bash
   npx prisma db seed
   ```
7. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

Services needed: Neon (free Postgres), Upstash (free Redis)

## How the expiry mechanism works in production
The system uses a **two-layer expiration approach** to handle reservation releases:
- **Lazy cleanup (Layer 1)**: The calculation of `availableUnits` in `GET /api/products` filters out any `PENDING` reservations where `expiresAt <= NOW()`. Even if the database has not yet been cleaned up by a cron job, users browsing the catalog will see 100% accurate real-time stock numbers.
- **Vercel Cron (Layer 2)**: A cron job runs every minute (configured via `vercel.json` pointing to `/api/cron/expire-reservations`) to identify expired reservations, update their status to `RELEASED`, and release (decrement) the reserved units back to available stock. This endpoint is secured using a `CRON_SECRET` checked via the standard `Authorization` header.

## Concurrency approach
The naive reservation pattern (read available stock → check if there is enough → create reservation) contains a race condition: two concurrent users could see "1 unit left" at the same time and both complete the checkout, resulting in overselling.

This system guarantees correctness using a **Neon/PostgreSQL row-level lock** inside a transaction:
1. When a reservation request comes in, a database transaction is started.
2. We query the stock row using `SELECT * FROM "Stock" WHERE id = $1 FOR UPDATE`. This locks the row for modifications.
3. If a concurrent request comes in for the same stock row, PostgreSQL blocks the second transaction at the `FOR UPDATE` read until the first transaction either commits or aborts.
4. When the first transaction commits, the second transaction is unblocked. It re-reads the updated `reservedUnits` value.
5. If the remaining units are insufficient, it immediately throws a business error, returning a `409 Conflict`.
This ensures correctness under concurrent request volumes without requiring complex distributed locks (like Redlock) at the app layer.

## Idempotency key implementation (bonus)
Clients submit an `Idempotency-Key` header with `POST /api/reservations`.
1. The server checks Upstash Redis for a cached response with key `idempotency:<idempotencyKey>`.
2. If it exists, the cached response body and status code (such as `201` or `409`) are returned immediately.
3. If it does not exist, the server proceeds with the Zod validation and transactional reservation logic.
4. On terminal completion (success `201` OR `409` stock conflict), the JSON response and status code are cached in Redis for 24 hours.
This protects against network disconnect retries causing duplicate inventory reservations.

## Trade-offs and what I'd add with more time
- **Real-time Updates**: Implement WebSockets or Server-Sent Events (SSE) to push stock updates to all open client browser windows as reservations are made or expire.
- **Distributed Locks**: Use Upstash Redlock to manage inventory constraints if deploying across multiple globally-distributed write-replicas.
- **Session Auth**: Integrate NextAuth.js/Clerk to tie reservations to authenticating users.
- **Order History**: Build a customer portal containing current active reservations and checkout history.
- **Confirmation Webhooks**: Set up webhooks to trigger downstream shipping or email confirmation services immediately upon payment confirmation.
- **API Rate Limiting**: Implement token-bucket rate limiting on the `/api/reservations` endpoint.
