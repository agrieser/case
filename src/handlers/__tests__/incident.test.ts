import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { handleIncident } from '../incident';
import { SlackCommandMiddlewareArgs } from '@slack/bolt';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    investigation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    incident: {
      create: jest.fn(),
    },
  })),
}));

describe('handleIncident', () => {
  let prisma: PrismaClient;
  let respond: jest.Mock;
  let command: SlackCommandMiddlewareArgs['command'];

  beforeEach(() => {
    jest.clearAllMocks();
    
    prisma = new PrismaClient();
    respond = jest.fn().mockResolvedValue(undefined);
    
    command = {
      text: '',
      user_id: 'U123456',
      channel_id: 'C999INVEST',
      team_id: 'T111111',
      command: '/trace',
      trigger_id: 'trigger123',
      response_url: 'https://hooks.slack.com/response',
      token: 'token123',
      api_app_id: 'A123456',
      channel_name: 'trace-api-issue-abc',
      user_name: 'testuser',
      team_domain: 'testteam',
      enterprise_id: undefined,
      enterprise_name: undefined,
      is_enterprise_install: 'false',
    };
  });

  describe('successful escalation', () => {
    it('should escalate investigation to incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API response times critical',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        closedBy: null,
        closedAt: null,
        incident: null,
      };

      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(mockInvestigation);
      (prisma.incident.create as jest.Mock).mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      });
      (prisma.investigation.update as jest.Mock).mockResolvedValue({
        ...mockInvestigation,
        status: 'escalated',
      });

      await handleIncident({ command, respond }, prisma);

      // Verify incident was created
      expect(prisma.incident.create).toHaveBeenCalledWith({
        data: {
          investigationId: 'inv-123',
          incidentCommander: 'U123456',
        },
      });

      // Verify investigation status was updated
      expect(prisma.investigation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: { status: 'escalated' },
      });

      // Verify response
      expect(respond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('🚨 INCIDENT DECLARED'),
            }),
          }),
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('trace-api-issue-abc'),
              }),
              expect.objectContaining({
                text: expect.stringContaining('U123456'), // incident commander
              }),
            ]),
          }),
        ]),
      });
    });
  });

  describe('validation', () => {
    it('should reject if not in investigation channel', async () => {
      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(null);

      await handleIncident({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('can only be used within investigation channels'),
        response_type: 'ephemeral',
      });
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('should reject if already escalated', async () => {
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
          id: 'inc-existing',
          investigationId: 'inv-123',
          incidentCommander: 'U888888',
          escalatedAt: new Date(Date.now() - 60 * 60 * 1000),
          resolvedAt: null,
          resolvedBy: null,
        },
      };

      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(mockInvestigation);

      await handleIncident({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('already been escalated'),
        response_type: 'ephemeral',
      });
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('should reject if investigation is closed', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-old-issue-xyz',
        title: 'Old issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        closedBy: 'U777777',
        closedAt: new Date(Date.now() - 60 * 60 * 1000),
        incident: null,
      };

      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(mockInvestigation);

      await handleIncident({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('is closed'),
        response_type: 'ephemeral',
      });
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors during incident creation', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
      };

      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(mockInvestigation);
      (prisma.incident.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleIncident({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to escalate'),
        response_type: 'ephemeral',
      });
    });

    it('should handle database errors during status update', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'trace-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
      };

      (prisma.investigation.findUnique as jest.Mock).mockResolvedValue(mockInvestigation);
      (prisma.incident.create as jest.Mock).mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
      });
      (prisma.investigation.update as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );

      await handleIncident({ command, respond }, prisma);

      expect(respond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to escalate'),
        response_type: 'ephemeral',
      });
    });
  });
});