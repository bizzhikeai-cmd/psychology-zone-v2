// Interakt WhatsApp Integration Service

interface InteraktPayload {
  countryCode: string;
  phoneNumber: string;
  callbackData?: string;
  type: 'Template';
  template: {
    name: string;
    languageCode: string;
    headerValues?: string[];
    bodyValues?: string[];
    buttonValues?: Record<string, string[]>;
  };
}

interface AppointmentData {
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  booking_ref: string;
}

interface AdminNotificationData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  problem: string;
  appointment_date: string;
  appointment_time: string;
  booking_ref: string;
  amount: number;
}

interface FeedbackRequestData {
  customer_name: string;
  customer_phone: string;
  booking_ref: string;
  appointment_date: string;
}

interface CartAbandonedData {
  customer_name: string;
  customer_phone: string;
  booking_ref: string;
  appointment_date: string;
  appointment_time: string;
  retry_link?: string;
}

interface SessionReminderData {
  customer_name: string;
  customer_phone: string;
  booking_ref: string;
  appointment_date: string;
  appointment_time: string;
}

interface PaymentFailedData {
  customer_name: string;
  customer_phone: string;
  booking_ref: string;
  appointment_date: string;
  appointment_time: string;
}

class InteraktService {
  private apiKey: string;
  private baseUrl: string = 'https://api.interakt.ai/v1/public/message/';

