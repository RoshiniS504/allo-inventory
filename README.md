# Allo Health Inventory Reservation System

## 🚀 Overview
A production‑grade inventory reservation system built with **Next.js 14**, **TypeScript**, **Prisma (PostgreSQL)**, **Upstash Redis**, and **shadcn/ui**.  It provides a race‑condition‑free workflow where a product is held for 10 minutes during checkout, confirmed on successful payment, or automatically released on timeout/failure.

## ✨ Features
- **Atomic row‑level locking** with `SELECT FOR UPDATE` via Prisma transactions – guarantees a single reservation per stock item.
- **Idempotency** powered by Upstash Redis – safe retries for the reservation endpoint.
- **Server‑less ready** – fully deployable on Vercel (including a Vercel Cron for expiration).
- **Typed validation** with Zod – all API inputs are type‑checked.
- **Beautiful UI** using TailwindCSS + shadcn/ui (Card, Button, Badge, Dialog, Sonner toast).
- **CI‑ready** – linting, formatting, and type‑checking are configured out‑of‑the‑box.

## 📦 Tech Stack
| Layer | Technology |
|------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui |
| Backend | Next.js API Routes, Prisma 5.20, Neon PostgreSQL |
| Cache / Idempotency | Upstash Redis (HTTP client) |
| Validation | Zod |
| Deployment | Vercel (incl. `vercel.json` cron) |

## 🛠️ Setup & Development
```bash
# 1️⃣ Clone the repository (or use the existing folder)
git clone https://github.com/your-org/allo-inventory.git
cd allo-inventory

# 2️⃣ Install dependencies
npm ci   # exact versions as defined in package‑lock

# 3️⃣ Create a .env.local (copy from .env.example)
cp .env.example .env.local
#    - Fill in YOUR_NEON_DATABASE_URL, UPSTASH_REDIS_REST_URL and TOKEN

# 4️⃣ Push the Prisma schema to Neon
npx prisma migrate dev --name init

# 5️⃣ Seed the database with sample data
npx prisma db seed   # runs prisma/seed.ts

# 6️⃣ Run the dev server
npm run dev   # http://localhost:3000
```

## 📜 API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| **GET** | `/api/products` | List all products with availability |
| **POST** | `/api/reservations` | Reserve stock – idempotent (requires `idempotencyKey`) |
| **GET** | `/api/reservations/[id]` | Fetch reservation status |
| **POST** | `/api/reservations/[id]/confirm` | Mark reservation as paid → finalize |
| **POST** | `/api/reservations/[id]/release` | Manually release a hold |
| **GET** | `/api/cron/expire-reservations` | Vercel cron (runs every minute) – releases stale holds |

All request bodies are validated with Zod schemas located in `src/lib/schemas.ts`.

## 🎨 UI Walkthrough
- **Home page** (`/`) – product catalog with real‑time availability badges.
- **Reservation modal** – click *Reserve* to hold stock for 10 min, shows a countdown timer.
- **Checkout page** (`/reservation/[id]`) – confirms payment or releases automatically after timeout.

## 📦 Scripts
| Script | Description |
|--------|-------------|
| `dev` | Starts Next.js dev server |
| `build` | Generates the production build |
| `start` | Starts the built app (Node) |
| `lint` | Runs ESLint |
| `format` | Runs Prettier |
| `prisma:generate` | Generates Prisma client |
| `prisma:seed` | Executes `prisma/seed.ts` |

## 🚀 Deployment
Simply push to the `main` branch on Vercel or run:
```bash
vercel --prod
```
The included `vercel.json` configures a **cron job** (`* * * * *`) that invokes the expiration endpoint every minute.

## 🧪 Testing
> *(Add your test suite here – e.g., Jest + React Testing Library)*

## 📚 Further Reading
- **Concurrency** – see `src/app/api/reservations/handler.ts` for the `SELECT FOR UPDATE` transaction.
- **Idempotency** – see `src/lib/redis.ts` for the Upstash wrapper.
- **Zod schemas** – located in `src/lib/schemas.ts`.

---
*Happy coding!*
