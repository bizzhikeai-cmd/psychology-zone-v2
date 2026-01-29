#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 *
 * Validates all required environment variables to prevent corruption issues
 * like newlines, malformed values, or missing required variables.
 *
 * Exit codes:
 * 0 - All validations passed
 * 1 - Missing required variables
 * 2 - Format validation failed
 * 3 - Value corruption detected (newlines, whitespace, etc.)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

// Load environment variables from .env file
function loadEnvFile(envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};

    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;

      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    console.error(`${colors.red}Error reading .env file:${colors.reset}`, error.message);
    return null;
  }
}

// Validation rules for each environment variable
const validationRules = {
  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: {
    required: true,
    pattern: /^rzp_(test|live)_[A-Za-z0-9]+$/,
    description: 'Must start with rzp_test_ or rzp_live_',
    example: 'rzp_test_1234567890'
  },

  RAZORPAY_KEY_SECRET: {
    required: true,
    pattern: /^[A-Za-z0-9]+$/,
    minLength: 20,
    description: 'Alphanumeric, minimum 20 characters',
    example: 'abcdefghijklmnopqrst1234'
  },

  // Supabase Database
  SUPABASE_URL: {
    required: true,
    pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    description: 'Must be HTTPS URL ending with .supabase.co',
    example: 'https://yourproject.supabase.co'
  },

  SUPABASE_ANON_KEY: {
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    description: 'Must be valid JWT token starting with eyJ',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },

  SUPABASE_SERVICE_KEY: {
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    description: 'Must be valid JWT token starting with eyJ',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },

  // Interakt WhatsApp API
  INTERAKT_API_KEY: {
    required: true,
    minLength: 10,
    description: 'Interakt API key',
    example: 'your_interakt_api_key'
  },

  // Resend Email Service (THIS PREVENTED TODAY'S ISSUE)
  RESEND_API_KEY: {
    required: true,
    pattern: /^re_[A-Za-z0-9_]+$/,
    description: 'Must start with re_ and contain only alphanumeric characters',
    example: 're_abc123xyz',
    customValidation: (value) => {
      // Critical: Check for newlines (today's bug)
      if (value.includes('\n') || value.includes('\r')) {
        return 'Contains newline character - this will break email sending!';
      }
      // Check for trailing whitespace
      if (value !== value.trim()) {
        return 'Contains leading or trailing whitespace';
      }
      return null;
    }
  },

  // Admin Dashboard
  ADMIN_PASSWORD: {
    required: true,
    minLength: 8,
    description: 'Minimum 8 characters',
    example: 'SecurePassword123',
    customValidation: (value) => {
      if (value.includes(' ')) {
        return 'Password should not contain spaces';
      }
      return null;
    }
  },

  ADMIN_EMAIL: {
    required: true,
    description: 'Valid email address(es), comma-separated for multiple',
    example: 'admin@example.com,admin2@example.com',
    customValidation: (value) => {
      const emails = value.split(',').map(e => e.trim());
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of emails) {
        if (!emailPattern.test(email)) {
          return `Invalid email format: ${email}`;
        }
      }
      return null;
    }
  },

  // Google Tag Manager
  GTM_CONTAINER_ID: {
    required: false, // Optional
    pattern: /^GTM-[A-Z0-9]+$/,
    description: 'Must start with GTM-',
    example: 'GTM-XXXXXXX'
  },

  // Site Configuration
  SITE_URL: {
    required: true,
    pattern: /^https:\/\/.+$/,
    description: 'Must be valid HTTPS URL',
    example: 'https://book.psychologyzone.in',
    customValidation: (value) => {
      if (value.endsWith('/')) {
        return 'Should not end with trailing slash';
      }
      return null;
    }
  },

  // Cron Secret
  CRON_SECRET: {
    required: false, // Optional
    minLength: 16,
    description: 'Minimum 16 characters for security',
    example: 'random-secret-key-123456'
  },

  // WhatsApp Templates (optional)
  INTERAKT_CUSTOMER_TEMPLATE: {
    required: false,
    description: 'Template name for customer confirmation',
    example: 'appointment_confirmation'
  },

  INTERAKT_ADMIN_TEMPLATE: {
    required: false,
    description: 'Template name for admin notification',
    example: 'new_booking_admin'
  },

  INTERAKT_ABANDONED_TEMPLATE: {
    required: false,
    description: 'Template name for abandoned cart',
    example: 'cart_abandoned_reminder'
  },

  ADMIN_WHATSAPP_NUMBER: {
    required: false,
    pattern: /^[0-9]{10,15}$/,
    description: 'Phone number with country code, no + or spaces',
    example: '918968900002'
  }
};