  constructor() {
    this.apiKey = import.meta.env.INTERAKT_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Interakt API key not configured');
    }
  }

  /**
   * Normalize phone number - extract digits only and ensure proper format
   */
  private normalizePhone(phone: string): { countryCode: string; phoneNumber: string } {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle Indian numbers
    if (cleaned.length === 10) {
      // 10 digit number without country code
      return { countryCode: '91', phoneNumber: cleaned };
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // 12 digit number with 91 prefix
      return { countryCode: '91', phoneNumber: cleaned.slice(2) };
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      // 11 digit number starting with 0
      return { countryCode: '91', phoneNumber: cleaned.slice(1) };
    }
    
    // Default: assume first 2 digits are country code
    return { 
      countryCode: cleaned.slice(0, 2) || '91', 
      phoneNumber: cleaned.slice(2) || cleaned 
    };
  }

  /**
   * Format date for display (Monday, 6 January 2025)
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('en-IN', options);
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

  /**
   * Send customer appointment confirmation via WhatsApp
   * Template: appointment_confirmation (Utility)
   * Variables: {{1}}=name, {{2}}=date, {{3}}=time, {{4}}=booking_ref
   */
  async sendCustomerConfirmation(data: AppointmentData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_CUSTOMER_TEMPLATE || 'appointment_confirmation',
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

  /**
   * Send admin notification for new booking via WhatsApp
   * Template: new_booking_admin
   */
  async sendAdminNotification(data: AdminNotificationData): Promise<{ success: boolean; error?: string }> {
    const adminPhone = import.meta.env.ADMIN_WHATSAPP_NUMBER || '918968900002';
    const { countryCode, phoneNumber } = this.normalizePhone(adminPhone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_ADMIN_TEMPLATE || 'new_booking_admin',
        languageCode: 'en',
        bodyValues: [
          data.booking_ref,
          data.customer_name,
          data.customer_phone,
          data.customer_email,
          data.problem,
          this.formatDate(data.appointment_date),
          this.formatTime(data.appointment_time),
          `₹${data.amount}`
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send feedback request to customer after session completion
   * Template: session_feedback_prompt (Marketing)
   * Variables: {{1}}=name
   */
  async sendFeedbackRequest(data: FeedbackRequestData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_FEEDBACK_TEMPLATE || 'session_feedback_prompt',
        languageCode: 'en',
        bodyValues: [
          data.customer_name
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send abandoned cart reminder (1st message - no discount)
   * Template: payment_incomplete_notification (Marketing)
   * Variables: {{1}}=name, {{2}}=date, {{3}}=time, {{4}}=retry_link
   */
  async sendCartAbandonedReminder(data: CartAbandonedData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    // Generate retry link
    const siteUrl = import.meta.env.SITE_URL || 'https://psychologyzone.in';
    const retryLink = data.retry_link || `${siteUrl}/retry-booking?ref=${data.booking_ref}`;
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_ABANDONED_TEMPLATE || 'payment_incomplete_notification',
        languageCode: 'en',
        bodyValues: [
          data.customer_name,
          this.formatDate(data.appointment_date),
          this.formatTime(data.appointment_time),
          retryLink
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send 24-hour session reminder
   * Template: appointment_reminder (Utility)
   * Variables: {{1}}=name, {{2}}=date, {{3}}=time
   */
  async send24hReminder(data: SessionReminderData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_REMINDER_TEMPLATE || 'appointment_reminder',
        languageCode: 'en',
        bodyValues: [
          data.customer_name,
          this.formatDate(data.appointment_date),
          this.formatTime(data.appointment_time)
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send cart recovery offer (2nd message - with ₹50 discount)
   * Template: cart_recovery_offer (Marketing)
   * Variables: {{1}}=booking_ref (for URL), {{2}}=name, {{3}}=date, {{4}}=time
   * NOTE: Variables reordered because Interakt requires dynamic URLs to use {{1}}
   */
  async sendCartRecoveryOffer(data: CartAbandonedData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_CART_RECOVERY_TEMPLATE || 'cart_recovery_offer',
        languageCode: 'en',
        bodyValues: [
          data.booking_ref,  // {{1}} - for URL button
          data.customer_name, // {{2}}
          this.formatDate(data.appointment_date), // {{3}}
          this.formatTime(data.appointment_time)  // {{4}}
        ],
        buttonValues: {
          '1': [data.booking_ref]  // URL button uses {{1}}
        }
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send payment failed notification with retry link
   * Template: payment_failed_alert (Marketing)
   * Variables: {{1}}=name, {{2}}=date, {{3}}=time, {{4}}=retry_link
   */
  async sendPaymentFailedAlert(data: PaymentFailedData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const siteUrl = import.meta.env.SITE_URL || 'https://psychologyzone.in';
    const retryLink = `${siteUrl}/retry-booking?ref=${data.booking_ref}`;
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: import.meta.env.INTERAKT_PAYMENT_FAILED_TEMPLATE || 'payment_failed_alert',
        languageCode: 'en',
        bodyValues: [
          data.customer_name,
          this.formatDate(data.appointment_date),
          this.formatTime(data.appointment_time),
          retryLink
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * @deprecated Use sendCartAbandonedReminder instead
   */
  async sendCheckoutAbandonedReminder(data: CartAbandonedData): Promise<{ success: boolean; error?: string }> {
    return this.sendCartAbandonedReminder(data);
  }

  /**
   * Generic message sender
   */
  private async sendMessage(payload: InteraktPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'Interakt API key not configured' };
    }

    console.log('📤 Sending to Interakt API:', {
      url: this.baseUrl,
      template: payload.template.name,
      phone: `+${payload.countryCode}${payload.phoneNumber}`
    });

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      console.log('📥 Interakt API Response:', {
        status: response.status,
        ok: response.ok,
        data: JSON.stringify(responseData, null, 2)
      });

      if (!response.ok) {
        console.error('❌ Interakt API error:', responseData);
        return { 
          success: false, 
          error: responseData.message || responseData.error || `HTTP ${response.status}` 
        };
      }

      if (responseData.result === false || responseData.success === false) {
        console.error('❌ Interakt returned failure:', responseData);
        return {
          success: false,
          error: responseData.message || responseData.error || 'Unknown Interakt error'
        };
      }

      console.log('✅ Interakt message sent successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Interakt send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const interaktService = new InteraktService();

// Export types for use in API routes
export type { 
  AppointmentData, 
  AdminNotificationData, 
  FeedbackRequestData, 
  CartAbandonedData,
  SessionReminderData,
  PaymentFailedData 
};
