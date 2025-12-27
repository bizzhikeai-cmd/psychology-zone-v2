// Email notification service using Resend API
// Sign up at https://resend.com and get API key

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private apiKey: string;
  private from: string = 'Psychology Zone <noreply@psychologyzone.in>';

  constructor() {
    this.apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY || '';
  }

  /**
   * Send new booking notification to admin
   */
  async sendNewBookingAlert(booking: any): Promise<{ success: boolean; error?: string }> {
    const adminEmail = import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    
    if (!adminEmail) {
      console.warn('Admin email not configured');
      return { success: false, error: 'Admin email not configured' };
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6b5ce7 0%, #8b7cf7 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: 600; width: 150px; color: #6b7280; }
          .detail-value { flex: 1; color: #1f2937; }
          .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #6b5ce7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 0.85rem; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔔 New Booking Received</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Psychology Zone Admin Alert</p>
          </div>
          
          <div class="content">
            <div class="highlight">
              <strong>Booking Reference:</strong> ${booking.booking_ref}<br>
              <strong>Amount Paid:</strong> ₹${booking.amount_paid / 100}
            </div>

            <div class="booking-details">
              <h2 style="margin-top: 0; color: #1f2937;">Customer Information</h2>
              
              <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${booking.customer_name}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value"><a href="mailto:${booking.customer_email}">${booking.customer_email}</a></span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Phone:</span>
                <span class="detail-value"><a href="tel:${booking.customer_phone}">${booking.customer_phone}</a></span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">City:</span>
                <span class="detail-value">${booking.city}</span>
              </div>
            </div>

            <div class="booking-details">
              <h2 style="margin-top: 0; color: #1f2937;">Session Details</h2>
              
              <div class="detail-row">
                <span class="detail-label">Problem:</span>
                <span class="detail-value" style="text-transform: capitalize;">${booking.problem}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${new Date(booking.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${this.formatTime(booking.appointment_time)}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Circumstances:</span>
                <span class="detail-value">${booking.circumstances}</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="https://psychology-zone-v2.vercel.app/admin" class="button">
                View in Admin Dashboard →
              </a>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated notification from Psychology Zone booking system.</p>
            <p>© ${new Date().getFullYear()} Psychology Zone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
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
