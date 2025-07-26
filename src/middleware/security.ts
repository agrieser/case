import { SlackCommandMiddlewareArgs } from '@slack/bolt';

/**
 * Security middleware for workspace and user validation
 */

/**
 * Check if a user is from an external workspace (Slack Connect)
 * External users have user IDs in format: U123_T456 or W123
 */
export function isExternalUser(userId: string, teamId: string, enterpriseId?: string): boolean {
  // Check for external user ID patterns
  // Format 1: U{user_id}_{team_id} for cross-workspace users
  if (userId.includes('_')) {
    return true;
  }
  
  // Format 2: W prefix indicates external workspace user
  if (userId.startsWith('W')) {
    return true;
  }
  
  // In enterprise grid, check if user's team differs from command origin
  if (enterpriseId && teamId) {
    // This would need additional context about user's home workspace
    // For now, we'll rely on the ID format checks above
  }
  
  return false;
}

/**
 * Validate that the user is allowed to use commands
 * Returns an error message if blocked, or null if allowed
 */
export function validateUserAccess(command: SlackCommandMiddlewareArgs['command']): string | null {
  const { user_id, team_id, enterprise_id } = command;
  
  if (!user_id || !team_id) {
    return '⚠️ Invalid command context. Missing user or team information.';
  }
  
  // Check if user is external
  if (isExternalUser(user_id, team_id, enterprise_id)) {
    return '⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.';
  }
  
  // Check if we should restrict to specific workspaces
  const allowedWorkspaces = process.env.ALLOWED_WORKSPACE_IDS?.split(',').map(id => id.trim());
  if (allowedWorkspaces && allowedWorkspaces.length > 0 && !allowedWorkspaces.includes(team_id)) {
    return '⚠️ This command is not available in this workspace.';
  }
  
  return null; // Access allowed
}

/**
 * Get user context for logging and debugging
 */
export function getUserContext(command: SlackCommandMiddlewareArgs['command']): {
  userId: string;
  teamId: string;
  isExternal: boolean;
  enterpriseId?: string;
  channelId: string;
  userName?: string;
  teamDomain?: string;
} {
  const { user_id, team_id, enterprise_id, channel_id, user_name, team_domain } = command;
  
  return {
    userId: user_id || 'unknown',
    teamId: team_id || 'unknown',
    isExternal: isExternalUser(user_id || '', team_id || '', enterprise_id),
    enterpriseId: enterprise_id,
    channelId: channel_id || 'unknown',
    userName: user_name,
    teamDomain: team_domain,
  };
}