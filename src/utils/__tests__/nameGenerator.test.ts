import { describe, it, expect } from '@jest/globals';
import { generateInvestigationName, generateUniqueName, generateChannelName } from '../nameGenerator';

describe('nameGenerator', () => {
  describe('generateInvestigationName', () => {
    it('should generate names using channel name logic', () => {
      const title = 'Database connection timeout';
      const name = generateInvestigationName(title);
      
      // Should match channel name format: case-[title]-[3char-hex]
      expect(name).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
      expect(name.startsWith('case-')).toBeTruthy();
      expect(name.length).toBeLessThanOrEqual(21);
    });

    it('should use same format as channel name', () => {
      const titles = [
        'API response times',
        'Database performance',
        'User authentication'
      ];
      
      for (const title of titles) {
        const investigationName = generateInvestigationName(title);
        const channelName = generateChannelName(title);
        
        // Both should have same format but different random suffixes
        expect(investigationName).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
        expect(channelName).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
        
        // Same prefix (without random suffix)
        const invPrefix = investigationName.substring(0, investigationName.lastIndexOf('-'));
        const chanPrefix = channelName.substring(0, channelName.lastIndexOf('-'));
        expect(invPrefix).toBe(chanPrefix);
      }
    });

    it('should handle various title types', () => {
      const testCases = [
        { title: 'API down', expected: /^case-api-down-[a-f0-9]{3}$/ },
        { title: 'Payment processing errors', expected: /^case-payment-proc-[a-f0-9]{3}$/ },
        { title: 'Database is slow', expected: /^case-database-is-[a-f0-9]{3}$/ }
      ];
      
      for (const { title, expected } of testCases) {
        const name = generateInvestigationName(title);
        expect(name).toMatch(expected);
      }
    });

    it('should generate unique names for the same title', () => {
      const title = 'Database performance';
      const names = new Set();
      
      // Generate multiple names
      for (let i = 0; i < 10; i++) {
        names.add(generateInvestigationName(title));
      }
      
      // All should be unique due to random suffix
      expect(names.size).toBeGreaterThanOrEqual(9); // Allow for rare collisions
      
      // All should follow the pattern
      names.forEach(name => {
        expect(name).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
      });
    });

    it('should truncate long titles', () => {
      const title = 'This is a very long investigation title that exceeds the limit';
      const name = generateInvestigationName(title);
      
      expect(name.length).toBeLessThanOrEqual(21);
      expect(name).toMatch(/^case-this-is-a-ve-[a-f0-9]{3}$/);
    });
  });

  describe('generateUniqueName', () => {
    it('should generate unique name on first try', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn().mockResolvedValue(false);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
      expect(checkExists).toHaveBeenCalledTimes(1);
    });

    it('should retry if name exists', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
      expect(checkExists).toHaveBeenCalledTimes(3);
    });

    it('should use fallback after max attempts', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn().mockResolvedValue(true);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^case-inv-[a-f0-9]{8}$/);
      expect(checkExists).toHaveBeenCalledTimes(11); // 1 initial + 10 retry attempts
    });
  });

  describe('generateChannelName', () => {
    it('should generate channel name with case prefix', () => {
      const title = 'API response times';
      const name = generateChannelName(title);
      
      expect(name).toMatch(/^case-[a-z0-9-]+-[a-f0-9]{3}$/);
      expect(name.startsWith('case-')).toBeTruthy();
      expect(name.length).toBeLessThanOrEqual(21);
    });

    it('should handle special characters and spaces', () => {
      const title = 'Database @ Performance! Issue #123';
      const name = generateChannelName(title);
      
      // With 12 chars for title, "database-per" is what we expect
      expect(name).toMatch(/^case-database-per-[a-f0-9]{3}$/);
      expect(name).not.toContain('@');
      expect(name).not.toContain('!');
      expect(name).not.toContain('#');
      expect(name).not.toContain(' ');
    });

    it('should truncate long titles', () => {
      const title = 'This is a very long investigation title that exceeds the limit';
      const name = generateChannelName(title);
      
      expect(name.length).toBeLessThanOrEqual(21);
      expect(name).toMatch(/^case-this-is-a-ve-[a-f0-9]{3}$/);
    });

    it('should handle empty or invalid titles', () => {
      const emptyTitles = ['', '   ', '!!!', '@#$%'];
      
      for (const title of emptyTitles) {
        const name = generateChannelName(title);
        // "investigation" is 13 chars, truncated to 12 = "investigatio"
        expect(name).toMatch(/^case-investigatio-[a-f0-9]{3}$/);
        expect(name.length).toBeLessThanOrEqual(21);
      }
    });

    it('should generate unique names for same title', () => {
      const title = 'Same title';
      const names = new Set();
      
      // Generate multiple names
      for (let i = 0; i < 10; i++) {
        names.add(generateChannelName(title));
      }
      
      // All should be unique due to random suffix
      expect(names.size).toBeGreaterThanOrEqual(9); // Allow for rare collisions
    });

    it('should create sensible channel names', () => {
      const testCases = [
        { title: 'API down', expected: /^case-api-down-[a-f0-9]{3}$/ },
        { title: 'Payment processing errors', expected: /^case-payment-proc-[a-f0-9]{3}$/ }, // 12 char limit
        { title: 'User login issues', expected: /^case-user-login-i-[a-f0-9]{3}$/ },
        { title: 'DB connection timeout', expected: /^case-db-connection-[a-f0-9]{3}$/ }
      ];
      
      for (const { title, expected } of testCases) {
        const name = generateChannelName(title);
        expect(name).toMatch(expected);
      }
    });
  });
});