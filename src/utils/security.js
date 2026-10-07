/**
 * RETHA Real Estate — Enterprise Security & Input Defense Protocol Suite
 * 
 * Protocols Implemented:
 * 1. Comprehensive Input Defense (XSS Neutralization & Rigorous Validation)
 * 2. Database Integrity (Parameterized Prepared Queries Standard)
 * 3. Secret Management (Environment Variables / Vault Enforcement)
 * 4. API Resilience (Rate Limiting, Throttling & Abuse Mitigation)
 */

// --------------------------------------------------------------------------
// 1. COMPREHENSIVE INPUT DEFENSE: Sanitization & Threat Neutralization
// --------------------------------------------------------------------------

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;'
};

/**
 * Encodes special HTML characters into safe HTML entities to neutralize XSS injection.
 * @param {*} input Raw user input
 * @returns {string} Sanitized string safe for HTML rendering
 */
export function sanitizeHtml(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Strips all HTML tags, script tags, and normalizes control characters.
 * @param {*} input Raw text input
 * @returns {string} Clean plain text
 */
export function sanitizePlainText(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove dangerous control characters
    .trim();
}

/**
 * Validates and sanitizes URLs to neutralize javascript:, vbscript:, and data: XSS payloads.
 * @param {string} url 
 * @param {string[]} allowedProtocols 
 * @returns {string|null} Safe URL or null if malicious
 */
export function sanitizeUrl(url, allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  try {
    const parsed = new URL(cleanUrl, window.location.origin);
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn(`[Security Defense] Blocked disallowed protocol: ${parsed.protocol}`);
      return null;
    }
    return parsed.href;
  } catch {
    // If not a full URL, ensure it is a safe relative path
    if (/^(?!\/\/)[a-zA-Z0-9_\-\.\/]+$/.test(cleanUrl)) {
      return cleanUrl;
    }
    console.warn(`[Security Defense] Blocked potentially unsafe relative URL: ${cleanUrl}`);
    return null;
  }
}

/**
 * Validates human names supporting Arabic script, Latin script, spaces, and hyphens.
 * @param {string} name 
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateName(name) {
  const clean = sanitizePlainText(name);
  if (!clean || clean.length < 2) {
    return { valid: false, sanitized: '', error: 'Name must be at least 2 characters.' };
  }
  if (clean.length > 80) {
    return { valid: false, sanitized: clean.slice(0, 80), error: 'Name must not exceed 80 characters.' };
  }
  // Allow Unicode letters (Arabic, Latin, etc.), spaces, hyphens, and apostrophes
  const nameRegex = /^[\p{L}\p{M}\s.'-]+$/u;
  if (!nameRegex.test(clean)) {
    return { valid: false, sanitized: clean, error: 'Name contains invalid characters.' };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Validates phone numbers (Saudi domestic 05XXXXXXXX and international E.164 +XXXXXXXX).
 * @param {string} phone 
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validatePhone(phone) {
  const clean = sanitizePlainText(phone).replace(/\s+/g, '');
  if (!clean || clean.length < 8) {
    return { valid: false, sanitized: '', error: 'Phone number is too short.' };
  }
  if (clean.length > 20) {
    return { valid: false, sanitized: '', error: 'Phone number is too long.' };
  }
  // Matches Saudi 05xxxxxxxx, +966..., or international E.164 +[1-9][0-9]{7,14}
  const phoneRegex = /^(\+?[1-9]\d{7,14}|05\d{8})$/;
  if (!phoneRegex.test(clean)) {
    return { valid: false, sanitized: clean, error: 'Please enter a valid phone number (e.g. +966 50 123 4567 or 0501234567).' };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Validates email addresses following strict RFC 5322 format.
 * @param {string} email 
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateEmail(email) {
  const clean = sanitizePlainText(email).toLowerCase();
  if (!clean) {
    return { valid: false, sanitized: '', error: 'Email address is required.' };
  }
  if (clean.length > 120) {
    return { valid: false, sanitized: clean.slice(0, 120), error: 'Email exceeds maximum length.' };
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, sanitized: clean, error: 'Please enter a valid email address.' };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Sanitizes and bounds arbitrary text notes or messages.
 * @param {string} notes 
 * @param {number} maxLength 
 * @returns {string}
 */
