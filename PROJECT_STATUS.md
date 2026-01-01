# 📊 Psychology Zone - Project Status

> **Last Updated:** January 1, 2026  
> **Status:** Razorpay Integration Complete - Testing Deployment

---

## 🎯 Current Sprint: WhatsApp Automation System

### ✅ Completed Today (Dec 30, 2025)

#### 1. WhatsApp Templates Cleanup
- Deleted 4 redundant templates from Interakt
- **7 active templates** remaining:
  | Template | Category | Status |
  |----------|----------|--------|
  | `appointment_confirmation` | Utility | ✅ Approved |
  | `appointment_reminder` | Utility | ✅ Approved |
  | `payment_incomplete_notification` | Marketing | ✅ Approved |
  | `payment_failed_alert` | Marketing | ✅ Approved |
  | `session_feedback_prompt` | Marketing | ✅ Approved |
  | `session_positive_offer` | Marketing | ✅ Approved |
  | `session_negative_feedback_reason` | Marketing | ✅ Approved |
  | `cart_recovery_offer` | Marketing | ⏳ **NEEDS CREATION** |

#### 2. Code Implementation
- **`src/lib/interakt.ts`** - Added new functions:
  - `send24hReminder()` - 24h session reminder
  - `sendPaymentFailedAlert()` - Payment failure notification
  - `sendCartRecoveryOffer()` - Stage 2 cart recovery with ₹50 discount

- **`src/pages/api/cron/abandoned-cart.ts`** - Upgraded to 2-stage funnel:
  - Stage 1: `payment_incomplete_notification` (30 min after abandonment)
  - Stage 2: `cart_recovery_offer` (4 hours after Stage 1)

- **`src/pages/api/cron/session-reminders.ts`** - NEW file:
  - Daily cron at 10 AM IST (4:30 UTC)
  - Sends 24h reminder for tomorrow's sessions

- **`src/pages/api/verify-payment.ts`** - Updated:
  - Added `sendPaymentFailedAlert()` call on payment failure

- **`vercel.json`** - Updated crons:
  ```json
  {
    "path": "/api/cron/abandoned-cart",
    "schedule": "0 * * * *"
  },
  {
    "path": "/api/cron/session-reminders", 
    "schedule": "30 4 * * *"
  }
  ```

#### 3. Database Migration
- **`supabase-migration-whatsapp-tracking.sql`** - ✅ EXECUTED
- New columns added to `bookings` table:
  - `reminder_24h_sent` / `reminder_24h_sent_at`
  - `payment_failed_notified` / `payment_failed_notified_at`
  - `cart_recovery_sent` / `cart_recovery_sent_at`

#### 4. Documentation Created
- `CREATE_CART_RECOVERY_TEMPLATE.md` - Guide for creating template in Interakt
- `PRICING_STRATEGY_RESEARCH.md` - Therapy session pricing research
- `WHATSAPP_AUTOMATION_PLAN.md` - Full automation plan

---

## 🚀 What's Next (Tomorrow)

### Priority 1: Create `cart_recovery_offer` Template
1. Go to Interakt Comet → Templates → Create New
2. Follow `CREATE_CART_RECOVERY_TEMPLATE.md` exactly
3. **Key Details:**
   - Name: `cart_recovery_offer`
   - Category: Marketing
   - Variables: `{{1}}`=booking_ref, `{{2}}`=name, `{{3}}`=date, `{{4}}`=time
   - URL Button: `https://book.psychologyzone.in/retry-booking?ref={{1}}`
4. Wait for approval (24-48 hours)

### Priority 2: Test Endpoints After Deployment
```bash
# Test abandoned cart (both stages)
GET https://book.psychologyzone.in/api/cron/abandoned-cart?test=true

# Test Stage 1 only
GET https://book.psychologyzone.in/api/cron/abandoned-cart?test=true&stage=1

# Test Stage 2 only  
GET https://book.psychologyzone.in/api/cron/abandoned-cart?test=true&stage=2

# Test 24h reminder
GET https://book.psychologyzone.in/api/cron/session-reminders?test=true
```

### Priority 3: Verify Vercel Deployment
- Check that crons are registered in Vercel dashboard
- Monitor first cron executions in logs

---

## 🔄 WhatsApp Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    BOOKING JOURNEY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Books → Payment Success → appointment_confirmation    │
│                    ↓                                        │
│              24h before → appointment_reminder              │
│                    ↓                                        │
│           Session Done → session_feedback_prompt            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    RECOVERY JOURNEY                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Payment Fails → payment_failed_alert (immediate)           │
│                                                             │
│  Cart Abandoned:                                            │
│    +30 min → payment_incomplete_notification (Stage 1)      │
│    +4 hrs  → cart_recovery_offer with ₹50 OFF (Stage 2)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/interakt.ts` | WhatsApp API wrapper |
| `src/pages/api/cron/abandoned-cart.ts` | 2-stage cart recovery |
| `src/pages/api/cron/session-reminders.ts` | 24h session reminders |
| `src/pages/api/verify-payment.ts` | Payment handling |
| `src/pages/retry-booking.astro` | Retry booking page |
| `CREATE_CART_RECOVERY_TEMPLATE.md` | Template creation guide |

---

## 🔧 Environment Variables Needed

```env
# Interakt
INTERAKT_API_KEY=xxx
INTERAKT_CUSTOMER_TEMPLATE=appointment_confirmation
INTERAKT_REMINDER_TEMPLATE=appointment_reminder
INTERAKT_ABANDONED_TEMPLATE=payment_incomplete_notification
INTERAKT_PAYMENT_FAILED_TEMPLATE=payment_failed_alert
INTERAKT_FEEDBACK_TEMPLATE=session_feedback_prompt
INTERAKT_CART_RECOVERY_TEMPLATE=cart_recovery_offer

# Admin
ADMIN_WHATSAPP_NUMBER=918968900002

# Site
SITE_URL=https://book.psychologyzone.in
CRON_SECRET=xxx
```

---

## 📝 Notes

- Interakt requires dynamic URL buttons to use `{{1}}` - that's why cart_recovery_offer has reordered variables
- All crons support `?test=true` for manual testing
- Vercel free tier allows 2 cron jobs - we have exactly 2

---

*This document should be updated after each work session*
