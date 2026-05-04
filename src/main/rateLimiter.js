// rateLimiter.js — API Rate Limiting Logic
const rateLimit = {};

const LIMIT = 60; // Max 60 requests
const WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Basic in-memory rate limiter
 * @param {string} ip - Requesting IP address
 * @returns {boolean} - True if allowed, false if limited
 */
function isRateLimited(ip) {
  const now = Date.now();
  
  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }

  if (now > rateLimit[ip].resetAt) {
    rateLimit[ip] = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }

  rateLimit[ip].count++;
  
  if (rateLimit[ip].count > LIMIT) {
    return true;
  }

  return false;
}

/**
 * Middleware version for Express/Next.js
 */
function rateLimitMiddleware(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((rateLimit[ip].resetAt - Date.now()) / 1000)
    });
  }
  
  next();
}

module.exports = { isRateLimited, rateLimitMiddleware };
