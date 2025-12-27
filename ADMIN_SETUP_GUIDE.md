# Psychology Zone Admin Dashboard - Setup Guide

## ✅ What's Been Implemented

### 1. **Session Completion Management**
- ✓ New "Session Status" column in admin dashboard
- ✓ "Mark Complete" button for paid bookings
- ✓ Automatic feedback request sent to customers 2 hours after marking complete
- ✓ Visual indicators for feedback sent status

### 2. **Upcoming Appointments Highlighting**
- ✓ Today's appointments highlighted in **yellow** with 🔔 bell icon
- ✓ Tomorrow's appointments highlighted in **blue** with 📅 calendar icon
- ✓ Easy visual identification of urgent sessions

### 3. **Email Notifications**
- ✓ Admin receives email alert for every new booking
- ✓ Beautiful HTML email template with all booking details
- ✓ Direct links to call/email customer from notification
- ✓ Link to admin dashboard in email

### 4. **Database Updates**
- ✓ New `session_status` field (scheduled, completed, cancelled, no-show)
- ✓ New `session_completed_at` timestamp
- ✓ New `feedback_sent` boolean flag
- ✓ New `feedback_sent_at` timestamp
- ✓ New `admin_notes` field for internal notes

---

## 🚀 Setup Instructions

### Step 1: Update Supabase Database

1. Go to your Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql
2. Copy the contents of `supabase-migration-session-status.sql`
3. Paste and execute the SQL to add new columns
4. Verify the migration completed successfully

### Step 2: Create Interakt Feedback Template

You need to create a new WhatsApp message template in Interakt:

1. Log in to Interakt: https://app.interakt.ai
2. Go to **Templates** → **Create New Template**
3. Template details:
   - **Name**: `session_feedback_request`
   - **Category**: Utility
   - **Language**: English

4. **Message Content**:
```
Hi {{1}} 👋

Thank you for choosing Psychology Zone for your therapy session on {{2}}.

We hope you found your session helpful. We'd love to hear your feedback to help us serve you better!

Please take a moment to share your experience:
⭐ How was your session?
💭 Any suggestions for improvement?

Your feedback helps us improve our services.

Thank you! 🙏

Best regards,
Psychology Zone Team
```

5. **Variable mapping**:
   - {{1}} = Customer name
   - {{2}} = Appointment date

6. Submit for approval
7. Once approved, the feedback will be sent automatically 2 hours after marking sessions complete

### Step 3: Set Up Email Notifications (Optional)

To receive email alerts for new bookings:

1. **Sign up for Resend**:
   - Go to https://resend.com
   - Create a free account (100 emails/day free)
   - Get your API key from https://resend.com/api-keys

2. **Add to Vercel Environment Variables**:
   - Go to Vercel → Settings → Environment Variables
   - Add these variables:
     ```
     RESEND_API_KEY=re_your_key_here
     ADMIN_EMAIL=your-email@psychologyzone.in
     ```

3. **Verify your domain** (for production):
   - In Resend dashboard, add your domain
   - Add the DNS records provided by Resend
   - This allows emails to come from `noreply@psychologyzone.in`

4. **Test it**:
   - Make a test booking
   - Check your email for the notification

### Step 4: Add Local Environment Variables

Update your local `.env` file:

```env
# Email notifications
ADMIN_EMAIL=your-email@example.com
RESEND_API_KEY=re_your_api_key_here
```

### Step 5: Redeploy on Vercel

After adding the environment variables:
1. Go to Vercel → Deployments
2. Click on the latest deployment
3. Click "Redeploy" button
4. Wait for deployment to complete

---

## 📖 How to Use

### Marking Sessions Complete

1. Log in to admin dashboard: `/admin/login`
2. Find the booking in the table
3. Click the **"✓ Complete"** button in the Actions column
4. Confirm the action
5. The system will:
   - ✓ Mark session status as "completed"
   - ✓ Record the completion timestamp
   - ✓ Schedule feedback message to customer (2 hours later)
   - ✓ Update the UI to show completion

### Understanding the Dashboard

**Session Status Badges**:
- 🔵 **Scheduled** - Session is booked and scheduled
- 🟢 **Completed** - Session finished successfully
- 🔴 **Cancelled** - Session was cancelled
- 🟡 **No-Show** - Customer didn't attend

**Appointment Highlighting**:
- 🟡 **Yellow row** = Today's appointment
- 🔵 **Blue row** = Tomorrow's appointment
- Regular white = Future appointments

**Feedback Status**:
- ✓ **Green checkmark** = Feedback message sent to customer

---

## 🔧 Troubleshooting

### Feedback messages not sending?

1. Check Interakt template status (must be approved)
2. Verify template name is exactly `session_feedback_request`
3. Check Interakt API key in environment variables
4. Look at Vercel function logs for errors

### Email notifications not working?

1. Verify `RESEND_API_KEY` is set in Vercel
2. Verify `ADMIN_EMAIL` is set in Vercel
3. Check Resend dashboard for delivery status
4. Ensure domain is verified (for production)
5. Check spam folder

### Complete button not showing?

The button only shows when:
- Session status is NOT "completed"
- Payment status IS "completed"
- Check both conditions are met

---

## 💡 Future Enhancements (Optional)

If you want to add more features later:

1. **Export to CSV** - Download bookings as spreadsheet
2. **Search/Filter** - Find specific bookings quickly
3. **Date Range Filter** - View bookings from specific periods
4. **SMS Notifications** - Alternative to WhatsApp
5. **Customer Portal** - Let customers reschedule
6. **Analytics Charts** - Visual trends and insights
7. **Multi-admin Support** - Multiple login accounts
8. **Session Notes** - Add detailed notes per session

Let me know which features you'd like next!

---

## 📞 Support

If you need help or encounter any issues:
1. Check Vercel function logs
2. Check Supabase logs
3. Check browser console for errors
4. Review this setup guide

---

## 🎉 Summary

Your admin dashboard now has:
- ✅ Session completion tracking
- ✅ Automatic feedback collection
- ✅ Email notifications for new bookings
- ✅ Visual highlighting of upcoming appointments
- ✅ Complete audit trail of all sessions

The PsychologyZone team can now efficiently manage all bookings, track session completion, and automatically collect feedback from customers!
