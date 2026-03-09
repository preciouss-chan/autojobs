/**
 * Rate Limiting Utility for API Endpoints
 * 
 * Provides in-memory rate limiting with automatic cleanup.
 * For production, consider using Redis for distributed rate limiting.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Store rate limit records: key = userId:endpoint
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extract a unique identifier from the request (IP address as fallback)
 */
export function getIdentifierFromRequest(req: Request): string {
  // Try to get forwarded IP (behind proxy/CDN)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Try to get real IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP or generic identifier
  return "unknown-client";
}

/**
 * Check if a request should be rate limited
 * 
 * @param userId - Unique user identifier (email or ID)
 * @param endpoint - API endpoint name (e.g., "tailor", "chat")
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 * @returns Object with allowed status and retry info
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  // If no record exists or window has expired, create new record
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: limit - 1 };
  }

  // Increment count
  record.count++;

  // Check if limit exceeded
  if (record.count > limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter
    };
  }

  return {
    allowed: true,
    remaining: limit - record.count
  };
}

/**
 * Rate limit presets for different endpoints
 */
export const RATE_LIMIT_PRESETS = {
  // Expensive endpoints - strict limits
  TAILOR: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  CHAT: { limit: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  PARSE_RESUME: { limit: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour
  EXTRACT_REQUIREMENTS: { limit: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour

  // Less expensive endpoints - relaxed limits
  EXPORT: { limit: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  CREDITS: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
} as const;

/**
 * Format rate limit error response
 */
export function rateLimitErrorResponse(retryAfter?: number) {
  return {
    error: "Rate limit exceeded",
    message: "You have exceeded the request limit. Please try again later.",
    retryAfter: retryAfter || 60
  };
}
