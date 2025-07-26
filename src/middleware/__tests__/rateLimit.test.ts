import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { checkRateLimit, getRateLimitStatus } from '../rateLimit';
import { SlashCommand } from '@slack/bolt';

describe('Rate Limiting', () => {
  // Helper to create mock command
  const createMockCommand = (userId = 'U123', teamId = 'T123'): SlashCommand => ({
    token: 'token',
    team_id: teamId,
    team_domain: 'test',
    channel_id: 'C123',
    channel_name: 'test',
    user_id: userId,
    user_name: 'test',
    command: '/trace',
    text: 'test',
    api_app_id: 'A123',
    is_enterprise_install: 'false',
    response_url: 'https://test.com',
    trigger_id: 'trigger123'
  });

  beforeEach(() => {
    // Clear rate limit store by advancing time
    jest.useFakeTimers();
    jest.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    jest.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', () => {
      const command = createMockCommand();
      
      // Make 59 requests (under limit of 60)
      for (let i = 0; i < 59; i++) {
        const result = checkRateLimit(command);
        expect(result.allowed).toBe(true);
        expect(result.message).toBeUndefined();
      }
      
      // 60th request should still be allowed
      const result = checkRateLimit(command);
      expect(result.allowed).toBe(true);
    });

    it('should block requests over the limit', () => {
      const command = createMockCommand();
      
      // Make 60 requests (at limit)
      for (let i = 0; i < 60; i++) {
        checkRateLimit(command);
      }
      
      // 61st request should be blocked
      const result = checkRateLimit(command);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
      expect(result.message).toContain('5 minutes');
    });

    it('should track rate limits per user', () => {
      const command1 = createMockCommand('U123');
      const command2 = createMockCommand('U456');
      
      // Max out user 1
      for (let i = 0; i < 60; i++) {
        checkRateLimit(command1);
      }
      
      // User 1 should be blocked
      expect(checkRateLimit(command1).allowed).toBe(false);
      
      // User 2 should still be allowed
      expect(checkRateLimit(command2).allowed).toBe(true);
    });

    it('should track rate limits per team', () => {
      const command1 = createMockCommand('U123', 'T123');
      const command2 = createMockCommand('U123', 'T456');
      
      // Max out team 1
      for (let i = 0; i < 60; i++) {
        checkRateLimit(command1);
      }
      
      // Team 1 should be blocked
      expect(checkRateLimit(command1).allowed).toBe(false);
      
      // Team 2 should still be allowed
      expect(checkRateLimit(command2).allowed).toBe(true);
    });

    it('should reset after the time window', () => {
      jest.useFakeTimers();
      const command = createMockCommand();
      
      // Max out the limit
      for (let i = 0; i < 60; i++) {
        checkRateLimit(command);
      }
      
      // Should be blocked
      expect(checkRateLimit(command).allowed).toBe(false);
      
      // Advance time past the block duration (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
      
      // Should be allowed again
      expect(checkRateLimit(command).allowed).toBe(true);
      
      jest.useRealTimers();
    });

    it('should maintain block even after window passes', () => {
      jest.useFakeTimers();
      const command = createMockCommand();
      
      // Max out the limit
      for (let i = 0; i < 60; i++) {
        checkRateLimit(command);
      }
      
      // Should be blocked
      expect(checkRateLimit(command).allowed).toBe(false);
      
      // Advance time past the window (1 minute) but not the block duration
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Should still be blocked
      const result = checkRateLimit(command);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('seconds before trying again');
      
      jest.useRealTimers();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return correct status for new user', () => {
      const status = getRateLimitStatus('T123', 'U123', '/trace');
      
      expect(status.requests).toBe(0);
      expect(status.remaining).toBe(60);
      expect(status.blockedUntil).toBeUndefined();
    });

    it('should return correct status after some requests', () => {
      const command = createMockCommand();
      
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        checkRateLimit(command);
      }
      
      const status = getRateLimitStatus('T123', 'U123', '/trace');
      expect(status.requests).toBe(3);
      expect(status.remaining).toBe(57);
      expect(status.blockedUntil).toBeUndefined();
    });

    it('should return blocked status when rate limited', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const command = createMockCommand();
      
      // Max out the limit
      for (let i = 0; i < 61; i++) {
        checkRateLimit(command);
      }
      
      const status = getRateLimitStatus('T123', 'U123', '/trace');
      expect(status.requests).toBe(60);
      expect(status.remaining).toBe(0);
      expect(status.blockedUntil).toBeDefined();
      expect(status.blockedUntil!.getTime()).toBeGreaterThan(now);
      
      jest.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should clean up old entries', () => {
      jest.useFakeTimers();
      const command = createMockCommand();
      
      // Make a request
      checkRateLimit(command);
      
      // Verify entry exists
      let status = getRateLimitStatus('T123', 'U123', '/trace');
      expect(status.requests).toBe(1);
      
      // Advance time past window and cleanup interval
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Entry should be cleaned up
      status = getRateLimitStatus('T123', 'U123', '/trace');
      expect(status.requests).toBe(0);
      
      jest.useRealTimers();
    });
  });
});