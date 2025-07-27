import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleClose } from '../close';
import { createMockRespond, createMockPrismaClient, createMockWebClient } from '../../test/utils/testHelpers';

describe('handleClose', () => {
  let mockPrisma: any;
  let mockClient: any;
  let mockRespond: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();
    mockRespond = createMockRespond();
  });

  describe('successful closure', () => {
    it('should close investigation without incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 5 },
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'closed',
        closedBy: 'U123456',
        closedAt: new Date(),
      });

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      // Verify investigation was updated
      expect(mockPrisma.investigation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: { 
          status: 'closed',
          closedAt: expect.any(Date),
          closedBy: 'U123456'
        }
      });

      // Verify channel was archived
      expect(mockClient.conversations.archive).toHaveBeenCalledWith({
        channel: 'C999INVEST',
      });

      // Verify response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: expect.stringContaining('has been closed'),
      });
    });

    it('should close investigation with resolved incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-payment-fail-xyz',
        title: 'Payment failures',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 12 },
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          resolvedBy: 'U345678',
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'closed',
        closedBy: 'U123456',
        closedAt: new Date(),
      });

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockPrisma.investigation.update).toHaveBeenCalled();
      expect(mockClient.conversations.archive).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should reject if not in investigation channel', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('only works in investigation channels'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.update).not.toHaveBeenCalled();
    });

    it('should reject if already closed', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-old-issue-abc',
        title: 'Old issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        closedBy: 'U888888',
        closedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        _count: { events: 8 },
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('already closed'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.update).not.toHaveBeenCalled();
    });

    it('should reject if incident is unresolved', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-active-incident-def',
        title: 'Active incident',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        _count: { events: 15 },
        incident: {
          id: 'inc-789',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 90 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('must be resolved first'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.update).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-test-issue-ghi',
        title: 'Test issue',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        _count: { events: 3 },
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.investigation.update.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to close'),
        response_type: 'ephemeral',
      });
    });

    it('should continue if archive fails', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-archive-fail-jkl',
        title: 'Archive fail test',
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
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'closed',
        closedBy: 'U123456',
        closedAt: new Date(),
      });
      mockClient.conversations.archive.mockRejectedValue(
        new Error('channel_not_found')
      );

      await handleClose(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      // Should still close investigation even if archive fails
      expect(mockPrisma.investigation.update).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: expect.stringContaining('has been closed'),
      });
    });
  });
});