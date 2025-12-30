# Quick Test Checklist ✅

After deploying these fixes, run through this checklist to verify everything works:

## ✅ Pre-Flight Checks

### 1. Verify Database Columns Exist
Go to Supabase Dashboard → SQL Editor and run:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name IN ('session_status', 'feedback_sent', 'session_completed_at', 'feedback_sent_at', 'admin_notes')
ORDER BY column_name;
```

**Expected result:** Should return 5 rows showing these columns exist.

**If columns are missing:** Run the migration file:
```sql
-- Copy/paste contents from supabase-migration-session-status.sql
```

---

### 2. Verify Interakt Template Exists
1. Login to Interakt dashboard
2. Go to Templates
3. Find template named: `session_feedback_prompt`
4. Status should be: **Approved** ✅

**If template doesn't exist or not approved:**
- Create it in Interakt dashboard
- Wait for WhatsApp approval (usually 1-2 hours)

---

## ✅ Testing Fixes

### Test 1: Session Status Update

**Steps:**
1. Go to `/admin` dashboard
2. Find a booking with:
   - Payment status = "Completed" (green)
   - Session status = "Scheduled" (blue)
3. Click "✓ Complete" button
4. Page should reload

**Expected Results:**
- ✅ Session status changes from "Scheduled" → "Completed"
- ✅ Green checkmark (✓) appears next to "Completed"
- ✅ "Complete" button disappears (replaced with "-")

**If it fails:**
- Check browser console for errors (F12)
- Check Network tab for API response
- Verify database was updated in Supabase

---

### Test 2: Feedback WhatsApp Message

**Steps:**
1. Use a test booking with YOUR phone number
2. Mark it as complete (Test 1)
3. Check your WhatsApp

**Expected Results:**
- ✅ Receive WhatsApp message immediately (within 1-2 minutes)
- ✅ Message contains: customer name, appointment date
- ✅ Message asks for feedback

**Message should look like:**
```
Hi [Name],

Thank you for completing your therapy session on [Date]. 

We'd love to hear about your experience! Your feedback helps us improve our services.

How was your session today?
```

**If message not received:**
- Check Interakt logs for delivery status
- Verify phone number format (should be +91XXXXXXXXXX for India)
- Check `INTERAKT_API_KEY` is set in Vercel env vars
- Look at Vercel function logs for errors

---

### Test 3: Prevent Multiple Clicks

**Steps:**
1. Open admin dashboard
2. Open browser DevTools → Network tab
3. Click "✓ Complete" button
4. Try to click again before page reloads

**Expected Results:**
- ✅ Button becomes disabled immediately
- ✅ Shows "⏳ Processing..." text
- ✅ Only 1 API call appears in Network tab
- ✅ Only 1 WhatsApp message sent

---

### Test 4: Database Verification

**After completing a session, run this in Supabase:**
```sql
SELECT 
  booking_ref,
  session_status,
  feedback_sent,
  session_completed_at,
  feedback_sent_at
FROM bookings
WHERE session_status = 'completed'
ORDER BY session_completed_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ `session_status` = 'completed'
- ✅ `feedback_sent` = true
- ✅ `session_completed_at` has a timestamp
- ✅ `feedback_sent_at` has a timestamp

---

## ✅ Edge Cases to Test

### Edge Case 1: Already Completed Session
**Steps:**
1. Find a booking already marked as "Completed"
2. Look in the Actions column

**Expected Result:**
- ✅ No "Complete" button shown (should show "-")

---

### Edge Case 2: Pending Payment
**Steps:**
1. Find a booking with Payment status = "Pending"
2. Look in the Actions column

**Expected Result:**
- ✅ No "Complete" button (can't complete unpaid session)

---

### Edge Case 3: Failed Payment
**Steps:**
1. Find a booking with Payment status = "Failed"
2. Look in the Actions column

**Expected Result:**
- ✅ No "Complete" button shown

---

## ❌ Common Issues & Solutions

### Issue: "Complete" button doesn't do anything
**Solution:**
1. Check browser console for JavaScript errors
2. Verify you're logged in as admin
3. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Session status doesn't update
**Solution:**
1. Check Supabase logs for update errors
2. Verify `booking_id` is being sent correctly
3. Check RLS policies allow service role to update

### Issue: No WhatsApp message received
**Solution:**
1. Check Vercel function logs: `vercel logs --follow`
2. Verify Interakt API key is correct
3. Check Interakt template is approved
4. Verify phone number format

### Issue: Multiple WhatsApp messages sent
**Solution:**
- This shouldn't happen anymore
- Button disables immediately on click
- Check if you clicked multiple times before fix

---

## 📊 Success Criteria

Your fixes are working correctly if:
- ✅ Session status updates from "Scheduled" to "Completed"
- ✅ Feedback checkmark (✓) appears immediately
- ✅ WhatsApp message received within 1-2 minutes
- ✅ Database shows `feedback_sent = true`
- ✅ No duplicate messages sent
- ✅ Button disappears after completion

---

## 🚀 Next: Test Abandoned Cart (Optional)

Once the above tests pass, you can implement abandoned cart recovery:
1. Read [ABANDONED_CART_GUIDE.md](ABANDONED_CART_GUIDE.md)
2. Create a test abandoned booking (start payment, then close modal)
3. Wait 1 hour
4. Check if reminder WhatsApp is sent

---

## 📝 Test Results Template

Copy this and fill in your results:

```
## Test Results - [Date]

### Environment
- [ ] Production (Vercel)
- [ ] Local development

### Test 1: Session Status Update
- [ ] PASS - Status updated to "Completed"
- [ ] PASS - Checkmark appears
- [ ] PASS - Button disappears
- [ ] FAIL - Issue: _________________________

### Test 2: Feedback WhatsApp
- [ ] PASS - Message received within 2 minutes
- [ ] PASS - Message contains correct details
- [ ] FAIL - Issue: _________________________

### Test 3: Prevent Multiple Clicks
- [ ] PASS - Only 1 API call made
- [ ] PASS - Only 1 message sent
- [ ] FAIL - Issue: _________________________

### Test 4: Database Verification
- [ ] PASS - All fields updated correctly
- [ ] FAIL - Issue: _________________________

### Overall Status
- [ ] ✅ ALL TESTS PASSED - Ready for production
- [ ] ❌ SOME TESTS FAILED - Issues to fix: _________________________
```

---

**Run through this checklist after deploying and let me know the results!** 🎯
