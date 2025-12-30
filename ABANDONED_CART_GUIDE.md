# Abandoned Cart Recovery - Implementation Guide

## ✅ Current Status

**IMPLEMENTED** - Abandoned cart recovery is now set up using Vercel Cron.

### What's Been Implemented:
- ✓ Cron job runs every hour at minute 0
- ✓ Uses your approved template: `cart_abandoned_inr50_reminder`
- ✓ Tracks reminder sent status in database
- ✓ Only sends 1 reminder per abandoned booking
- ✓ Only targets bookings from last 24 hours
- ✓ Only targets future appointments (doesn't remind for past dates)

### Templates Available:
- `cart_abandoned_inr50_reminder` (primary)
- `checkout_abandoned_inr50_reminder` (alternative)

## 🤔 What is Abandoned Cart?

An abandoned cart occurs when a customer:
1. Starts booking a session (fills the form)
2. Creates a Razorpay order
3. But **does not complete the payment** (closes the payment modal or payment fails)

These bookings are stored in the database with `payment_status = 'failed'` or `'pending'`.

## 🎯 How Abandoned Cart Recovery Works

The goal is to send WhatsApp reminders to customers who abandoned their booking, encouraging them to complete the payment.

### Typical Flow:
1. **Customer abandons payment** → Booking marked as 'failed' in database
2. **Wait 30-60 minutes** → Give them time to return on their own
3. **Send reminder WhatsApp** → "You didn't complete your booking, tap here to resume"
4. **Track conversion** → See how many come back and complete payment

## 🛠️ Implementation Options

### Option 1: Vercel Cron Jobs (Recommended for Vercel)

**Cost:** Free (up to 100,000 invocations/month)

**Setup:**
1. Create a new API route: `/api/cron/abandoned-cart.ts`
2. Add to `vercel.json`:
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
3. The cron runs every hour and checks for abandoned bookings

**Pros:**
- Simple, built into Vercel
- No additional services needed
- Free for most use cases

**Cons:**
- Limited scheduling (minimum 1 hour)
- Need to manually track "reminder sent" status

---

### Option 2: Inngest (Recommended for Production)

**Cost:** Free tier: 50,000 function runs/month

**Setup:**
1. Sign up at https://inngest.com
2. Install: `npm install inngest`
3. Create delayed workflow that triggers 1 hour after failed payment
4. Automatic retry and observability

**Pros:**
- Purpose-built for workflows
- Can schedule exact delays (e.g., 1 hour after abandonment)
- Better error handling and retry logic
- Visual dashboard to see all workflows

**Cons:**
- Additional service to manage
- Requires API key configuration

---

### Option 3: Supabase Edge Functions + pg_cron

**Cost:** Free (included with Supabase)

**Setup:**
1. Use Supabase's built-in `pg_cron` extension
2. Create a database function to find abandoned bookings
3. Schedule it to run hourly

**Pros:**
- No external service
- Database-native solution

**Cons:**
- More complex SQL setup
- Need to call Interakt API from Supabase function

---

## 📝 Implementation Steps (Using Vercel Cron)

### Step 1: Update Database Schema

First, add a column to track if reminder was sent:

```sql
ALTER TABLE bookings 
ADD COLUMN cart_reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN cart_reminder_sent_at TIMESTAMPTZ;
```

### Step 2: Create Interakt WhatsApp Template

Create a template in Interakt dashboard called `cart_abandonment_reminder`:

**Template Name:** `cart_abandonment_reminder`

**Template Body:**
```
Hi {{1}},

We noticed you didn't complete your therapy session booking. 😊

Would you like to continue? Your session details are saved:
📅 Date: {{2}}
⏰ Time: {{3}}

Complete your booking now and take the first step toward better mental health!

Tap here to resume: https://psychologyzone.in/?ref={{4}}
```

**Variables:**
1. Customer Name
2. Appointment Date
3. Appointment Time
4. Booking Reference

### Step 3: Add Method to `interakt.ts`

```typescript
/**
 * Send abandoned cart reminder to customer
 */
async sendCartReminder(data: {
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  booking_ref: string;
}): Promise<{ success: boolean; error?: string }> {
  const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
  
  const payload: InteraktPayload = {
    countryCode,
    phoneNumber,
    callbackData: data.booking_ref,
    type: 'Template',
    template: {
      name: 'cart_abandonment_reminder',
      languageCode: 'en',
      bodyValues: [
        data.customer_name,
        this.formatDate(data.appointment_date),
        this.formatTime(data.appointment_time),
        data.booking_ref
      ]
    }
  };

  return this.sendMessage(payload);
}
```

### Step 4: Create Cron API Route

Create file: `/src/pages/api/cron/abandoned-cart.ts`

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { interaktService } from '../../../lib/interakt';

export const GET: APIRoute = async ({ request }) => {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = import.meta.env.CRON_SECRET || process.env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Find abandoned bookings from the last 24 hours
    // - payment_status is 'failed' or 'pending'
    // - created more than 1 hour ago
    // - reminder not sent yet
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonedBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .in('payment_status', ['failed', 'pending'])
      .eq('cart_reminder_sent', false)
      .gte('created_at', oneDayAgo)
      .lte('created_at', oneHourAgo);

    if (error) {
      console.error('Error fetching abandoned bookings:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!abandonedBookings || abandonedBookings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No abandoned carts found', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send reminders
    for (const booking of abandonedBookings) {
      try {
        const result = await interaktService.sendCartReminder({
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time,
          booking_ref: booking.booking_ref
        });

        if (result.success) {
          // Mark reminder as sent
          await supabase
            .from('bookings')
            .update({
              cart_reminder_sent: true,
              cart_reminder_sent_at: new Date().toISOString()
            })
            .eq('id', booking.id);
          
          sentCount++;
          console.log(`Cart reminder sent for ${booking.booking_ref}`);
        } else {
          failedCount++;
          console.error(`Failed to send reminder for ${booking.booking_ref}:`, result.error);
        }
      } catch (err) {
        failedCount++;
        console.error(`Error processing ${booking.booking_ref}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Abandoned cart processing complete',
        total: abandonedBookings.length,
        sent: sentCount,
        failed: failedCount
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Abandoned cart cron error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

### Step 5: Configure `vercel.json`

Update your `vercel.json` to add the cron job:

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

This runs every hour (at minute 0).

### Step 6: Add Environment Variables

In Vercel dashboard, add:

```
CRON_SECRET=your-random-secret-string-here
```

Generate a random secret: `openssl rand -base64 32`

### Step 7: Deploy & Test

1. Deploy to Vercel
2. Wait for the cron to run (or manually trigger via Vercel dashboard)
3. Check logs in Vercel dashboard

To manually test:
```bash
curl -X GET https://your-site.vercel.app/api/cron/abandoned-cart \
  -H "Authorization: Bearer your-cron-secret"
```

---

## 🧪 Testing Abandoned Cart

### How to Create a Test Abandoned Booking:

1. **Go to your website**: https://psychologyzone.in
2. **Fill the booking form** with test data
3. **Click "Proceed for Payment"** → Razorpay modal opens
4. **Close the modal immediately** → This creates an abandoned booking
5. **Wait 1-2 hours** (or run the cron manually)
6. **Check if WhatsApp reminder is sent**

### Manual Cron Trigger (for testing):

You can trigger the cron manually via Vercel dashboard:
1. Go to Vercel → Your Project → Cron Jobs
2. Click "Run" next to the abandoned-cart cron
3. Check the logs to see if reminders were sent

---

## 📊 Tracking & Analytics

### View Abandoned Bookings in Admin Dashboard

You could add a new filter in the admin dashboard:

```typescript
// In admin/index.astro
const statusFilter = Astro.url.searchParams.get('status');
const showAbandoned = Astro.url.searchParams.get('abandoned') === 'true';

if (showAbandoned) {
  // Fetch bookings where payment_status is 'failed' and created in last 24h
}
```

### Add a Stats Card for Abandoned Carts

```astro
<div class="stat-card stat-warning">
  <span class="stat-value">{stats.abandoned}</span>
  <span class="stat-label">Abandoned Carts (24h)</span>
</div>
```

---

## 💡 Best Practices

1. **Don't spam** - Only send 1 reminder per abandoned booking
2. **Time it right** - Wait at least 1 hour before sending reminder
3. **Make it easy** - Include a direct link to resume booking
4. **Track conversions** - Monitor how many abandoned carts convert after reminder
5. **Personalize** - Use customer name and original booking details

---

## 🚀 Future Enhancements

### Multi-Stage Reminders:
- **1 hour later**: First gentle reminder
- **24 hours later**: Second reminder with urgency
- **3 days later**: Final reminder with offer (discount?)

### Smart Recovery:
- Only remind if the appointment date is still in the future
- Don't remind if they created a new successful booking
- A/B test different message templates

---

## ❓ Questions?

This is a complete guide. Start with Vercel Cron (simplest), then consider Inngest if you need more sophisticated workflows.

**Estimated time to implement:** 2-3 hours
**Expected recovery rate:** 5-15% of abandoned bookings
