# WhatsApp Automation Implementation Plan
## Psychology Zone - Complete Messaging System

---

## 📊 Current State vs Target State

### What's Already Working ✅
| Feature | Template Used | Status |
|---------|---------------|--------|
| Booking confirmation to customer | `appointment_confirmation` | ✅ Working |
| Admin notification | `new_booking_admin` | ✅ Working |
| 1st Abandoned cart reminder (30-60 min) | `booking_reminder` | ⚠️ Wrong template name |
| Post-session feedback | `session_feedback_prompt` | ✅ Working |

### What's Missing ❌
| Feature | Template Needed | Status |
|---------|-----------------|--------|
| 2nd Abandoned cart (with ₹50 discount) | `cart_recovery_offer` | ❌ Not implemented |
| 24h session reminder | `appointment_reminder` | ❌ No cron job |
| Payment failed notification | `payment_failed_alert` | ❌ Not implemented |

---

## 🎯 Implementation Tasks

### Task 1: Fix Template Names in Code

**File:** `src/lib/interakt.ts`

**Current → Should Be:**
| Function | Currently Uses | Should Use |
|----------|----------------|------------|
| `sendCartAbandonedReminder()` | `booking_reminder` | `payment_incomplete_notification` |

**Action:** Update env variable and function to use correct approved template name.

---

### Task 2: Add New Functions to interakt.ts

**Add these new functions:**

```typescript
// 2nd abandoned cart with discount (4-6 hours after 1st)
sendCartRecoveryOffer(phone, name, date, time, retryLink)
  → Template: cart_recovery_offer
  → Variables: {{1}}=name, {{2}}=date, {{3}}=time, {{4}}=retryLink

// 24h reminder before session
send24hReminder(phone, name, date, time)
  → Template: appointment_reminder
  → Variables: {{1}}=name, {{2}}=date, {{3}}=time

// Payment failed notification
sendPaymentFailedAlert(phone, name, date, time, retryLink)
  → Template: payment_failed_alert
  → Variables: {{1}}=name, {{2}}=date, {{3}}=time, {{4}}=retryLink
```

---

### Task 3: Database Migration

**New fields needed in `bookings` table:**

```sql
-- For 2nd abandoned cart reminder
ALTER TABLE bookings ADD COLUMN cart_reminder_2_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN cart_reminder_2_sent_at TIMESTAMPTZ;

-- For 24h session reminder  
ALTER TABLE bookings ADD COLUMN reminder_24h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN reminder_24h_sent_at TIMESTAMPTZ;

-- For payment failure tracking
ALTER TABLE bookings ADD COLUMN payment_failed_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN payment_failed_notified_at TIMESTAMPTZ;
```

**File to create:** `supabase-migration-whatsapp-tracking.sql`

---

### Task 4: Update Abandoned Cart Cron

**File:** `src/pages/api/cron/abandoned-cart.ts`

**Current logic:**
- Finds bookings 30min-24h old
- Sends 1st reminder
- Marks `cart_reminder_sent = true`

**Add new logic:**
- Also find bookings where:
  - `cart_reminder_sent = true`
  - `cart_reminder_sent_at` is 4-6 hours ago
  - `cart_reminder_2_sent = false`
  - `payment_status` still pending/failed
- Send 2nd reminder using `cart_recovery_offer` template
- Mark `cart_reminder_2_sent = true`

---

### Task 5: Create Session Reminder Cron

**New file:** `src/pages/api/cron/session-reminders.ts`

**Logic:**
- Run daily at 10:00 AM IST
- Find all bookings where:
  - `payment_status = 'completed'`
  - `session_status = 'scheduled'`
  - `appointment_date` is tomorrow
  - `reminder_24h_sent = false`
- Send reminder using `appointment_reminder` template
- Mark `reminder_24h_sent = true`

---

### Task 6: Add Payment Failed Notification

**File:** `src/pages/api/verify-payment.ts`

**Current PUT handler:**
```typescript
// Updates payment_status to 'failed'
// Does nothing else
```

**Add:**
```typescript
// After marking as failed:
await sendPaymentFailedAlert(
  booking.customer_phone,
  booking.customer_name,
  booking.appointment_date,
  booking.appointment_time,
  retryLink
);
// Mark payment_failed_notified = true
```

---

### Task 7: Update Vercel Cron Config

**File:** `vercel.json`

