# TODO - Rebuild missing Next.js + Prisma (5.20.0)

- [ ] Inspect existing repository structure (README/prisma schema/seed) and confirm current dependencies expectations.
- [ ] Create/introduce project scaffolding needed for Next.js App Router (`src/app/...`, `src/lib/...`).
- [ ] Update Prisma client + schema compatibility to Prisma **5.20.0** (old `datasource db url = env("DATABASE_URL")` syntax already present).
- [ ] Implement Prisma helper (`src/lib/prisma.ts`) and Upstash Redis wrapper (`src/lib/redis.ts`).
- [ ] Implement Zod schemas (`src/lib/schemas.ts`).
- [ ] Implement API routes with transactions + `SELECT FOR UPDATE` and idempotency keys.
- [ ] Implement UI pages using Tailwind + shadcn/ui + Sonner toast (layout, home, reservation checkout).
- [ ] Ensure build passes: run `npm install`, `npx prisma generate`, `npm run build`.
- [ ] Run `npm run prisma:seed` (or `npx prisma db seed`) to validate DB connectivity.