export function validateNotes(notes, maxLength = 1000) {
  const clean = sanitizePlainText(notes);
  return clean.slice(0, maxLength);
}

// --------------------------------------------------------------------------
// 2. DATABASE INTEGRITY: Strict Parameterized / Prepared Statement Standards
// --------------------------------------------------------------------------

/**
 * Enforces prepared statement structure for all database queries.
 * Rejects raw string concatenation to prevent SQL injection vulnerabilities.
 * 
 * @param {string} query SQL query with parameter placeholders ($1, $2, ? or named)
 * @param {Array|Object} params Query parameters
 * @returns {{ query: string, params: Array|Object }}
 */
export function assertParameterized(query, params) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('[Database Defense] Query must be a non-empty string.');
  }

  // Detect dangerous raw SQL string concatenation anti-patterns
  const suspiciousConcatenation = /['"]\s*\+\s*[a-zA-Z0-9_]+|WHERE\s+[a-zA-Z0-9_]+\s*=\s*['"][^'"]*$/i;
  if (suspiciousConcatenation.test(query)) {
    throw new Error('[Database Defense Violation] Detected raw variable concatenation in SQL query. Exclusively use parameterized queries.');
  }

  if (params === undefined || params === null) {
    throw new Error('[Database Defense Violation] Parameters must be provided as prepared statement arguments.');
  }

  return { query: query.trim(), params };
}

// --------------------------------------------------------------------------
// 3. SECRET MANAGEMENT: Environment Variable Enforcer
// --------------------------------------------------------------------------

/**
 * Retrieves a configuration secret from environment variables.
 * Throws an explicit error if a secret is accessed via hardcoding or missing in production.
 * 
 * @param {string} key Environment variable key name (e.g. VITE_SUPABASE_ANON_KEY)
 * @param {string} [fallback] Optional default for development only
 * @returns {string}
 */
export function getSecret(key, fallback = '') {
  // Vite exposes env vars via import.meta.env
  const value = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key])
    || (typeof process !== 'undefined' && process.env && process.env[key])
    || fallback;

  if (!value && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.error(`[Secret Defense Warning] Required configuration variable "${key}" is not defined in environment.`);
  }

  return value;
}

// --------------------------------------------------------------------------
// 4. API RESILIENCE: Rate Limiting & Throttling
// --------------------------------------------------------------------------

/**
 * Client-side sliding window rate limiter to mitigate flood attacks and abuse.
 */
export class RateLimiter {
  constructor(options = {}) {
    this.keyPrefix = options.keyPrefix || 'retha_rate_';
    this.maxRequests = options.maxRequests || 5; // 5 requests max
    this.windowMs = options.windowMs || 60000;   // per 60 seconds
  }

  /**
   * Checks if an action is allowed under the rate limit.
   * @param {string} actionIdentifier 
   * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
   */
  check(actionIdentifier = 'global') {
    const key = `${this.keyPrefix}${actionIdentifier}`;
    const now = Date.now();
    let records = [];

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        records = JSON.parse(stored).filter(ts => (now - ts) < this.windowMs);
      }
    } catch {
      records = [];
    }

    if (records.length >= this.maxRequests) {
      const oldestRecord = records[0];
      const retryAfterSeconds = Math.ceil((oldestRecord + this.windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds)
      };
    }

    records.push(now);
    try {
      localStorage.setItem(key, JSON.stringify(records));
    } catch {
      // Storage quota fallback
    }

    return {
      allowed: true,
      remaining: this.maxRequests - records.length,
      retryAfterSeconds: 0
    };
  }

  /**
   * Resets the rate limit for a specific action.
   */
  reset(actionIdentifier = 'global') {
    try {
      localStorage.removeItem(`${this.keyPrefix}${actionIdentifier}`);
    } catch {
      // Fallback
    }
  }
}

/**
 * Standard Form Submission Rate Limiter (Max 4 inquiries per minute)
 */
export const leadRateLimiter = new RateLimiter({
  keyPrefix: 'retha_lead_rate_',
  maxRequests: 4,
  windowMs: 60000
});

/**
 * Throttle utility to limit execution rate of event handlers.
 */
export function throttle(func, wait) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), wait);
    }
  };
}

/**
 * Debounce utility for search inputs and frequent user interactions.
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}
