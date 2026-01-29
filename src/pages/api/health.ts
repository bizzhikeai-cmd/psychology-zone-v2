import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

/**
 * Health Check Endpoint
 *
 * Verifies all critical services are operational:
 * - Database (Supabase)
 * - Email service (Resend API key)
 * - Payment gateway (Razorpay keys)
 * - WhatsApp API (Interakt key)
 *
 * Usage:
 * - Monitor: curl https://book.psychologyzone.in/api/health
 * - Returns 200 if healthy, 503 if degraded
 */

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down';
  message?: string;
  responseTime?: number;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: ServiceStatus;
    email: ServiceStatus;
    payment: ServiceStatus;
    whatsapp: ServiceStatus;
  };
  version: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const startTime = Date.now();

  try {
    // Simple query to check connection
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'down',
        message: `Database error: ${error.message}`,
        responseTime
      };
    }

    return {
      status: 'ok',
      message: 'Connected',
      responseTime
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
}

function checkEmailService(): ServiceStatus {
  const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      status: 'down',
      message: 'RESEND_API_KEY not configured'
    };
  }

  if (!apiKey.startsWith('re_')) {
    return {
      status: 'degraded',
      message: 'Invalid API key format'
    };
  }

  // Check for newline corruption (the issue we had today)
  if (apiKey.includes('\n') || apiKey.includes('\r') || apiKey !== apiKey.trim()) {
    return {
      status: 'degraded',
      message: 'API key corrupted (contains newlines or whitespace)'
    };
  }

  return {
    status: 'ok',
    message: 'API key configured'
  };
}

function checkPaymentGateway(): ServiceStatus {
  const keyId = import.meta.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = import.meta.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return {
      status: 'down',
      message: 'Razorpay credentials not configured'
    };
  }

  if (!keyId.startsWith('rzp_')) {
    return {
      status: 'degraded',
      message: 'Invalid key ID format'
    };
  }

  if (keySecret.length < 20) {
    return {
      status: 'degraded',
      message: 'Invalid key secret length'
    };
  }

  return {
    status: 'ok',
    message: 'Credentials configured'
  };
}

function checkWhatsAppService(): ServiceStatus {
  const apiKey = import.meta.env.INTERAKT_API_KEY || process.env.INTERAKT_API_KEY;

  if (!apiKey) {
    return {
      status: 'down',
      message: 'INTERAKT_API_KEY not configured'
    };
  }

  if (apiKey.length < 10) {
    return {
      status: 'degraded',
      message: 'API key too short'
    };
  }

  // Check for corruption
  if (apiKey.includes('\n') || apiKey.includes('\r') || apiKey !== apiKey.trim()) {
    return {
      status: 'degraded',
      message: 'API key corrupted (contains newlines or whitespace)'
    };
  }

  return {
    status: 'ok',
    message: 'API key configured'
  };
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();

  try {
    // Run health checks
    const [database, email, payment, whatsapp] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkEmailService()),
      Promise.resolve(checkPaymentGateway()),
      Promise.resolve(checkWhatsAppService())
    ]);

    // Determine overall status
    const services = { database, email, payment, whatsapp };
    const statuses = Object.values(services).map(s => s.status);

    let overallStatus: 'healthy' | 'degraded' | 'down';
    if (statuses.every(s => s === 'ok')) {
      overallStatus = 'healthy';
    } else if (statuses.some(s => s === 'down')) {
      overallStatus = 'down';
    } else {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      version: '1.0.0'
    };

    const httpStatus = overallStatus === 'healthy' ? 200 : 503;

    console.log(`Health check completed in ${Date.now() - startTime}ms: ${overallStatus}`);

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: httpStatus,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'down',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'down', message: 'Health check failed' },
        email: { status: 'down', message: 'Health check failed' },
        payment: { status: 'down', message: 'Health check failed' },
        whatsapp: { status: 'down', message: 'Health check failed' }
      },
      version: '1.0.0'
    };

    return new Response(
      JSON.stringify(errorResponse, null, 2),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
};
