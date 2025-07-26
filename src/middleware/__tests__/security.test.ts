import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { isExternalUser, validateUserAccess, getUserContext } from '../security';
import { createMockCommand } from '../../test/utils/testHelpers';

describe('security middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isExternalUser', () => {
    it('should identify external user with underscore format', () => {
      expect(isExternalUser('U123456_T789012', 'T999999')).toBe(true);
      expect(isExternalUser('U123_T456_E789', 'T999999')).toBe(true);
    });

    it('should identify external user with W prefix', () => {
      expect(isExternalUser('W123456', 'T999999')).toBe(true);
      expect(isExternalUser('W1234567890', 'T999999')).toBe(true);
    });

    it('should identify internal users', () => {
      expect(isExternalUser('U123456', 'T999999')).toBe(false);
      expect(isExternalUser('U1234567890', 'T999999')).toBe(false);
    });

    it('should handle enterprise grid scenarios', () => {
      // For now, relies on ID format
      expect(isExternalUser('U123456', 'T999999', 'E123456')).toBe(false);
      expect(isExternalUser('U123_T456', 'T999999', 'E123456')).toBe(true);
    });
  });

  describe('validateUserAccess', () => {
    it('should allow internal users', () => {
      const command = createMockCommand({
        user_id: 'U123456',
        team_id: 'T999999',
      });

      expect(validateUserAccess(command)).toBeNull();
    });

    it('should block external users with underscore format', () => {
      const command = createMockCommand({
        user_id: 'U123456_T789012',
        team_id: 'T999999',
      });

      const result = validateUserAccess(command);
      expect(result).toBe('⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.');
    });

    it('should block external users with W prefix', () => {
      const command = createMockCommand({
        user_id: 'W123456',
        team_id: 'T999999',
      });

      const result = validateUserAccess(command);
      expect(result).toBe('⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.');
    });

    it('should handle missing user ID', () => {
      const command = createMockCommand({
        user_id: undefined as any,
        team_id: 'T999999',
      });

      const result = validateUserAccess(command);
      expect(result).toBe('⚠️ Invalid command context. Missing user or team information.');
    });

    it('should handle missing team ID', () => {
      const command = createMockCommand({
        user_id: 'U123456',
        team_id: undefined as any,
      });

      const result = validateUserAccess(command);
      expect(result).toBe('⚠️ Invalid command context. Missing user or team information.');
    });

    it('should respect ALLOWED_WORKSPACE_IDS when set', () => {
      process.env.ALLOWED_WORKSPACE_IDS = 'T111111,T222222';

      const allowedCommand = createMockCommand({
        user_id: 'U123456',
        team_id: 'T111111',
      });
      expect(validateUserAccess(allowedCommand)).toBeNull();

      const blockedCommand = createMockCommand({
        user_id: 'U123456',
        team_id: 'T999999',
      });
      expect(validateUserAccess(blockedCommand)).toBe('⚠️ This command is not available in this workspace.');
    });

    it('should handle whitespace in ALLOWED_WORKSPACE_IDS', () => {
      process.env.ALLOWED_WORKSPACE_IDS = ' T111111 , T222222 ';

      const command = createMockCommand({
        user_id: 'U123456',
        team_id: 'T111111',
      });
      expect(validateUserAccess(command)).toBeNull();
    });

    it('should allow all workspaces when ALLOWED_WORKSPACE_IDS is not set', () => {
      delete process.env.ALLOWED_WORKSPACE_IDS;

      const command = createMockCommand({
        user_id: 'U123456',
        team_id: 'T999999',
      });
      expect(validateUserAccess(command)).toBeNull();
    });
  });

  describe('getUserContext', () => {
    it('should extract full user context', () => {
      const command = createMockCommand({
        user_id: 'U123456',
        team_id: 'T999999',
        enterprise_id: 'E123456',
        channel_id: 'C123456',
        user_name: 'testuser',
        team_domain: 'testteam',
      });

      const context = getUserContext(command);
      expect(context).toEqual({
        userId: 'U123456',
        teamId: 'T999999',
        isExternal: false,
        enterpriseId: 'E123456',
        channelId: 'C123456',
        userName: 'testuser',
        teamDomain: 'testteam',
      });
    });

    it('should identify external user in context', () => {
      const command = createMockCommand({
        user_id: 'U123_T456',
        team_id: 'T999999',
      });

      const context = getUserContext(command);
      expect(context.isExternal).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const command = createMockCommand({
        user_id: 'U123456',
        team_id: 'T999999',
        channel_id: 'C123456',
      });
      // Remove optional fields
      delete (command as any).enterprise_id;
      delete (command as any).user_name;
      delete (command as any).team_domain;

      const context = getUserContext(command);
      expect(context).toEqual({
        userId: 'U123456',
        teamId: 'T999999',
        isExternal: false,
        enterpriseId: undefined,
        channelId: 'C123456',
        userName: undefined,
        teamDomain: undefined,
      });
    });

    it('should handle all missing fields gracefully', () => {
      const command = {} as any;

      const context = getUserContext(command);
      expect(context).toEqual({
        userId: 'unknown',
        teamId: 'unknown',
        isExternal: false,
        enterpriseId: undefined,
        channelId: 'unknown',
        userName: undefined,
        teamDomain: undefined,
      });
    });
  });
});