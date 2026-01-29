#!/usr/bin/env node

/**
 * Health Check Monitoring Script
 *
 * Calls the /api/health endpoint and verifies all services are operational.
 *
 * Usage:
 *   node scripts/health-check.js [url]
 *   node scripts/health-check.js https://book.psychologyzone.in
 *   node scripts/health-check.js http://localhost:4321
 *
 * Exit codes:
 *   0 - All services healthy
 *   1 - One or more services degraded or down
 *   2 - Health check failed (network error, invalid response, etc.)
 */

const https = require('https');
const http = require('http');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchUrl(url, redirectCount = 0, startTime = Date.now()) {
  // Prevent infinite redirect loops
  if (redirectCount > 5) {
    throw new Error('Too many redirects (max 5)');
  }

  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      // Handle redirects (3xx status codes)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Resolve relative redirects
        const redirectUrl = new URL(res.headers.location, url).href;

        // Follow redirect
        fetchUrl(redirectUrl, redirectCount + 1, startTime)
          .then(resolve)
          .catch(reject);
        return;
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;

        try {
          const json = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: json,
            responseTime
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout (10s)'));
    });
  });
}

async function fetchHealthCheck(baseUrl) {
  const healthUrl = `${baseUrl}/api/health`;
  return fetchUrl(healthUrl);
}

function getStatusIcon(status) {
  switch (status) {
    case 'ok':
    case 'healthy':
      return '✅';
    case 'degraded':
      return '⚠️ ';
    case 'down':
      return '❌';
    default:
      return '❓';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'ok':
    case 'healthy':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'down':
      return 'red';
    default:
      return 'gray';
  }
}

async function runHealthCheck(baseUrl) {
  log('', 'reset');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('  🏥 Psychology Zone - Health Check Monitor', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('', 'reset');
  log(`📡 Checking: ${baseUrl}`, 'blue');
  log(`⏰ Time: ${new Date().toLocaleString()}`, 'gray');
  log('', 'reset');

  try {
    const result = await fetchHealthCheck(baseUrl);
    const { statusCode, data, responseTime } = result;

    // Log overall status
    const overallIcon = getStatusIcon(data.status);
    const overallColor = getStatusColor(data.status);
    log(`${overallIcon} Overall Status: ${data.status.toUpperCase()}`, overallColor);
    log(`⚡ Response Time: ${responseTime}ms`, 'gray');
    log(`🔢 HTTP Status: ${statusCode}`, 'gray');
    log('', 'reset');

    // Log individual services
    log('📊 Service Details:', 'blue');
    log('', 'reset');

    const services = data.services || {};
    const serviceNames = {
      database: 'Database (Supabase)',
      email: 'Email (Resend)',
      payment: 'Payment (Razorpay)',
      whatsapp: 'WhatsApp (Interakt)'
    };

    let hasIssues = false;

    for (const [key, service] of Object.entries(services)) {
      const icon = getStatusIcon(service.status);
      const color = getStatusColor(service.status);
      const name = serviceNames[key] || key;

      let statusLine = `${icon} ${name}: ${service.status.toUpperCase()}`;

      if (service.message) {
        statusLine += ` - ${service.message}`;
      }

      if (service.responseTime) {
        statusLine += ` (${service.responseTime}ms)`;
      }

      log(statusLine, color);

      if (service.status !== 'ok') {
        hasIssues = true;
      }
    }

    log('', 'reset');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('', 'reset');

    // Determine exit code
    if (data.status === 'healthy') {
      log('✨ All systems operational!', 'green');
      log('', 'reset');
      return 0;
    } else if (data.status === 'degraded') {
      log('⚠️  System degraded - some services have issues', 'yellow');
      log('', 'reset');
      return 1;
    } else {
      log('🚨 System down - critical services unavailable', 'red');
      log('', 'reset');
      return 1;
    }

  } catch (error) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('', 'reset');
    log('❌ Health Check Failed', 'red');
    log('', 'reset');
    log(`Error: ${error.message}`, 'red');
    log('', 'reset');
    log('Possible causes:', 'yellow');
    log('  • Server is down or unreachable', 'gray');
    log('  • Network connectivity issues', 'gray');
    log('  • Health endpoint not deployed', 'gray');
    log('  • Invalid URL provided', 'gray');
    log('', 'reset');
    return 2;
  }
}

// Main execution
(async () => {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'https://book.psychologyzone.in';

  // Validate URL
  try {
    new URL(baseUrl);
  } catch (error) {
    log('❌ Invalid URL provided', 'red');
    log('', 'reset');
    log('Usage: node scripts/health-check.js [url]', 'gray');
    log('Example: node scripts/health-check.js https://book.psychologyzone.in', 'gray');
    log('', 'reset');
    process.exit(2);
  }

  const exitCode = await runHealthCheck(baseUrl);
  process.exit(exitCode);
})();
