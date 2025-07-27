import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleStatus } from '../status';
import { createMockRespond, createMockCommand, createMockPrismaClient } from '../../test/utils/testHelpers';

describe('handleStatus', () => {
  let prisma: any;
  let respond: any;
  let command: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    prisma = createMockPrismaClient();
    respond = createMockRespond();
    command = createMockCommand({
      channel_id: 'C999INVEST',
      text: '',
      command: '/case',
      trigger_id: 'trigger123',
    });
  });

  describe('successful status display', () => {
    it('should show investigation status without incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API response times increasing',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 5 },
        incident: null,
      };

      prisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleStatus({ command, respond }, prisma);

      expect(prisma.investigation.findUnique).toHaveBeenCalledWith({
        where: { channelId: 'C999INVEST' },
        include: {
          _count: { select: { events: true } },
          incident: true,
        },
      });

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('case-api-issue-abc'),
            }),
          }),
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('API response times increasing'),
              }),
              expect.objectContaining({
                text: expect.stringContaining('investigating'),
              }),
              expect.objectContaining({
                text: expect.stringContaining('5'), // events
              }),
              expect.objectContaining({
                text: expect.stringMatching(/2h \d+m/), // duration
              }),
              expect.objectContaining({
                text: expect.stringContaining('U123456'),
              }),
              expect.objectContaining({
                text: expect.stringContaining('None'), // no incident
              }),
            ]),
          }),
        ]),
      });
    });

    it('should show investigation with active incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-payment-fail-xyz',
        title: 'Payment failures critical',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 12 },
        incident: {
          id: 'inc-456',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      prisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('🚨 Active'), // active incident
              }),
            ]),
          }),
        ]),
      });
    });

    it('should show investigation with resolved incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-database-slow-def',
        title: 'Database performance degraded',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 8 },
        incident: {
          id: 'inc-789',
          investigationId: 'inv-123',
          incidentCommander: 'U789012',
          escalatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          resolvedBy: 'U345678',
        },
      };

      prisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('✅ Resolved'), // resolved incident
              }),
            ]),
          }),
        ]),
      });
    });
  });

  describe('duration formatting', () => {
    it('should format duration in days for old investigations', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-old-issue-ghi',
        title: 'Old ongoing issue',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 25 },
        incident: null,
      };

      prisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringMatching(/3d \d+h/), // duration in days
              }),
            ]),
          }),
        ]),
      });
    });

    it('should format duration in minutes for new investigations', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-new-issue-jkl',
        title: 'Just started investigation',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 1 },
        incident: null,
      };

      prisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('15m'), // duration in minutes
              }),
            ]),
          }),
        ]),
      });
    });
  });

  describe('error handling', () => {
    it('should handle non-investigation channel', async () => {
      prisma.investigation.findUnique.mockResolvedValue(null);

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('can only be used within investigation channels'),
        response_type: 'ephemeral',
      });
    });

    it('should handle database errors', async () => {
      prisma.investigation.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleStatus({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to fetch status'),
        response_type: 'ephemeral',
      });
    });
  });
});