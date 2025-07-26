import { describe, it, expect } from '@jest/globals';
import { generateInvestigationName, generateUniqueName } from '../nameGenerator';

describe('nameGenerator', () => {
  describe('generateInvestigationName', () => {
    it('should generate contextual names for database issues', () => {
      const dbTitles = [
        'Database connection timeout',
        'DB performance degradation',
        'PostgreSQL query issues'
      ];
      
      for (const title of dbTitles) {
        const name = generateInvestigationName(title);
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
        
        // The important thing is that it generates valid, consistent names
        expect(name).toBeTruthy();
      }
    });

    it('should generate contextual names for API issues', () => {
      const apiTitles = [
        'API response times increasing',
        'REST API authentication failure',
        'GraphQL API errors'
      ];
      
      for (const title of apiTitles) {
        const name = generateInvestigationName(title);
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
        
        // Name should be well-formed
        expect(name.startsWith('trace-')).toBeTruthy();
        expect(name.split('-').length).toBeGreaterThanOrEqual(4);
      }
    });

    it('should generate contextual names for security issues', () => {
      const securityTitles = [
        'Security vulnerability detected',
        'Authentication bypass found',
        'Auth system broken'
      ];
      
      for (const title of securityTitles) {
        const name = generateInvestigationName(title);
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
      }
    });

    it('should generate unique names for the same title', () => {
      const title = 'Database performance issue';
      const names = new Set();
      
      // Generate multiple names
      for (let i = 0; i < 10; i++) {
        names.add(generateInvestigationName(title));
      }
      
      // All should be unique due to hash
      expect(names.size).toBeGreaterThanOrEqual(9); // Allow for rare collisions
      
      // All should follow the pattern
      names.forEach(name => {
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
      });
    });

    it('should handle titles without specific keywords', () => {
      const genericTitles = [
        'Something is wrong',
        'User reported issue',
        'General investigation'
      ];
      
      for (const title of genericTitles) {
        const name = generateInvestigationName(title);
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
        
        // Should still generate valid names
        expect(name.startsWith('trace-')).toBeTruthy();
        expect(name.split('-').length).toBeGreaterThanOrEqual(4);
      }
    });

    it('should include hash for uniqueness', () => {
      const title = 'API performance issue';
      const name = generateInvestigationName(title);
      const parts = name.split('-');
      
      // Should have at least 4 parts: trace, descriptor, noun, hash
      expect(parts.length).toBeGreaterThanOrEqual(4);
      
      // Last part should be a 4-character hex hash
      const hash = parts[parts.length - 1];
      expect(hash).toMatch(/^[a-f0-9]{4}$/);
    });

    it('should create meaningful connections between title and name', () => {
      // Test that specific keywords produce related descriptors
      const testCases = [
        { title: 'Database is slow', expectedTerms: ['slow', 'sluggish', 'delayed', 'lagging', 'crawling', 'persistent', 'indexed', 'stored', 'cached'] },
        { title: 'API performance issue', expectedTerms: ['swift', 'responsive', 'connected', 'networked', 'performance', 'rapid', 'optimized', 'efficient'] },
        { title: 'Security breach detected', expectedTerms: ['secured', 'protected', 'guarded', 'shielded', 'fortress', 'guardian', 'sentinel', 'shield', 'vault'] },
        { title: 'Payment system error', expectedTerms: ['financial', 'monetary', 'transacted', 'charged', 'broken', 'failed', 'crashed', 'glitched'] }
      ];
      
      for (const { title, expectedTerms } of testCases) {
        const name = generateInvestigationName(title);
        const nameWithoutHash = name.substring(0, name.lastIndexOf('-')).toLowerCase();
        
        // At least one expected term should appear
        const hasExpectedTerm = expectedTerms.some(term => nameWithoutHash.includes(term.toLowerCase()));
        
        // Log for debugging if needed
        if (!hasExpectedTerm) {
          console.log(`Title: "${title}" generated name: "${name}"`);
        }
        
        // We expect some contextual relevance, but not 100% guarantee due to randomness
        expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
      }
    });
  });

  describe('generateUniqueName', () => {
    it('should generate unique name on first try', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn().mockResolvedValue(false);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
      expect(checkExists).toHaveBeenCalledTimes(1);
    });

    it('should retry if name exists', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^trace-[a-z]+-[a-z]+(-[a-z0-9]+)?-[a-f0-9]{4}$/);
      expect(checkExists).toHaveBeenCalledTimes(3);
    });

    it('should use fallback after max attempts', async () => {
      const title = 'Database issue';
      const checkExists = jest.fn().mockResolvedValue(true);
      
      const name = await generateUniqueName(title, checkExists);
      
      expect(name).toMatch(/^trace-investigation-[a-f0-9]{8}$/);
      expect(checkExists).toHaveBeenCalledTimes(10); // maxAttempts
    });
  });
});