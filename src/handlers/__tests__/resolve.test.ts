import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleResolve } from '../resolve';
import { createMockRespond, createMockPrismaClient, createMockWebClient } from '../../test/utils/testHelpers';

describe('handleResolve', () => {
  let mockPrisma: any;
  let mockClient: any;
  let mockRespond: any;
  
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment
    process.env = { ...originalEnv };
    process.env.ISSUES_CHANNEL_ID = 'C123ISSUES';
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();
    mockRespond = createMockRespond();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('successful resolution', () => {
    it('should resolve an active incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API issues critical',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 12 },
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        resolvedAt: new Date(),
        resolvedBy: 'U123456',
      });

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      // Verify incident was updated
      expect(mockPrisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc-456' },
        data: { 
          resolvedAt: expect.any(Date),
          resolvedBy: 'U123456'
        }
      });

      // Verify channel response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: '✅ Incident *trace-api-issue-abc* has been resolved!',
            }),
          }),
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('*Incident Duration:* 2h 0m'),
            }),
          }),
          expect.objectContaining({
            elements: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('investigation remains open'),
              }),
            ]),
          }),
        ]),
      });
      
      // Should not post to issues channel
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should handle short duration incidents', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-quick-fix-def',
        title: 'Quick fix incident',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 3 },
        incident: {
          id: 'inc-789',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        resolvedAt: new Date(),
        resolvedBy: 'U123456',
      });

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('*Incident Duration:* 15m'),
            }),
          }),
        ]),
      });
    });

    it('should continue if posting to issues channel fails', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-post-fail-ghi',
        title: 'Post fail test',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        _count: { events: 5 },
        incident: {
          id: 'inc-999',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 60 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        resolvedAt: new Date(),
        resolvedBy: 'U123456',
      });
      mockClient.chat.postMessage.mockRejectedValue(new Error('channel_not_found'));

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      // Should still resolve the incident
      expect(mockPrisma.incident.update).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.any(Array),
      });
      
      // Should not post to issues channel on failure
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should handle missing ISSUES_CHANNEL_ID', async () => {
      delete process.env.ISSUES_CHANNEL_ID;

      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-no-env-jkl',
        title: 'No env test',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        _count: { events: 7 },
        incident: {
          id: 'inc-111',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 30 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        resolvedAt: new Date(),
        resolvedBy: 'U123456',
      });

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      // Should still resolve but not post to issues channel
      expect(mockPrisma.incident.update).toHaveBeenCalled();
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should reject if not in investigation channel', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999GENERAL', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ This command only works in investigation channels.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });

    it('should reject if investigation not escalated to incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-not-escalated-mno',
        title: 'Not escalated',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        _count: { events: 2 },
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ This investigation has not been escalated to an incident. Only incidents can be resolved.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });

    it('should reject if incident already resolved', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-already-res-pqr',
        title: 'Already resolved',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 10 },
        incident: {
          id: 'inc-222',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          resolvedBy: 'U888888',
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ This incident has already been resolved.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors during update', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-db-error-stu',
        title: 'Database error test',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        _count: { events: 8 },
        incident: {
          id: 'inc-333',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 90 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to resolve incident. Please try again.',
        response_type: 'ephemeral',
      });
    });

    it('should handle database errors during fetch', async () => {
      mockPrisma.investigation.findUnique.mockRejectedValue(
        new Error('Query timeout')
      );

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to resolve incident. Please try again.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('duration calculation', () => {
    it('should calculate long duration correctly', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-long-dur-vwx',
        title: 'Long duration incident',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 50 },
        incident: {
          id: 'inc-444',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        resolvedAt: new Date(),
        resolvedBy: 'U123456',
      });

      await handleResolve(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456' 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('*Incident Duration:* 25h 0m'),
            }),
          }),
        ]),
      });
    });
  });
});