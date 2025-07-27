import { SlackCommandMiddlewareArgs } from '@slack/bolt';

/**
 * Input validation middleware for Slack commands
 */

// Constants for validation limits
const LIMITS = {
  TITLE_MAX_LENGTH: 200,
  TITLE_MIN_LENGTH: 1,
  INVESTIGATION_NAME_PATTERN: /^case-[a-z]+-[a-z]+(-[a-z0-9]+)?$/,
  COMMAND_MAX_LENGTH: 500,
} as const;

// Common XSS patterns to block
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:\s*/gi,
  /on\w+\s*=/gi, // onclick=, onload=, etc.
  /<img[^>]*>/gi,
  /<svg[^>]*>/gi,
];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  let sanitized = input.trim();

  // Remove any potential XSS attempts
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return sanitized;
}

/**
 * Validate investigation title
 */
export function validateTitle(title: string): string {
  const trimmed = title.trim();

  if (!trimmed || trimmed.length < LIMITS.TITLE_MIN_LENGTH) {
    throw new ValidationError('Title cannot be empty');
  }

  if (trimmed.length > LIMITS.TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be less than ${LIMITS.TITLE_MAX_LENGTH} characters`);
  }

  // Check for suspicious patterns
  if (trimmed.includes('..') || trimmed.includes('//') || trimmed.includes('\\\\')) {
    throw new ValidationError('Title contains invalid characters');
  }

  return sanitizeInput(trimmed);
}

/**
 * Validate investigation name format
 */
export function validateInvestigationName(name: string): string {
  const trimmed = name.trim().toLowerCase();

  if (!trimmed) {
    throw new ValidationError('Investigation name cannot be empty');
  }

  if (!LIMITS.INVESTIGATION_NAME_PATTERN.test(trimmed)) {
    throw new ValidationError('Invalid investigation name format. Expected: case-adjective-animal');
  }

  return trimmed;
}

/**
 * Validate command text to prevent injection
 */
export function validateCommandText(text: string): string {
  if (text.length > LIMITS.COMMAND_MAX_LENGTH) {
    throw new ValidationError('Command text too long');
  }

  // Check for command injection attempts
  const dangerousPatterns = [
    /[;&|`$(){}[\]<>]/g, // Shell metacharacters
    /\.\.\//g,           // Directory traversal
    /\x00/g,             // Null bytes
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(text)) {
      throw new ValidationError('Command contains invalid characters');
    }
  }

  return text.trim();
}

/**
 * Validate Slack user ID format
 */
export function validateSlackUserId(userId: string): string {
  // Slack user IDs follow pattern: U[0-9A-Z]{8,}
  const userIdPattern = /^U[0-9A-Z]{8,}$/;

  if (!userIdPattern.test(userId)) {
    throw new ValidationError('Invalid Slack user ID format');
  }

  return userId;
}

/**
 * Validate Slack channel ID format
 */
export function validateSlackChannelId(channelId: string): string {
  // Slack channel IDs follow pattern: C[0-9A-Z]{8,}
  const channelIdPattern = /^C[0-9A-Z]{8,}$/;

  if (!channelIdPattern.test(channelId)) {
    throw new ValidationError('Invalid Slack channel ID format');
  }

  return channelId;
}

/**
 * Parse and validate command arguments
 */
export function parseCommandArgs(text: string): { subcommand: string; args: string } {
  const validated = validateCommandText(text);
  const parts = validated.split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ');

  return { subcommand, args };
}

/**
 * Validate command context
 */
export function validateCommandContext(command: SlackCommandMiddlewareArgs['command']): void {
  // Validate required fields
  if (!command.user_id) {
    throw new ValidationError('Missing user ID');
  }

  if (!command.channel_id) {
    throw new ValidationError('Missing channel ID');
  }

  // Validate formats
  validateSlackUserId(command.user_id);
  validateSlackChannelId(command.channel_id);

  // Validate command matches expected pattern
  if (command.command !== '/case') {
    throw new ValidationError('Invalid command');
  }
}

/**
 * Create a safe error message for user display
 */
export function createSafeErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return `⚠️ ${error.message}`;
  }

  // Don't expose internal errors to users
  console.error('Internal error:', error);
  return '⚠️ An error occurred. Please try again.';
}
