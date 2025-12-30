# 📋 CREATE TEMPLATE: cart_recovery_offer

## Step 1: Basic Info

| Field | Value |
|-------|-------|
| **Template Name** | `cart_recovery_offer` |
| **Category** | Marketing |
| **Language** | English |

---

## Step 2: Header

| Field | Value |
|-------|-------|
| **Header Type** | None |

---

## Step 3: Body

**Copy this exactly (including emojis):**

```
Hi {{2}}! 🎁

We noticed you were interested in booking a therapy session.

Here's a special offer just for you: ₹50 OFF your first session!

📅 Your selected slot: {{3}} at {{4}}

Use code FIRST50 or click below to complete your booking with the discount applied.

Your mental wellness journey is just one click away! 💙
```

**⚠️ NOTE:** Variables are reordered because URL button MUST use `{{1}}`

---

## Step 4: Footer

| Field | Value |
|-------|-------|
| **Footer Text** | `Psychology Zone - Your Safe Space` |

---

## Step 5: Buttons

| Button # | Type | Button Text | Action |
|----------|------|-------------|--------|
| 1 | Quick Reply | `Book Now` | - |
| 2 | URL (Dynamic) | `Complete Booking` | `https://psychologyzone.in/retry-booking?ref={{1}}` |

**⚠️ IMPORTANT:** Interakt requires dynamic URLs to end with `{{1}}` - not any other variable!

**Correct format:**
```
https://psychologyzone.in/retry-booking?ref={{1}}
```

---

## Step 6: Sample Values (Required for Approval)

| Variable | Sample Value |
|----------|--------------|
| `{{1}}` | `PZ-ABC123` |
| `{{2}}` | `Rahul` |
| `{{3}}` | `Monday, 6 January 2025` |
| `{{4}}` | `10:00 AM` |

---

## Step 7: Variable Descriptions

| Variable | Description |
|----------|-------------|
| `{{1}}` | Booking reference code (MUST be {{1}} for URL) |
| `{{2}}` | Customer's first name |
| `{{3}}` | Appointment date (formatted) |
| `{{4}}` | Appointment time (formatted)

---

## 📱 Preview (How it will look)

```
┌─────────────────────────────────────┐
│                                     │
│  Hi Rahul! 🎁                       │
│                                     │
│  We noticed you were interested     │
│  in booking a therapy session.      │
│                                     │
│  Here's a special offer just for    │
│  you: ₹50 OFF your first session!   │
│                                     │
│  📅 Your selected slot:             │
│  Monday, January 6 at 10:00 AM      │
│                                     │
│  Use code FIRST50 or click below    │
│  to complete your booking with      │
│  the discount applied.              │
│                                     │
│  Your mental wellness journey is    │
│  just one click away! 💙            │
│                                     │
│  Psychology Zone - Your Safe Space  │
│                                     │
│  ┌─────────────┐ ┌────────────────┐ │
│  │  Book Now   │ │Complete Booking│ │
│  └─────────────┘ └────────────────┘ │
│                                     │
│  URL: psychologyzone.in/retry-      │
│       booking?ref=PZ-ABC123         │
└─────────────────────────────────────┘
```

---

## ⏱️ After Submission

1. **Wait for approval** (usually 24-48 hours)
2. **Notify dev team when approved** → Code will be updated to use this template
3. Template will be triggered **4-6 hours after first abandoned cart message**

---

## ✅ Checklist Before Submitting

- [ ] Template name is exactly `cart_recovery_offer`
- [ ] Category is Marketing
- [ ] Language is English
- [ ] Body uses `{{2}}` for name, `{{3}}` for date, `{{4}}` for time
- [ ] Footer text added
- [ ] Quick Reply button: "Book Now"
- [ ] URL button: "Complete Booking" with URL `https://psychologyzone.in/retry-booking?ref={{1}}`
- [ ] Sample values: {{1}}=`PZ-ABC123`, {{2}}=`Rahul`, {{3}}=`Monday, January 6`, {{4}}=`10:00 AM`

---

*Document created: December 30, 2025*
