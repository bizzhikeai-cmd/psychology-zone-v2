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
   * Format date for display (DD MMM YYYY)
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: 'short', 
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
   */
  async sendFeedbackRequest(data: FeedbackRequestData): Promise<{ success: boolean; error?: string }> {
    const { countryCode, phoneNumber } = this.normalizePhone(data.customer_phone);
    
    const payload: InteraktPayload = {
      countryCode,
      phoneNumber,
      callbackData: data.booking_ref,
      type: 'Template',
      template: {
        name: 'session_feedback_prompt',
        languageCode: 'en',
        bodyValues: [
          data.customer_name,
          this.formatDate(data.appointment_date)
        ]
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Generic message sender
   */
  private async sendMessage(payload: InteraktPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'Interakt API key not configured' };
    }

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

      if (!response.ok) {
        console.error('Interakt API error:', responseData);
        return { 
          success: false, 
          error: responseData.message || `HTTP ${response.status}` 
        };
      }

      console.log('Interakt message sent successfully:', responseData);
      return { success: true };
    } catch (error) {
      console.error('Interakt send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const interaktService = new InteraktService();

// Export types for use in API routes
export type { AppointmentData, AdminNotificationData, FeedbackRequestData };
