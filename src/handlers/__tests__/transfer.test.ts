import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleTransfer } from '../transfer';
import { createMockRespond, createMockPrismaClient } from '../../test/utils/testHelpers';

describe('handleTransfer', () => {
  let mockPrisma: any;
  let mockRespond: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockRespond = createMockRespond();
  });

  describe('successful transfer', () => {
    it('should transfer incident commander role', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API issues critical',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        closedBy: null,
        closedAt: null,
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 90 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        incidentCommander: 'U345678',
      });

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          newCommander: '<@U345678>'
        },
        mockPrisma
      );

      // Verify incident was updated
      expect(mockPrisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc-456' },
        data: { 
          incidentCommander: 'U345678'
        }
      });

      // Verify response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: '🔄 Incident commander role transferred',
            }),
          }),
          expect.objectContaining({
            text: expect.objectContaining({
              text: '*From:* <@U789012>\n*To:* <@U345678>\n*By:* <@U123456>',
            }),
          }),
          expect.objectContaining({
            elements: expect.arrayContaining([
              expect.objectContaining({
                text: 'Incident: *trace-api-issue-abc*',
              }),
            ]),
          }),
        ]),
      });
    });

    it('should handle transfer from different user than current commander', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-database-slow-def',
        title: 'Database performance',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U111111',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: {
          id: 'inc-789',
          investigationId: 'inv-123',
          incidentCommander: 'U222222',
          escalatedAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockResolvedValue({
        ...mockInvestigation.incident,
        incidentCommander: 'U333333',
      });

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U444444', // Different from current commander
          newCommander: '<@U333333>'
        },
        mockPrisma
      );

      expect(mockPrisma.incident.update).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: '*From:* <@U222222>\n*To:* <@U333333>\n*By:* <@U444444>',
            }),
          }),
        ]),
      });
    });
  });

  describe('validation', () => {
    it('should reject if not in investigation channel', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999GENERAL', 
          userId: 'U123456',
          newCommander: '<@U345678>'
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
        name: 'trace-not-escalated-abc',
        title: 'Not escalated',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          newCommander: '<@U345678>'
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ This investigation has not been escalated to an incident yet. Use `/trace incident` first.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });

    it('should reject invalid user mention format', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API issues',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      // Test various invalid formats
      const invalidFormats = [
        'U345678',           // Missing mention format
        '@username',         // Missing brackets
        '<U345678>',         // Missing @
        '<@username>',       // Not a user ID
        '<@U345678|name>',   // With display name
        '',                  // Empty
        'not a user',        // Random text
      ];

      for (const invalidFormat of invalidFormats) {
        await handleTransfer(
          { 
            respond: mockRespond, 
            channelId: 'C999INVEST', 
            userId: 'U123456',
            newCommander: invalidFormat
          },
          mockPrisma
        );

        expect(mockRespond).toHaveBeenCalledWith({
          text: '⚠️ Please mention a user to transfer incident commander role to (e.g., `/trace transfer @username`).',
          response_type: 'ephemeral',
        });
        expect(mockPrisma.incident.update).not.toHaveBeenCalled();
        
        jest.clearAllMocks();
        mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      }
    });

    it('should reject if transferring to current commander', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-same-commander-xyz',
        title: 'Same commander',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          newCommander: '<@U789012>' // Same as current commander
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ <@U789012> is already the incident commander.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors during update', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-db-error-abc',
        title: 'Database error test',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.update.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          newCommander: '<@U345678>'
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to transfer incident commander role. Please try again.',
        response_type: 'ephemeral',
      });
    });

    it('should handle database errors during fetch', async () => {
      mockPrisma.investigation.findUnique.mockRejectedValue(
        new Error('Query timeout')
      );

      await handleTransfer(
        { 
          respond: mockRespond, 
          channelId: 'C999INVEST', 
          userId: 'U123456',
          newCommander: '<@U345678>'
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to transfer incident commander role. Please try again.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.update).not.toHaveBeenCalled();
    });
  });
});