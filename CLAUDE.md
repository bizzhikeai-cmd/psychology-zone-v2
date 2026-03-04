# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Psychology Zone — a serverless online therapy booking platform built with Astro SSR, deployed on Vercel. Customers book therapy sessions via Razorpay payments, receive confirmations via email (Resend) and WhatsApp (Interakt), and admins manage bookings through a protected dashboard.

## Commands

```bash
npm run dev              # Start dev server at localhost:4321
npm run build            # Production build
npm run preview          # Preview production build locally
npx astro check          # TypeScript type checking (no test framework)
npm run validate-env     # Validate .env variables before deploying
npm run health-check     # Check production health (/api/health)
npm run health-check:local  # Check local dev server health
npm run sync-env         # Sync .env to Vercel environment variables
npm run sync-env:dry-run # Preview what sync would change
```

## Architecture

**Stack:** Astro 5 (SSR, `output: 'server'`) + Tailwind CSS + TypeScript (strict) + Vercel adapter

**Routing:** File-based in `src/pages/`. Pages are `.astro` files; API routes are `.ts` files under `src/pages/api/`.

### Key directories

- `src/pages/` — Routes: landing pages, booking confirmation, admin dashboard, legal pages
- `src/pages/api/` — API endpoints: payment (create-order, verify-payment), admin CRUD, cron jobs
- `src/pages/api/cron/` — Vercel cron jobs: `abandoned-cart` (daily 10AM), `session-reminders` (daily 4:30AM)
- `src/components/` — `BookingForm.astro` (multi-step form + Razorpay JS), `PricingSection.astro`, `WhyChooseSection.astro`
- `src/lib/` — Service modules: `supabase.ts` (DB client + booking CRUD), `razorpay.ts`, `email.ts` (Resend), `interakt.ts` (WhatsApp), `auth.ts` (HMAC session tokens), `cookies.ts`, `preferences.ts`
- `src/layouts/Layout.astro` — Base HTML wrapper with GTM, meta tags
- `database/` — SQL migration files (run manually against Supabase)
- `scripts/` — Node.js utilities: env validation, Vercel sync, health checks, secret detection

### Booking flow

1. Customer selects package on landing page → `BookingForm.astro` collects details
2. `POST /api/create-order` creates Razorpay order + inserts pending booking in Supabase
3. Razorpay checkout opens in browser; on success → `POST /api/verify-payment` verifies HMAC signature
4. On verified: updates booking status, sends confirmation email + WhatsApp to customer and admin
5. Customer redirected to `/booking-confirmed?ref=PZ-YYYY-XXXX`
6. Cron jobs handle abandoned cart recovery (2-stage: 30min + 4hr) and 24h session reminders

### Admin authentication

HMAC-signed session tokens (no DB sessions — serverless-safe). Password checked against `ADMIN_PASSWORD` env var, token stored in HttpOnly cookie with 24h expiry. Uses meta-refresh redirects (not 302) to work around Vercel cookie issues. See `src/lib/auth.ts`.

### Database

Supabase PostgreSQL with Row-Level Security. Single main table `bookings` with fields for customer info, payment (Razorpay IDs, amount in paise), package details, session status, and cart recovery tracking. Direct client via `@supabase/supabase-js` — no ORM. Booking refs follow `PZ-YYYY-XXXX` format (nanoid).

### Pricing packages

- STARTER: ₹799 / 1 session
- POPULAR: ₹1,647 / 3 sessions
- PREMIUM: ₹2,495 / 5 sessions

Amounts are stored in paise (multiply by 100) for Razorpay.

## Deployment

**Three-tier branch strategy:**
- `main` → Production (https://book.psychologyzone.in)
- `staging` → Preview
- `feature/*` → Preview

PRs to `main` trigger GitHub Actions: env validation, build check, type check, security audit, bundle size check. Husky pre-commit hook runs `scripts/check-secrets.cjs` to prevent secret leaks.

## Environment Variables

Required: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `INTERAKT_API_KEY`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `SITE_URL`, `ADMIN_WHATSAPP_NUMBER`, and Interakt template names. Run `npm run validate-env` to check format requirements (e.g., Razorpay keys must start with `rzp_test_` or `rzp_live_`, Supabase keys are JWTs starting with `eyJ`).

## Conventions

- All components are Astro `.astro` files (no React/Vue/Svelte)
- Tailwind custom theme: cream (#F8F5F0), sage (#6B8E7B), orange (#D35400); fonts: Inter (sans), Lora (serif)
- API routes return JSON with consistent `{ success, error?, data? }` shape
- Environment variables are trimmed at read time to prevent newline corruption from Vercel
- Landing pages (`online-*-therapy.astro`) share the same booking form component with different `pageSource` props
- Currency amounts use paise (integer) — never floating-point rupees
