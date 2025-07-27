import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleList } from '../list';
import { createMockRespond, createMockPrismaClient } from '../../test/utils/testHelpers';

describe('handleList', () => {
  let mockPrisma: any;
  let mockRespond: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockRespond = createMockRespond();
  });

  describe('successful listing', () => {
    it('should list active investigations without incidents', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-api-issue-abc',
          title: 'API response times increasing',
          status: 'investigating',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          closedBy: null,
          closedAt: null,
          _count: { events: 5 },
          incident: null,
        },
        {
          id: 'inv-456',
          name: 'case-database-pe-def',
          title: 'Database performance issues',
          status: 'investigating',
          channelId: 'C999INVEST2',
          createdBy: 'U789012',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          closedBy: null,
          closedAt: null,
          _count: { events: 3 },
          incident: null,
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      // Verify query
      expect(mockPrisma.investigation.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: 'closed'
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25,
        include: {
          _count: {
            select: { events: true }
          },
          incident: true
        }
      });

      // Verify response format
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '📋 Active Case Files'
            })
          }),
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: 'Found *2 open cases*:'
            })
          }),
          expect.objectContaining({
            type: 'divider'
          }),
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('case-api-issue-abc')
            })
          })
        ])
      });

      // Verify the list contains expected content
      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      // First investigation
      expect(listText).toContain('1. 🔍 *case-api-issue-abc*');
      expect(listText).toContain('Title: API response times increasing');
      expect(listText).toContain('Channel: <#C999INVEST1>');
      expect(listText).toContain('Events: 5');
      expect(listText).toContain('2h 0m');
      expect(listText).toContain('Created by: <@U123456>');
      
      // Second investigation
      expect(listText).toContain('2. 🔍 *case-database-pe-def*');
      expect(listText).toContain('Title: Database performance issues');
      expect(listText).toContain('Channel: <#C999INVEST2>');
      expect(listText).toContain('Events: 3');
      expect(listText).toContain('30m');
      expect(listText).toContain('Created by: <@U789012>');
    });

    it('should show active incidents', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-payment-fail-xyz',
          title: 'Payment failures critical',
          status: 'escalated',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 12 },
          incident: {
            id: 'inc-456',
            investigationId: 'inv-123',
            incidentCommander: 'U789012',
            escalatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            resolvedAt: null,
            resolvedBy: null,
          },
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      expect(listText).toContain('1. 🚨 *case-payment-fail-xyz*');
      expect(listText).toContain('Incident Commander: <@U789012>');
    });

    it('should show resolved incidents', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-database-slow-def',
          title: 'Database performance degraded',
          status: 'escalated',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 8 },
          incident: {
            id: 'inc-789',
            investigationId: 'inv-123',
            incidentCommander: 'U789012',
            escalatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            resolvedBy: 'U345678',
          },
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      expect(listText).toContain('1. ✅ *case-database-slow-def*');
      expect(listText).toContain('Incident Commander: <@U789012>');
    });

    it('should handle mixed investigation types', async () => {
      const mockInvestigations = [
        {
          id: 'inv-1',
          name: 'case-active-inc-abc',
          title: 'Active incident',
          status: 'escalated',
          channelId: 'C999INVEST1',
          createdBy: 'U111111',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 10 },
          incident: {
            id: 'inc-1',
            investigationId: 'inv-1',
            incidentCommander: 'U222222',
            escalatedAt: new Date(Date.now() - 45 * 60 * 1000),
            resolvedAt: null,
            resolvedBy: null,
          },
        },
        {
          id: 'inv-2',
          name: 'case-regular-inv-def',
          title: 'Regular investigation',
          status: 'investigating',
          channelId: 'C999INVEST2',
          createdBy: 'U333333',
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 2 },
          incident: null,
        },
        {
          id: 'inv-3',
          name: 'case-resolved-inc-ghi',
          title: 'Resolved incident',
          status: 'escalated',
          channelId: 'C999INVEST3',
          createdBy: 'U444444',
          createdAt: new Date(Date.now() - 180 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 15 },
          incident: {
            id: 'inc-3',
            investigationId: 'inv-3',
            incidentCommander: 'U555555',
            escalatedAt: new Date(Date.now() - 150 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 30 * 60 * 1000),
            resolvedBy: 'U666666',
          },
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      // Check order and statuses
      expect(listText).toMatch(/1\. 🚨/);
      expect(listText).toMatch(/2\. 🔍/);
      expect(listText).toMatch(/3\. ✅/);
    });
  });

  describe('edge cases', () => {
    it('should handle no active investigations', async () => {
      mockPrisma.investigation.findMany.mockResolvedValue([]);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: 'No active investigations found. Open one with `/case open [title]`',
        response_type: 'ephemeral',
      });
    });

    it('should handle single investigation (singular form)', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-single-issue-abc',
          title: 'Single issue',
          status: 'investigating',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(),
          closedBy: null,
          closedAt: null,
          _count: { events: 1 },
          incident: null,
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const sectionText = responseBlocks[1].text.text;
      
      expect(sectionText).toBe('Found *1 open case*:'); // Singular form
    });
  });

  describe('duration formatting', () => {
    it('should format duration correctly for minutes only', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-new-issue-abc',
          title: 'New issue',
          status: 'investigating',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes
          closedBy: null,
          closedAt: null,
          _count: { events: 1 },
          incident: null,
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      expect(listText).toContain('Duration: 15m');
    });

    it('should format duration correctly for hours and minutes', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-old-issue-abc',
          title: 'Old issue',
          status: 'investigating',
          channelId: 'C999INVEST1',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - (3 * 60 + 45) * 60 * 1000), // 3h 45m
          closedBy: null,
          closedAt: null,
          _count: { events: 20 },
          incident: null,
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      expect(listText).toContain('Duration: 3h 45m');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.investigation.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to list investigations. Please try again.',
        response_type: 'ephemeral',
      });
    });
  });

  describe('database query', () => {
    it('should exclude closed investigations', async () => {
      mockPrisma.investigation.findMany.mockResolvedValue([]);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      expect(mockPrisma.investigation.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: 'closed'
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25,
        include: {
          _count: {
            select: { events: true }
          },
          incident: true
        }
      });
    });

    it('should order by creation date descending', async () => {
      const mockInvestigations = [
        {
          id: 'inv-new',
          name: 'case-newest-abc',
          title: 'Newest',
          status: 'investigating',
          channelId: 'C999NEW',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 1 },
          incident: null,
        },
        {
          id: 'inv-old',
          name: 'case-oldest-xyz',
          title: 'Oldest',
          status: 'investigating',
          channelId: 'C999OLD',
          createdBy: 'U123456',
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          closedBy: null,
          closedAt: null,
          _count: { events: 5 },
          incident: null,
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleList({ respond: mockRespond, userId: 'U123456' }, mockPrisma);

      const responseBlocks = mockRespond.mock.calls[0][0].blocks;
      const listText = responseBlocks[3].text.text;
      
      // Verify newest appears first
      const newestIndex = listText.indexOf('case-newest-abc');
      const oldestIndex = listText.indexOf('case-oldest-xyz');
      expect(newestIndex).toBeLessThan(oldestIndex);
    });
  });
});