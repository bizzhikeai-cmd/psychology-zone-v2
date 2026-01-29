#!/usr/bin/env node

/**
 * Pre-Commit Secret Detection Script
 *
 * Scans staged files for accidentally committed secrets, API keys, and credentials.
 * Prevents sensitive data from being committed to git.
 *
 * Exit codes:
 *   0 - No secrets detected (safe to commit)
 *   1 - Secrets detected (blocks commit)
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Secret patterns to detect
const SECRET_PATTERNS = [
  {
    name: 'Resend API Key',
    pattern: /re_[a-zA-Z0-9]{32,}/g,
    severity: 'critical'
  },
  {
    name: 'Razorpay Live Key',
    pattern: /rzp_live_[a-zA-Z0-9]{14}/g,
    severity: 'critical'
  },
  {
    name: 'Razorpay Test Key',
    pattern: /rzp_test_[a-zA-Z0-9]{14}/g,
    severity: 'medium'
  },
  {
    name: 'Supabase Anon Key',
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    severity: 'high'
  },
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key\s*[:=]\s*['"]([a-zA-Z0-9_-]{20,})['"]/gi,
    severity: 'high'
  },
  {
    name: 'Password in Code',
    pattern: /password\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    severity: 'high'
  },
  {
    name: 'Hardcoded Secret',
    pattern: /secret\s*[:=]\s*['"]([a-zA-Z0-9_-]{16,})['"]/gi,
    severity: 'high'
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
    severity: 'critical'
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical'
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical'
  }
];

// Files that should NEVER be committed
const FORBIDDEN_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.staging',
  'credentials.json',
  'serviceAccount.json',
  'secrets.json'
];

// Files/directories to skip checking
const SKIP_PATTERNS = [
  '.git/',
  'node_modules/',
  'dist/',
  '.vercel/',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.DS_Store',
  '.env.example',  // Example files are OK
  '.env.template',
  'README.md',  // Documentation is OK
  'scripts/check-secrets.cjs',  // Don't check ourselves
  '.github/workflows/'  // GitHub Actions workflows may contain dummy values for builds
];

function shouldSkipFile(filename) {
  return SKIP_PATTERNS.some(pattern => filename.includes(pattern));
}

function getStagedFiles() {
  try {
    // Safe: No user input, only calling git with fixed arguments
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f && !shouldSkipFile(f));
  } catch (error) {
    console.error(`${colors.red}Error getting staged files:${colors.reset}`, error.message);
    return [];
  }
}

function scanFileForSecrets(filename) {
  try {
    const content = fs.readFileSync(filename, 'utf8');
    const findings = [];

    for (const { name, pattern, severity } of SECRET_PATTERNS) {
      const matches = content.matchAll(pattern);

      for (const match of matches) {
        // Get line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        findings.push({
          file: filename,
          line: lineNumber,
          pattern: name,
          severity,
          preview: match[0].substring(0, 40) + (match[0].length > 40 ? '...' : '')
        });
      }
    }

    return findings;
  } catch (error) {
    // File might be binary or deleted
    return [];
  }
}

function checkForbiddenFiles(stagedFiles) {
  const forbidden = stagedFiles.filter(file =>
    FORBIDDEN_FILES.some(forbiddenFile => file.endsWith(forbiddenFile))
  );

  if (forbidden.length > 0) {
    console.log(`\n${colors.red}${colors.bold}🚨 FORBIDDEN FILES DETECTED!${colors.reset}\n`);
    console.log(`${colors.red}The following files should NEVER be committed:${colors.reset}\n`);

    forbidden.forEach(file => {
      console.log(`${colors.red}  ❌ ${file}${colors.reset}`);
    });

    console.log(`\n${colors.yellow}To unstage these files:${colors.reset}`);
    forbidden.forEach(file => {
      console.log(`  git reset HEAD ${file}`);
    });
    console.log('');

    return true;
  }

  return false;
}

function main() {
  console.log(`${colors.cyan}${colors.bold}🔒 Scanning for secrets...${colors.reset}\n`);

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`${colors.yellow}No staged files to check${colors.reset}`);
    process.exit(0);
  }

  console.log(`${colors.blue}Checking ${stagedFiles.length} staged file(s)...${colors.reset}\n`);

  // Check for forbidden files
  const hasForbiddenFiles = checkForbiddenFiles(stagedFiles);

  // Scan for secrets in allowed files
  const allFindings = [];
  for (const file of stagedFiles) {
    const findings = scanFileForSecrets(file);
    allFindings.push(...findings);
  }

  // Display results
  if (allFindings.length === 0 && !hasForbiddenFiles) {
    console.log(`${colors.green}✅ No secrets detected${colors.reset}`);
    console.log(`${colors.green}✅ Safe to commit${colors.reset}\n`);
    process.exit(0);
  }

  if (allFindings.length > 0) {
    console.log(`${colors.red}${colors.bold}🚨 POTENTIAL SECRETS DETECTED!${colors.reset}\n`);

    // Group by severity
    const critical = allFindings.filter(f => f.severity === 'critical');
    const high = allFindings.filter(f => f.severity === 'high');
    const medium = allFindings.filter(f => f.severity === 'medium');

    if (critical.length > 0) {
      console.log(`${colors.red}${colors.bold}CRITICAL (${critical.length}):${colors.reset}`);
      critical.forEach(finding => {
        console.log(`  ${colors.red}❌ ${finding.file}:${finding.line}${colors.reset}`);
        console.log(`     Pattern: ${finding.pattern}`);
        console.log(`     Preview: ${finding.preview}\n`);
      });
    }

    if (high.length > 0) {
      console.log(`${colors.yellow}${colors.bold}HIGH (${high.length}):${colors.reset}`);
      high.forEach(finding => {
        console.log(`  ${colors.yellow}⚠️  ${finding.file}:${finding.line}${colors.reset}`);
        console.log(`     Pattern: ${finding.pattern}`);
        console.log(`     Preview: ${finding.preview}\n`);
      });
    }

    if (medium.length > 0) {
      console.log(`${colors.blue}MEDIUM (${medium.length}):${colors.reset}`);
      medium.forEach(finding => {
        console.log(`  ${colors.blue}ℹ️  ${finding.file}:${finding.line}${colors.reset}`);
        console.log(`     Pattern: ${finding.pattern}\n`);
      });
    }

    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    console.log(`${colors.red}${colors.bold}❌ COMMIT BLOCKED${colors.reset}\n`);
    console.log(`${colors.yellow}What to do:${colors.reset}`);
    console.log(`  1. Remove hardcoded secrets from your code`);
    console.log(`  2. Use environment variables instead`);
    console.log(`  3. Verify ${colors.yellow}.env${colors.reset} files are in ${colors.yellow}.gitignore${colors.reset}`);
    console.log(`  4. If this is a false positive, update check-secrets.cjs\n`);
  }

  process.exit(1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { SECRET_PATTERNS, FORBIDDEN_FILES };
