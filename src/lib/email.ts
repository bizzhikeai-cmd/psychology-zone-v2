// Email notification service using Resend API
// Sign up at https://resend.com and get API key

interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
}

class EmailService {
  private apiKey: string;
  private from: string;

  constructor() {
    // Use both import.meta.env and process.env fallback for Vercel serverless compatibility
    // Also trim to handle any newline corruption in environment variables
    this.apiKey = (import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
    // Using verified domain
    this.from = 'Psychology Zone <noreply@psychologyzone.in>';
  }

  /**
   * Send new booking notification to admin
   */
  async sendNewBookingAlert(booking: any): Promise<{ success: boolean; error?: string }> {
    const adminEmailStr = (import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim();

    if (!adminEmailStr) {
      console.warn('Admin email not configured');
      return { success: false, error: 'Admin email not configured' };
    }

    // Support multiple admin emails (comma-separated)
    const adminEmails = adminEmailStr.split(',').map((email: string) => email.trim()).filter(Boolean);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            background-color: #f3f4f6;
            padding: 40px 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.95;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .price-card {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 30px;
            text-align: center;
          }
          .price-card .amount {
            font-size: 36px;
            font-weight: 700;
            color: #92400e;
            margin: 8px 0;
          }
          .price-card .label {
            font-size: 14px;
            color: #78350f;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .booking-ref {
            background: #f3f4f6;
            padding: 12px 16px;
            border-radius: 8px;
            margin-top: 12px;
            font-size: 14px;
            color: #6b7280;
          }
          .booking-ref strong {
            color: #1f2937;
            font-weight: 600;
          }
          .section-card {
            background: #f9fafb;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid #e5e7eb;
          }
          .section-card h2 {
            margin: 0 0 20px 0;
            color: #111827;
            font-size: 18px;
            font-weight: 600;
            padding-bottom: 12px;
            border-bottom: 2px solid #ea580c;
          }
          .detail-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            min-width: 140px;
            color: #6b7280;
            font-size: 14px;
          }
          .detail-value {
            flex: 1;
            color: #1f2937;
            font-size: 14px;
          }
          .detail-value a {
            color: #ea580c;
            text-decoration: none;
          }
          .detail-value a:hover {
            text-decoration: underline;
          }
          .cta-container {
            text-align: center;
            margin-top: 30px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white;
            padding: 14px 32px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 6px rgba(234, 88, 12, 0.3);
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
          }
          .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 13px;
            padding: 30px;
            background: #f9fafb;
          }
          .footer p {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>🔔 New Booking Alert</h1>
              <p>Psychology Zone - Session Confirmed</p>
            </div>

            <div class="content">
              <div class="price-card">
                <div class="label">Session Price</div>
                <div class="amount">₹${booking.amount_paid / 100}</div>
                <div class="booking-ref">
                  <strong>Booking ID:</strong> ${booking.booking_ref}
                </div>
              </div>

              <div class="section-card">
                <h2>👤 Customer Information</h2>

                <div class="detail-row">
                  <span class="detail-label">Name</span>
                  <span class="detail-value">${booking.customer_name}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Email</span>
                  <span class="detail-value"><a href="mailto:${booking.customer_email}">${booking.customer_email}</a></span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Phone</span>
                  <span class="detail-value"><a href="tel:${booking.customer_phone}">${booking.customer_phone}</a></span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">City</span>
                  <span class="detail-value">${booking.city}</span>
                </div>
              </div>

              <div class="section-card">
                <h2>📅 Session Details</h2>

                <div class="detail-row">
                  <span class="detail-label">Issue Type</span>
                  <span class="detail-value" style="text-transform: capitalize; font-weight: 600; color: #ea580c;">${booking.problem}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Date</span>
                  <span class="detail-value">${new Date(booking.appointment_date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Time</span>
                  <span class="detail-value">${this.formatTime(booking.appointment_time)}</span>
                </div>

                <div class="detail-row">
                  <span class="detail-label">Background</span>
                  <span class="detail-value">${booking.circumstances}</span>
                </div>
              </div>

              <div class="cta-container">
                <a href="https://psychology-zone-v2.vercel.app/admin" class="button">
                  View in Admin Dashboard →
                </a>
              </div>
            </div>

            <div class="footer">
              <p>This is an automated notification from your Psychology Zone booking system.</p>
              <p>© ${new Date().getFullYear()} Psychology Zone. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmails,
      subject: `🔔 New Booking: ${booking.customer_name} - ${booking.booking_ref}`,
      html
    });
  }

  /**
   * Generic email sender using Resend API
   */
  private async sendEmail(data: EmailData): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      console.warn('Resend API key not configured - skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.from,
          to: data.to,
          subject: data.subject,
          html: data.html
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Resend API error:', result);
        return { success: false, error: result.message || `HTTP ${response.status}` };
      }

      console.log('Email sent successfully:', result);
      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format time for display (12-hour format)
   */
  private formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
}

export const emailService = new EmailService();
