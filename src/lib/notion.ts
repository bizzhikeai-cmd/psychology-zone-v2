// Notion CRM Integration Service

interface NotionBookingData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  problem: string;
  circumstances?: string;
  appointment_date: string;
  appointment_time: string;
  package_name: string;
  session_count: number;
  amount_paid: number;       // in rupees (not paise)
  razorpay_order_id: string;
  booking_ref: string;
  page_source: string;
}

type PaymentStatus = 'Pending' | 'Confirmed' | 'Failed';

class NotionService {
  private apiKey: string;
  private databaseId: string;
  private readonly apiBase = 'https://api.notion.com/v1';

  constructor() {
    this.apiKey = (import.meta.env.NOTION_API_KEY || process.env.NOTION_API_KEY || '').trim();
    this.databaseId = (import.meta.env.NOTION_DATABASE_ID || process.env.NOTION_DATABASE_ID || '').trim();

    if (!this.apiKey || !this.databaseId) {
      console.warn('[Notion] CRM credentials not configured — lead sync disabled');
    }
  }

  private isConfigured(): boolean {
    return !!(this.apiKey && this.databaseId);
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new row in the Bookings database with Payment Status = Pending.
   * Fire-and-forget safe — never throws.
   */
  async createEntry(data: NotionBookingData): Promise<{ success: boolean; pageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Notion CRM not configured' };
    }

    try {
      const res = await fetch(`${this.apiBase}/pages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          parent: { database_id: this.databaseId },
          properties: {
            'Customer Name': {
              title: [{ text: { content: data.customer_name } }],
            },
            'Email': { email: data.customer_email },
            'Phone': { phone_number: data.customer_phone },
            'City': { rich_text: [{ text: { content: data.city } }] },
            'Problem': { rich_text: [{ text: { content: data.problem } }] },
            ...(data.circumstances ? {
              'Circumstances': { rich_text: [{ text: { content: data.circumstances } }] },
            } : {}),
            'Appointment Date': {
              date: { start: data.appointment_date },
            },
            'Appointment Time': { rich_text: [{ text: { content: data.appointment_time } }] },
            'Payment Status': { select: { name: 'Pending' } },
            'Package Name': { rich_text: [{ text: { content: data.package_name } }] },
            'Session Count': { number: data.session_count },
            'Amount Paid (₹)': { number: data.amount_paid },
            'Booking Ref': { rich_text: [{ text: { content: data.booking_ref } }] },
            'Razorpay Order ID': { rich_text: [{ text: { content: data.razorpay_order_id } }] },
            'Page Source': { rich_text: [{ text: { content: data.page_source } }] },
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[Notion] createEntry failed:', JSON.stringify(err));
        return { success: false, error: (err as any).message || `HTTP ${res.status}` };
      }

      const page = await res.json() as { id: string };
      console.log(`[Notion] Entry created: ${page.id} for booking ${data.booking_ref}`);
      return { success: true, pageId: page.id };
    } catch (err) {
      console.error('[Notion] createEntry exception:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Find a row by Razorpay Order ID and update its Payment Status.
   * Optionally also stores the Razorpay Payment ID on confirmation.
   * Fire-and-forget safe — never throws.
   */
  async updatePaymentStatus(
    razorpayOrderId: string,
    status: PaymentStatus,
    razorpayPaymentId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Notion CRM not configured' };
    }

    try {
      // Find the page by Razorpay Order ID
      const queryRes = await fetch(`${this.apiBase}/databases/${this.databaseId}/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          filter: {
            property: 'Razorpay Order ID',
            rich_text: { equals: razorpayOrderId },
          },
          page_size: 1,
        }),
      });

      if (!queryRes.ok) {
        const err = await queryRes.json();
        console.error('[Notion] query failed:', JSON.stringify(err));
        return { success: false, error: `Query HTTP ${queryRes.status}` };
      }

      const queryData = await queryRes.json() as { results: Array<{ id: string }> };
      const pageId = queryData.results?.[0]?.id;

      if (!pageId) {
        console.warn(`[Notion] No entry found for Razorpay order ${razorpayOrderId} — skipping update`);
        return { success: false, error: 'Entry not found' };
      }

      // Build update properties
      const updateProperties: Record<string, unknown> = {
        'Payment Status': { select: { name: status } },
      };

      if (razorpayPaymentId) {
        updateProperties['Razorpay Payment ID'] = {
          rich_text: [{ text: { content: razorpayPaymentId } }],
        };
      }

      const updateRes = await fetch(`${this.apiBase}/pages/${pageId}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({ properties: updateProperties }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        console.error('[Notion] updatePaymentStatus failed:', JSON.stringify(err));
        return { success: false, error: (err as any).message || `HTTP ${updateRes.status}` };
      }

      console.log(`[Notion] Entry ${pageId} updated to Payment Status=${status}`);
      return { success: true };
    } catch (err) {
      console.error('[Notion] updatePaymentStatus exception:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

export const notionService = new NotionService();
export type { NotionBookingData, PaymentStatus };