**Current:**
```json
{
  "crons": [
    {
      "path": "/api/cron/abandoned-cart",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Add:**
```json
{
  "crons": [
    {
      "path": "/api/cron/abandoned-cart",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/session-reminders",
      "schedule": "30 4 * * *"
    }
  ]
}
```

---

### Task 8: Update Environment Variables

**Add to `.env` and Vercel:**

```env
# WhatsApp Templates (Approved)
INTERAKT_CUSTOMER_TEMPLATE=appointment_confirmation
INTERAKT_ADMIN_TEMPLATE=new_booking_admin
INTERAKT_ABANDONED_TEMPLATE=payment_incomplete_notification
INTERAKT_ABANDONED_OFFER_TEMPLATE=cart_recovery_offer
INTERAKT_REMINDER_TEMPLATE=appointment_reminder
INTERAKT_PAYMENT_FAILED_TEMPLATE=payment_failed_alert
INTERAKT_FEEDBACK_TEMPLATE=session_feedback_prompt
INTERAKT_POSITIVE_TEMPLATE=session_positive_offer
INTERAKT_NEGATIVE_TEMPLATE=session_negative_feedback_reason
```

---

## 📋 Implementation Checklist

### Phase 1: Database & Config
- [ ] Create SQL migration file
- [ ] Run migration in Supabase
- [ ] Update .env with template names
- [ ] Update Vercel env variables

### Phase 2: Core Functions
- [ ] Update `interakt.ts` - fix template name for abandoned cart
- [ ] Add `sendCartRecoveryOffer()` function
- [ ] Add `send24hReminder()` function  
- [ ] Add `sendPaymentFailedAlert()` function

### Phase 3: Cron Jobs
- [ ] Update `abandoned-cart.ts` - add 2nd reminder logic
- [ ] Create `session-reminders.ts` - 24h reminder cron
- [ ] Update `vercel.json` with new cron schedule

### Phase 4: Payment Flow
- [ ] Update `verify-payment.ts` - add failed payment notification

### Phase 5: Testing
- [ ] Test 1st abandoned cart reminder
- [ ] Test 2nd abandoned cart reminder (wait 4-6 hours or use test mode)
- [ ] Test 24h session reminder
- [ ] Test payment failed notification
- [ ] Test booking confirmation (already working)
- [ ] Test feedback request (already working)

---

## 🔄 Final Automation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING INITIATED                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      Payment Attempted?       │
              └───────────────────────────────┘
                     │                │
                    NO               YES
                     │                │
                     ▼                ▼
           ┌─────────────┐    ┌─────────────────┐
           │ 30-60 min   │    │ Payment Result? │
           │   wait      │    └─────────────────┘
           └─────────────┘         │         │
                  │             FAILED    SUCCESS
                  ▼                │         │
    ┌─────────────────────────┐    │         ▼
    │ payment_incomplete_     │    │  ┌──────────────────┐
    │ notification            │    │  │ appointment_     │
    │ (1st reminder)          │    │  │ confirmation     │
    └─────────────────────────┘    │  └──────────────────┘
                  │                │         │
                  ▼                ▼         │
           ┌─────────────┐  ┌───────────┐    │
           │ 4-6 hours   │  │ payment_  │    │
           │   wait      │  │ failed_   │    │
           └─────────────┘  │ alert     │    │
                  │         └───────────┘    │
                  ▼                          │
    ┌─────────────────────────┐              │
    │ cart_recovery_offer     │              │
    │ (2nd reminder + ₹50 off)│              │
    └─────────────────────────┘              │
                                             │
                              ┌──────────────┘
                              ▼
                    ┌───────────────────┐
                    │   24h before      │
                    │   appointment     │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ appointment_      │
                    │ reminder          │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  SESSION HAPPENS  │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Admin marks       │
                    │ session complete  │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ session_feedback_ │
                    │ prompt            │
                    └───────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ Positive Rating │             │ Negative Rating │
    └─────────────────┘             └─────────────────┘
              │                               │
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────────┐
    │ session_        │             │ session_negative_   │
    │ positive_offer  │             │ feedback_reason     │
    └─────────────────┘             └─────────────────────┘
```

---

## ❓ Decisions Needed Before Implementation

### 1. Discount Implementation
**Question:** The `cart_recovery_offer` template mentions ₹50 discount with code FIRST50. How should this work?

**Options:**
- **A) URL Parameter (Simple):** Add `?discount=50` to retry URL, apply in checkout
- **B) Coupon Code System (Complex):** Build full coupon validation system
- **C) Manual Honor (Simplest):** Customer mentions code, manually adjusted

**Recommendation:** Option A for now - simple URL parameter

### 2. Template Approval Status
**Question:** Is `cart_recovery_offer` template approved by Meta yet?

- If YES → Implement full 2nd reminder flow
- If NO → Skip for now, implement when approved

### 3. Testing Strategy
**Question:** How to test without waiting hours?

**Recommendation:** Keep `?test=true` parameter that bypasses time checks

---

## 📅 Estimated Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1 | Database & Config | 30 min |
| Phase 2 | Core Functions | 1 hour |
| Phase 3 | Cron Jobs | 1 hour |
| Phase 4 | Payment Flow | 30 min |
| Phase 5 | Testing | 1 hour |
| **Total** | | **4 hours** |

---

## 🚀 Ready to Implement?

Once you confirm:
1. ✅ Interakt issues resolved
2. ✅ Template `cart_recovery_offer` is approved
3. ✅ Discount approach (A/B/C)
4. ✅ Go ahead to implement

We'll start coding!

---

*Plan created: December 30, 2024*
*Status: Awaiting Interakt issues resolution*