// Validation functions
function validateVariable(key, value, rules) {
  const errors = [];

  // Check if value exists
  if (!value || value === '') {
    if (rules.required) {
      errors.push(`Missing required variable`);
    }
    return errors;
  }

  // Check for corruption (newlines, extra whitespace)
  if (value.includes('\n')) {
    errors.push(`Contains newline character (\\n) - CRITICAL BUG!`);
  }
  if (value.includes('\r')) {
    errors.push(`Contains carriage return (\\r)`);
  }
  // Check for literal \n string (from Vercel exports)
  if (value.includes('\\n')) {
    errors.push(`Contains literal "\\n" string - CRITICAL BUG from Vercel export!`);
  }
  if (value !== value.trim()) {
    errors.push(`Contains leading or trailing whitespace`);
  }

  // Check pattern
  if (rules.pattern && !rules.pattern.test(value)) {
    errors.push(`Invalid format. ${rules.description}`);
    errors.push(`Example: ${rules.example}`);
  }

  // Check minimum length
  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`Too short. Minimum ${rules.minLength} characters required`);
  }

  // Custom validation
  if (rules.customValidation) {
    const customError = rules.customValidation(value);
    if (customError) {
      errors.push(customError);
    }
  }

  return errors;
}

// Main validation function
function validateEnvironment(env, environment = 'development') {
  console.log(`${colors.blue}🔍 Validating ${environment} environment variables...${colors.reset}\n`);

  let hasErrors = false;
  let hasMissing = false;
  let hasCorruption = false;
  const results = [];

  // Check each variable
  for (const [key, rules] of Object.entries(validationRules)) {
    const value = env[key];
    const errors = validateVariable(key, value, rules);

    if (errors.length > 0) {
      hasErrors = true;

      // Check if it's a missing required variable
      if (errors.includes('Missing required variable')) {
        hasMissing = true;
      }

      // Check if it's corruption
      if (errors.some(e => e.includes('newline') || e.includes('whitespace'))) {
        hasCorruption = true;
      }

      results.push({
        key,
        status: 'error',
        errors,
        required: rules.required
      });
    } else if (value) {
      results.push({
        key,
        status: 'ok',
        value: maskValue(key, value)
      });
    } else if (!rules.required) {
      results.push({
        key,
        status: 'optional',
        value: 'Not set (optional)'
      });
    }
  }

  // Print results
  for (const result of results) {
    if (result.status === 'ok') {
      console.log(`${colors.green}✓${colors.reset} ${result.key}: ${colors.green}${result.value}${colors.reset}`);
    } else if (result.status === 'optional') {
      console.log(`${colors.yellow}○${colors.reset} ${result.key}: ${colors.yellow}${result.value}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗${colors.reset} ${result.key}:`);
      result.errors.forEach(error => {
        console.log(`  ${colors.red}→ ${error}${colors.reset}`);
      });
      console.log('');
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(60));

  if (!hasErrors) {
    console.log(`${colors.green}✅ All environment variables are valid!${colors.reset}\n`);
    return 0;
  } else {
    console.log(`${colors.red}❌ Validation failed!${colors.reset}\n`);

    if (hasCorruption) {
      console.log(`${colors.red}⚠️  CRITICAL: Environment variable corruption detected!${colors.reset}`);
      console.log(`${colors.red}   This will break production services.${colors.reset}\n`);
      return 3;
    }

    if (hasMissing) {
      console.log(`${colors.yellow}Missing required variables. Set them before deployment.${colors.reset}\n`);
      return 1;
    }

    console.log(`${colors.yellow}Format validation failed. Fix errors before deployment.${colors.reset}\n`);
    return 2;
  }
}

// Mask sensitive values for display
function maskValue(key, value) {
  const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];

  if (sensitiveKeys.some(k => key.includes(k))) {
    if (value.length <= 8) {
      return '***';
    }
    return value.slice(0, 4) + '***' + value.slice(-4);
  }

  return value;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const envPath = args[0] || path.join(process.cwd(), '.env');

  console.log(`${colors.magenta}Psychology Zone - Environment Validator${colors.reset}`);
  console.log(`Reading from: ${envPath}\n`);

  if (!fs.existsSync(envPath)) {
    console.error(`${colors.red}Error: File not found: ${envPath}${colors.reset}`);
    console.log(`\nUsage: node validate-env.js [path/to/.env]\n`);
    process.exit(1);
  }

  const env = loadEnvFile(envPath);

  if (!env) {
    console.error(`${colors.red}Failed to load environment file${colors.reset}\n`);
    process.exit(1);
  }

  // Determine environment name from filename
  const environment = path.basename(envPath).replace('.env', '') || 'development';

  const exitCode = validateEnvironment(env, environment);
  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { validateVariable, validationRules, loadEnvFile };
