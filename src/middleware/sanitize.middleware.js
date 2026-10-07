/**
 * Input sanitization middleware for AccessGate
 * Defends against common injection vectors:
 * 1. Null byte attacks (\0 / %00)
 * 2. Cross-Site Scripting (XSS) via <script>, <iframe>, <object>, etc.
 * 3. Dangerous URI protocols (javascript:, vbscript:, data:text/html)
 * 4. Inline HTML event handlers (onload, onerror, onclick, etc.)
 * 5. Prototype pollution & NoSQL query operators ($where, __proto__)
 */

/**
 * Sanitize a single string value
 * @param {string} str
 * @param {string} key
 * @returns {string}
 */
export const sanitizeString = (str, key = '') => {
  if (typeof str !== 'string') return str;

  // 1. Remove null byte injections
  let clean = str.replace(/\0/g, '').replace(/%00/g, '');

  // Preserve password strings without modifying symbols or hashing input
  if (key.toLowerCase().includes('password')) {
    return clean;
  }

  // 2. Strip dangerous tags and their content
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  clean = clean.replace(/<(object|embed|applet|base)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  clean = clean.replace(/<(object|embed|applet|base)[^>]*>/gi, '');

  // 3. Strip dangerous URI protocols
  clean = clean.replace(/(javascript|vbscript|data\s*:\s*text\/html)\s*:[^"']*/gi, '');

  // 4. Strip dangerous inline event handlers (onerror=, onload=, etc.)
  clean = clean.replace(/\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');

  return clean;
};

/**
 * Recursively sanitize objects, arrays, and primitive strings
 * @param {any} data
 * @param {string} parentKey
 * @returns {any}
 */
export const sanitizeData = (data, parentKey = '') => {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeString(data, parentKey);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, parentKey));
  }

  if (typeof data === 'object') {
    const cleanObj = {};
    for (const [key, value] of Object.entries(data)) {
      // Prevent prototype pollution or query operator injections ($gt, $where, __proto__)
      if (
        key.startsWith('$') ||
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype'
      ) {
        continue;
      }
      cleanObj[key] = sanitizeData(value, key);
    }
    return cleanObj;
  }

  return data;
};

/**
 * Global Express middleware for sanitizing req.body, req.query, and req.params
 */
export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeData(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeData(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeData(req.params);
  }
  next();
};

export default sanitizeInput;
