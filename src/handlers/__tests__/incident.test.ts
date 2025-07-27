import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleIncident } from '../incident';
import { createMockRespond, createMockCommand, createMockPrismaClient, createMockWebClient } from '../../test/utils/testHelpers';

describe('handleIncident', () => {
  let mockPrisma: any;
  let mockClient: any;
  let mockRespond: any;
  let mockCommand: any;
  
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
    mockCommand = createMockCommand();
    
    // Set investigation channel
    mockCommand.channel_id = 'C999INVEST';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('successful escalation', () => {
    it('should escalate investigation to incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API response times critical',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      });
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'escalated',
      });

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      // Verify incident was created
      expect(mockPrisma.incident.create).toHaveBeenCalledWith({
        data: {
          investigationId: 'inv-123',
          incidentCommander: 'U123456',
        },
      });

      // Verify investigation status was updated
      expect(mockPrisma.investigation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: { status: 'escalated' },
      });

      // Verify message posted to issues channel as reply
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123ISSUES',
        thread_ts: '1234567890.123456',
        reply_broadcast: true,
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('Escalated to incident'),
            }),
          }),
        ]),
      });

      // Verify response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('Case escalated to active incident'),
            }),
          }),
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('case-api-issue-abc'),
            }),
          }),
        ]),
      });
    });
  });

  describe('validation', () => {
    it('should reject if not in investigation channel', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('can only be used within investigation channels'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('should reject if already escalated', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
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

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('already been escalated'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });

    it('should reject if investigation is closed', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-old-issue-xyz',
        title: 'Old issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        closedBy: 'U777777',
        closedAt: new Date(Date.now() - 60 * 60 * 1000),
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('is closed'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.incident.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors during incident creation', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to escalate'),
        response_type: 'ephemeral',
      });
    });

    it('should handle database errors during status update', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
      });
      mockPrisma.investigation.update.mockRejectedValue(
        new Error('Update failed')
      );

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('Failed to escalate'),
        response_type: 'ephemeral',
      });
    });
  });

  describe('incident response team', () => {
    it('should add incident response team when configured', async () => {
      process.env.INCIDENT_RESPONSE_GROUP_ID = 'S123456789';
      
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API response times critical',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
      });
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'escalated',
      });
      
      // Mock conversations.invite
      mockClient.conversations.invite.mockResolvedValue({
        ok: true,
      });

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      // Verify user group was invited directly
      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C999INVEST',
        users: 'S123456789',
      });
    });

    it('should continue escalation even if team invite fails', async () => {
      process.env.INCIDENT_RESPONSE_GROUP_ID = 'S123456789';
      
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API response times critical',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
      });
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'escalated',
      });
      
      // Mock conversations.invite failure
      mockClient.conversations.invite.mockRejectedValue(
        new Error('usergroup_not_found')
      );

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      // Verify incident was still created
      expect(mockPrisma.incident.create).toHaveBeenCalled();
      
      // Verify response still shows success
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('Case escalated to active incident'),
            }),
          }),
        ]),
      });
    });

    it('should not attempt to add team when not configured', async () => {
      delete process.env.INCIDENT_RESPONSE_GROUP_ID;
      
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API response times critical',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        incident: null,
        issuesMessageTs: '1234567890.123456',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.incident.create.mockResolvedValue({
        id: 'inc-456',
        investigationId: 'inv-123',
        incidentCommander: 'U123456',
        escalatedAt: new Date(),
      });
      mockPrisma.investigation.update.mockResolvedValue({
        ...mockInvestigation,
        status: 'escalated',
      });

      await handleIncident({ command: mockCommand, respond: mockRespond, client: mockClient }, mockPrisma);

      // Verify user group was not invited
      expect(mockClient.conversations.invite).not.toHaveBeenCalled();
    });
  });
});