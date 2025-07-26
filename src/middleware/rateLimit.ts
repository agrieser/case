import { SlashCommand } from '@slack/bolt';

interface RateLimitEntry {
  timestamps: number[];
  blockedUntil?: number;
}

// Store rate limit data in memory (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 60, // 60 requests per window (1 per second)
  blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes after violation
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(
      t => now - t < RATE_LIMIT_CONFIG.windowMs
    );

    // Remove entry if no recent activity and not blocked
    if (entry.timestamps.length === 0 && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

export function checkRateLimit(command: SlashCommand): { allowed: boolean; message?: string } {
  const now = Date.now();
  const key = `${command.team_id}:${command.user_id}:${command.command}`;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Check if user is blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const remainingTime = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `⚠️ Rate limit exceeded. Please wait ${remainingTime} seconds before trying again.`,
    };
  }

  // Remove old timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    t => now - t < RATE_LIMIT_CONFIG.windowMs
  );

  // Check if limit exceeded
  if (entry.timestamps.length >= RATE_LIMIT_CONFIG.maxRequests) {
    // Block the user
    entry.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
    return {
      allowed: false,
      message: '⚠️ Rate limit exceeded. You\'ve made too many requests. Please wait 5 minutes before trying again.',
    };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  return { allowed: true };
}

// Optional: Get rate limit status for monitoring
export function getRateLimitStatus(teamId: string, userId: string, command: string): {
  requests: number;
  remaining: number;
  blockedUntil?: Date;
} {
  const key = `${teamId}:${userId}:${command}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry) {
    return {
      requests: 0,
      remaining: RATE_LIMIT_CONFIG.maxRequests,
    };
  }

  // Filter current window timestamps
  const currentWindowTimestamps = entry.timestamps.filter(
    t => now - t < RATE_LIMIT_CONFIG.windowMs
  );

  return {
    requests: currentWindowTimestamps.length,
    remaining: Math.max(0, RATE_LIMIT_CONFIG.maxRequests - currentWindowTimestamps.length),
    blockedUntil: entry.blockedUntil && entry.blockedUntil > now
      ? new Date(entry.blockedUntil)
      : undefined,
  };
}
