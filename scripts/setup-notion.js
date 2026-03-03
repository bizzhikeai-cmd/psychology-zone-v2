#!/usr/bin/env node
/**
 * One-time setup: creates the Psychology Zone Bookings database in Notion.
 *
 * Usage:
 *   NOTION_API_KEY=secret_xxx node scripts/setup-notion.js
 *
 * After running, copy the printed NOTION_DATABASE_ID into your .env and Vercel environment.
 *
 * Prerequisites:
 *   - Create an Internal Integration at https://www.notion.so/my-integrations
 *   - Copy the "Internal Integration Secret" as your NOTION_API_KEY
 *   - The integration needs "Insert content" and "Read content" capabilities (default)
 */

const apiKey = process.env.NOTION_API_KEY;

if (!apiKey) {
  console.error('Error: NOTION_API_KEY environment variable is required.');
  console.error('Usage: NOTION_API_KEY=secret_xxx node scripts/setup-notion.js');
  process.exit(1);
}

const NOTION_API = 'https://api.notion.com/v1';

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function setup() {
  // Step 1: Create a top-level page as the container
  console.log('Step 1/2: Creating "Psychology Zone CRM" page at workspace root...');

  const pageRes = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { type: 'workspace', workspace: true },
      properties: {
        title: [{ text: { content: 'Psychology Zone CRM' } }],
      },
    }),
  });

  if (!pageRes.ok) {
    const err = await pageRes.json();
    console.error('\n❌ Failed to create parent page.');
    console.error('Make sure your integration token is valid and has workspace access.');
    console.error('API error:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const page = await pageRes.json();
  console.log(`   ✓ Page created (ID: ${page.id})`);

  // Step 2: Create the Bookings database inside the page
  console.log('Step 2/2: Creating Bookings database...');

  const dbRes = await fetch(`${NOTION_API}/databases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: page.id },
      title: [{ text: { content: 'Bookings' } }],
      properties: {
        'Customer Name': { title: {} },
        'Email': { email: {} },
        'Phone': { phone_number: {} },
        'City': { rich_text: {} },
        'Problem': { rich_text: {} },
        'Circumstances': { rich_text: {} },
        'Appointment Date': { date: {} },
        'Appointment Time': { rich_text: {} },
        'Payment Status': {
          select: {
            options: [
              { name: 'Pending', color: 'yellow' },
              { name: 'Confirmed', color: 'green' },
              { name: 'Failed', color: 'red' },
            ],
          },
        },
        'Session Status': {
          select: {
            options: [
              { name: 'Scheduled', color: 'blue' },
              { name: 'Completed', color: 'green' },
              { name: 'Cancelled', color: 'gray' },
              { name: 'No-Show', color: 'red' },
            ],
          },
        },
        'Package Name': { rich_text: {} },
        'Session Count': { number: { format: 'number' } },
        'Amount Paid (₹)': { number: { format: 'number' } },
        'Booking Ref': { rich_text: {} },
        'Razorpay Order ID': { rich_text: {} },
        'Razorpay Payment ID': { rich_text: {} },
        'Page Source': { rich_text: {} },
      },
    }),
  });

  if (!dbRes.ok) {
    const err = await dbRes.json();
    console.error('\n❌ Failed to create database.');
    console.error('API error:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const db = await dbRes.json();

  console.log('\n✅ Setup complete!\n');
  console.log('Add these two variables to your .env and Vercel environment:\n');
  console.log(`NOTION_API_KEY=${apiKey}`);
  console.log(`NOTION_DATABASE_ID=${db.id}`);
  console.log('\nYour Notion page:', page.url);
}

setup().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
