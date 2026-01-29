# Psychology Zone - Online Therapy Booking Platform

Professional booking platform for Psychology Zone's online therapy sessions. Built with Astro 5, deployed on Vercel with Supabase backend.

## Quick Links

- **Production:** https://book.psychologyzone.in
- **Vercel Dashboard:** https://vercel.com/bizzhikemedia/psychology-zone-v2
- **GitHub Repository:** https://github.com/bizzhikeai-cmd/psychology-zone-v2

---

## Table of Contents

1. [Deployment Workflow](#deployment-workflow)
2. [Health Monitoring](#health-monitoring)
3. [Environment Setup](#environment-setup)
4. [Development](#development)
5. [Emergency Procedures](#emergency-procedures)
6. [Architecture](#architecture)

---

## Deployment Workflow

### Overview

We use a **3-tier deployment strategy** to ensure safety:

```
Feature Branch → Staging → Production
     ↓              ↓           ↓
  Preview       Preview      Live Site
   (test)      (staging)   (customers)
```

### Branch Structure

| Branch | Environment | Auto-Deploy | URL | Purpose |
|--------|-------------|-------------|-----|---------|
| `main` | Production | ✅ Yes | https://book.psychologyzone.in | Live customer site |
| `staging` | Preview | ✅ Yes | Vercel preview URL | Final testing before production |
| `feature/*` | Preview | ✅ Yes | Vercel preview URL | Individual feature development |

### Safe Deployment Process

**IMPORTANT:** Never push directly to `main`. All changes must go through Pull Requests.

#### 1. Create Feature Branch

```bash
# Start from staging (always up-to-date with production)
git checkout staging
git pull origin staging

# Create your feature branch
git checkout -b feature/your-feature-name
```

#### 2. Develop & Test Locally

```bash
# Install dependencies
npm install

# Validate environment variables
npm run validate-env

# Start dev server
npm run dev
```

#### 3. Push to Get Preview Deployment

```bash
git add .
git commit -m "Your descriptive commit message"
git push origin feature/your-feature-name
```

**Vercel will automatically create a preview deployment.**

- Check deployment status: https://vercel.com/bizzhikemedia/psychology-zone-v2
- Test thoroughly on the preview URL before proceeding

#### 4. Merge to Staging

```bash
# Merge feature to staging for final testing
git checkout staging
git merge feature/your-feature-name
git push origin staging
```

**Vercel deploys staging automatically.**

- Test the full booking flow on staging URL
- Verify admin panel works
- Check email notifications
- Test payment integration (if changed)

#### 5. Deploy to Production (via Pull Request)

```bash
# Create Pull Request from staging → main
# Go to: https://github.com/bizzhikeai-cmd/psychology-zone-v2/compare/main...staging
```

**In the PR:**
1. Describe what changed and why
2. Confirm staging testing is complete
3. Request review (if team member available)
4. Merge PR → **Production deployment happens automatically**

#### 6. Verify Production

After merge to `main`:

```bash
# Run automated health check (recommended)
npm run health-check

# Or manually check health endpoint
curl https://book.psychologyzone.in/api/health

# Monitor Vercel logs for errors
vercel logs https://book.psychologyzone.in
```

**Expected output:**
```
✅ Overall Status: HEALTHY
✅ Database (Supabase): OK - Connected (150ms)
✅ Email (Resend): OK - API key configured
✅ Payment (Razorpay): OK - Credentials configured
✅ WhatsApp (Interakt): OK - API key configured
✨ All systems operational!
```

**If anything breaks:** See [Emergency Rollback](#emergency-rollback)

---

## Health Monitoring

The application includes automated health checks to verify all critical services are operational.

### Health Check Endpoint

**URL:** `https://book.psychologyzone.in/api/health`

The health endpoint checks:
- ✅ **Database (Supabase)** - Verifies connection and query performance
- ✅ **Email (Resend)** - Validates API key format and detects corruption
- ✅ **Payment (Razorpay)** - Checks credentials are configured correctly
- ✅ **WhatsApp (Interakt)** - Validates API key

**Response Format:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T10:00:00.000Z",
  "services": {
    "database": {
      "status": "ok",
      "message": "Connected",
      "responseTime": 150
    },
    "email": {
      "status": "ok",
      "message": "API key configured"
    },
    "payment": {
      "status": "ok",
      "message": "Credentials configured"
    },
    "whatsapp": {
      "status": "ok",
      "message": "API key configured"
    }
  },
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - All services healthy
- `503` - One or more services degraded or down

**Service Status Values:**
- `ok` - Service operational
- `degraded` - Service has issues but may still function
- `down` - Service unavailable

### Running Health Checks

#### Production Health Check

```bash
# Check production services
npm run health-check

# Output shows:
# ✅ Overall Status: HEALTHY
# ✅ Database (Supabase): OK - Connected (150ms)
# ✅ Email (Resend): OK - API key configured
# ✅ Payment (Razorpay): OK - Credentials configured
# ✅ WhatsApp (Interakt): OK - API key configured
```

#### Local Development Health Check

```bash
# Start dev server first
npm run dev

# In another terminal, check local health
npm run health-check:local
```

#### Custom URL Health Check

```bash
# Check any environment
node scripts/health-check.cjs https://your-preview-url.vercel.app
```

### Health Check Script Exit Codes

The health check script returns different exit codes for automation:

- `0` - All services healthy (success)
- `1` - One or more services degraded/down
- `2` - Health check failed (network error, endpoint unreachable)

**Example in CI/CD:**

```bash
# Run health check after deployment
npm run health-check
if [ $? -ne 0 ]; then
  echo "❌ Health check failed! Consider rollback."
  exit 1
fi
```

### When to Run Health Checks

**After every deployment:**
```bash
# 1. Deploy to production (via PR merge)
# 2. Wait 30 seconds for deployment to stabilize
# 3. Run health check
npm run health-check
```

**During debugging:**
```bash
# Check if services are configured correctly
npm run health-check

# If any service shows "degraded" or "down":
# - Check environment variables in Vercel dashboard
# - Look for newlines or corruption in API keys
# - Verify service credentials are correct
```

**For monitoring (optional):**
```bash
# Set up cron job to check health every 5 minutes
*/5 * * * * cd /path/to/project && npm run health-check
```

### Common Health Check Issues

#### Database Shows "down"
- Check Supabase service status
- Verify SUPABASE_URL and keys are correct
- Check if Supabase project is paused

#### Email Shows "degraded" - Corrupted API Key
```bash
# This means RESEND_API_KEY has newlines/whitespace
# Fix by re-adding the key:
printf "re_your_key_here" | vercel env add RESEND_API_KEY production
vercel --prod --yes  # Redeploy
```

#### Payment Shows "degraded" - Invalid Key Format
- Check RAZORPAY_KEY_ID starts with `rzp_live_` or `rzp_test_`
- Verify RAZORPAY_KEY_SECRET is at least 20 characters

#### WhatsApp Shows "down"
- Check INTERAKT_API_KEY is set in Vercel
- Verify your Interakt plan is active

### Health Check Features

**✅ Detects Environment Variable Corruption**

The health check automatically detects common issues like:
- Newline characters in API keys (major cause of failures)
- Whitespace corruption
- Invalid key formats
- Missing credentials

**Example:**

```bash
npm run health-check

# If RESEND_API_KEY has a newline:
# ⚠️  Email (Resend): DEGRADED - API key corrupted (contains newlines or whitespace)
```

**✅ Color-Coded Terminal Output**

- 🟢 Green = Healthy
- 🟡 Yellow = Degraded (warning)
- 🔴 Red = Down (critical)

**✅ Response Time Tracking**

See how long each service takes to respond:
```
✅ Database (Supabase): OK - Connected (150ms)
```

---

## Environment Setup

### Required Environment Variables

All environment variables must be set in Vercel Dashboard for each environment.

**Critical Variables:**

```bash
# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_live_xxxx          # Production: live keys
RAZORPAY_KEY_SECRET=xxxx               # Staging: use test keys (rzp_test_)

# Supabase Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...

# Resend Email Service
RESEND_API_KEY=re_xxxx                 # Must start with re_

# Interakt WhatsApp API
INTERAKT_API_KEY=xxxx
INTERAKT_CUSTOMER_TEMPLATE=appointment_confirmation
INTERAKT_ADMIN_TEMPLATE=new_booking_admin
INTERAKT_ABANDONED_TEMPLATE=booking_reminder
ADMIN_WHATSAPP_NUMBER=918968900002     # No + or spaces

# Admin Dashboard
ADMIN_PASSWORD=xxxx                    # Min 8 chars, no spaces
ADMIN_EMAIL=admin1@example.com,admin2@example.com

# Google Tag Manager (optional)
GTM_CONTAINER_ID=GTM-XXXXXXX

# Site Configuration
SITE_URL=https://book.psychologyzone.in  # No trailing slash
```

### Setting Environment Variables

**Option 1: Vercel Dashboard (Recommended)**

1. Go to: https://vercel.com/bizzhikemedia/psychology-zone-v2/settings/environment-variables
2. Add/edit variables
3. Select environments:
   - ☑ Production (for main branch)
   - ☑ Preview (for staging + feature branches)
   - ☑ Development (for local)

**Option 2: Safe Sync from .env File**

```bash
# FIRST: Validate your .env file locally
npm run validate-env

# If validation passes:
npm run sync-env:dry-run    # Preview changes
npm run sync-env            # Apply to Vercel
```

**The sync tool automatically:**
- Validates all variables
- Removes newlines/corruption
- Shows diff before applying
- Confirms before syncing

---

## Development

### Prerequisites

- Node.js 20.x or higher
- npm or pnpm
- Vercel CLI (optional): `npm i -g vercel`

### Local Development

```bash
# Clone repository
git clone https://github.com/bizzhikeai-cmd/psychology-zone-v2.git
cd psychology-zone-v2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Fill in your local .env with actual values
# Get them from Vercel Dashboard or team lead

# Validate environment variables
npm run validate-env

# Start development server
npm run dev
```

Visit: http://localhost:4321

### Available Scripts

```bash
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview                # Preview production build
npm run validate-env           # Validate .env file
npm run validate-env:prod      # Validate .env.production
npm run sync-env               # Sync .env to Vercel
npm run sync-env:dry-run       # Preview sync changes
npm run health-check           # Check production health
npm run health-check:local     # Check local dev server health
```

### Admin Panel Access

**Local Development:**
- URL: http://localhost:4321/admin/login
- Password: Value from your local `ADMIN_PASSWORD` env var

**Production:**
- URL: https://book.psychologyzone.in/admin/login
- Password: Production `ADMIN_PASSWORD` (get from team lead)

---

## Emergency Procedures

### Emergency Rollback

**If production is broken RIGHT NOW:**

#### Option 1: Vercel Dashboard (Fastest)

1. Go to: https://vercel.com/bizzhikemedia/psychology-zone-v2/deployments
2. Find the last **green checkmark** deployment before the broken one
3. Click "..." menu → **"Promote to Production"**
4. Confirm → Site rolls back in ~30 seconds

#### Option 2: CLI

```bash
# List recent deployments
vercel ls --prod

# Rollback to specific deployment
vercel rollback <deployment-url>
```

#### Option 3: Git Revert

```bash
# Revert the bad commit on main
git checkout main
git revert HEAD
git push origin main

# Vercel auto-deploys the revert
```

### Verify Rollback Worked

```bash
# Check if site is responding
curl https://book.psychologyzone.in/

# Check admin panel
curl https://book.psychologyzone.in/admin/login/

# Verify no errors
vercel logs https://book.psychologyzone.in
```

### After Rollback

1. **Notify team** - Alert in team chat that production was rolled back
2. **Investigate** - Check Vercel logs to find what broke
3. **Fix on feature branch** - Never fix directly on main
4. **Test on staging** - Thoroughly test the fix
5. **Redeploy via PR** - Follow normal workflow

---

## Architecture

### Tech Stack

- **Framework:** Astro 5.16.6
- **Hosting:** Vercel (serverless)
- **Database:** Supabase (PostgreSQL)
- **Payment:** Razorpay
- **Email:** Resend
- **WhatsApp:** Interakt
- **Analytics:** Google Tag Manager

### Key Features

- ✅ Online therapy session booking
- ✅ Razorpay payment integration (₹499 consultation fee)
- ✅ WhatsApp notifications (customer + admin)
- ✅ Email confirmations
- ✅ Admin dashboard for booking management
- ✅ Abandoned cart recovery (daily cron)
- ✅ Session reminders (daily cron)
- ✅ Feedback collection (after session completion)

### Project Structure

```
psychology-zone-v2/
├── src/
│   ├── pages/              # Astro pages (routes)
│   │   ├── index.astro     # Homepage
│   │   ├── book.astro      # Booking form
│   │   ├── success.astro   # Payment success
│   │   ├── admin/          # Admin dashboard
│   │   └── api/            # API endpoints
│   ├── lib/                # Business logic
│   │   ├── supabase.ts     # Database client
│   │   ├── email.ts        # Email service (Resend)
│   │   ├── interakt.ts     # WhatsApp service
│   │   ├── razorpay.ts     # Payment processing
│   │   └── auth.ts         # Authentication utilities
│   ├── layouts/            # Page layouts
│   └── components/         # Reusable components
├── scripts/                # Utility scripts
│   ├── validate-env.cjs    # Environment validation
│   ├── sync-env-to-vercel.cjs  # Vercel sync tool
│   └── health-check.cjs    # Health monitoring script
├── public/                 # Static assets
├── .env.example            # Environment template
└── vercel.json             # Vercel configuration
```

### Database Schema (Supabase)

**Table: `bookings`**

Key fields:
- `id` - UUID primary key
- `booking_ref` - Human-readable reference (BK-XXXXX)
- `customer_name`, `customer_email`, `customer_phone`
- `problem` - Therapy concern (anxiety, depression, etc.)
- `appointment_date`, `appointment_time`
- `payment_status` - pending | completed | failed
- `session_status` - scheduled | completed | cancelled | no-show
- `razorpay_order_id`, `razorpay_payment_id`
- `amount_paid` - Amount in paise (49900 = ₹499)
- `feedback_sent` - Boolean for feedback tracking
- `created_at`, `updated_at`

### Security

- ✅ **Admin Authentication:** HMAC-signed session tokens (serverless-safe)
- ✅ **Environment Variables:** All secrets stored in Vercel (encrypted)
- ✅ **Payment Security:** PCI-compliant via Razorpay
- ✅ **Database Security:** Supabase RLS policies
- ✅ **API Keys:** Never committed to git (.gitignore enforced)
- ✅ **HTTPS:** Enforced on all domains (Vercel SSL)

---

## Troubleshooting

### Build Failures

```bash
# Check build logs
vercel logs <deployment-url>

# Test build locally
npm run build

# Check for TypeScript errors
npx astro check
```

### Environment Variable Issues

```bash
# Validate local .env
npm run validate-env

# Common errors:
# - Newlines in values (breaks services)
# - Missing required variables
# - Invalid format (wrong prefix, etc.)

# Fix corrupted variables
npm run sync-env  # Automatically cleans values
```

### Admin Panel Not Working

1. **Can't access /admin:**
   - Check Vercel Deployment Protection is OFF for production
   - Settings → Deployment Protection → "Only Preview Deployments"

2. **Can't login:**
   - Verify ADMIN_PASSWORD is set in Vercel
   - Check browser console for JavaScript errors
   - Hard refresh (Ctrl+Shift+R)

3. **Session keeps expiring:**
   - Sessions expire after 24 hours (normal)
   - Check browser isn't blocking cookies

### Payment Integration Issues

1. **Razorpay not loading:**
   - Check RAZORPAY_KEY_ID is set and correct format (rzp_live_ or rzp_test_)
   - Verify key_id matches environment (test vs live)

2. **Payment succeeds but booking shows pending:**
   - Check webhook endpoint is configured in Razorpay dashboard
   - Verify webhook secret matches RAZORPAY_KEY_SECRET

### Email Not Sending

1. **Check RESEND_API_KEY:**
   ```bash
   npm run validate-env  # Checks for newlines/corruption
   ```

2. **Verify domain:**
   - Must use verified domain: noreply@psychologyzone.in
   - Check domain verification in Resend dashboard

3. **Check logs:**
   ```bash
   vercel logs https://book.psychologyzone.in | grep -i resend
   ```

---

## Support

**For urgent production issues:**
1. Check [Emergency Procedures](#emergency-procedures)
2. Contact: simranjeetsingh@bizzhikemedia.com
3. Vercel Dashboard: https://vercel.com/bizzhikemedia/psychology-zone-v2

**For development questions:**
- Review this README
- Check `.env.example` for variable format requirements
- Use `npm run validate-env` before deploying

---

## License

Proprietary - Psychology Zone © 2026
