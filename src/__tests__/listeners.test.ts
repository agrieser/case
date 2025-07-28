import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { App } from '@slack/bolt';
import { registerListeners } from '../listeners';
import { createMockPrismaClient, createMockWebClient } from '../test/utils/testHelpers';

// Mock the handlers
jest.mock('../handlers/help', () => ({
  handleHelp: jest.fn(),
}));

describe('registerListeners', () => {
  let mockApp: any;
  let mockPrisma: any;
  let mockClient: any;
  let shortcuts: Map<string, any>;
  let views: Map<string, any>;
  let actions: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();

    // Create maps to store registered handlers
    shortcuts = new Map();
    views = new Map();
    actions = new Map();

    // Mock App with handler registration
    mockApp = {
      shortcut: jest.fn((name: string, handler: any) => {
        shortcuts.set(name, handler);
      }),
      view: jest.fn((name: string, handler: any) => {
        views.set(name, handler);
      }),
      action: jest.fn((name: string, handler: any) => {
        actions.set(name, handler);
      }),
    };

    // Register all listeners
    registerListeners(mockApp as App, mockPrisma);
  });

  describe('add_event_to_investigation shortcut', () => {
    it('should handle single investigation - add event directly', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
      };

      mockPrisma.investigation.findMany.mockResolvedValue([mockInvestigation]);
      mockPrisma.event.create.mockResolvedValue({
        id: 'event-456',
        investigationId: 'inv-123',
        slackMessageUrl: 'https://workspace.slack.com/archives/C123456/p1234567890',
        addedBy: 'U123456',
      });
      mockPrisma.event.count.mockResolvedValue(5);

      const handler = shortcuts.get('add_event_to_investigation');
      const ack = jest.fn();

      await handler({
        shortcut: {
          type: 'message_action',
          channel: { id: 'C123456' },
          message: { ts: '1234567890.123456' },
          user: { id: 'U123456' },
          trigger_id: 'trigger123',
          team: { domain: 'workspace' },
        },
        ack,
        client: mockClient,
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          investigationId: 'inv-123',
          slackMessageUrl: 'https://workspace.slack.com/archives/C123456/p1234567890123456',
          addedBy: 'U123456',
        },
      });
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C999INVEST',
        text: 'Evidence added by <@U123456>: https://workspace.slack.com/archives/C123456/p1234567890123456',
      });
      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C123456',
        user: 'U123456',
        text: expect.stringContaining('Event added to investigation'),
      });
    });

    it('should show modal when multiple investigations exist', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-api-issue-abc',
          title: 'API issues that are very long and need to be truncated',
          status: 'investigating',
          channelId: 'C999INVEST1',
        },
        {
          id: 'inv-456',
          name: 'case-db-issue-def',
          title: 'Database issues',
          status: 'investigating',
          channelId: 'C999INVEST2',
        },
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      const handler = shortcuts.get('add_event_to_investigation');
      const ack = jest.fn();

      await handler({
        shortcut: {
          type: 'message_action',
          channel: { id: 'C123456' },
          message: { ts: '1234567890.123456' },
          user: { id: 'U123456' },
          trigger_id: 'trigger123',
          team: { domain: 'workspace' },
        },
        ack,
        client: mockClient,
      });

      expect(mockClient.views.open).toHaveBeenCalledWith({
        trigger_id: 'trigger123',
        view: expect.objectContaining({
          type: 'modal',
          callback_id: 'select_investigation_for_event',
          private_metadata: JSON.stringify({
            channelId: 'C123456',
            messageTs: '1234567890.123456',
            teamDomain: 'workspace',
          }),
          blocks: expect.arrayContaining([
            expect.objectContaining({
              type: 'input',
              element: expect.objectContaining({
                type: 'static_select',
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'case-api-issue-abc - API issues that are very long ...',
                    },
                    value: 'inv-123',
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'case-db-issue-def - Database issues',
                    },
                    value: 'inv-456',
                  },
                ],
              }),
            }),
          ]),
        }),
      });
    });

    it('should handle no active investigations', async () => {
      mockPrisma.investigation.findMany.mockResolvedValue([]);

      const handler = shortcuts.get('add_event_to_investigation');
      const ack = jest.fn();

      await handler({
        shortcut: {
          type: 'message_action',
          channel: { id: 'C123456' },
          message: { ts: '1234567890.123456' },
          user: { id: 'U123456' },
          trigger_id: 'trigger123',
        },
        ack,
        client: mockClient,
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C123456',
        user: 'U123456',
        text: '⚠️ No active investigations found. Open one with `/case open [title]`',
      });
    });

    it('should handle invalid shortcut type', async () => {
      const handler = shortcuts.get('add_event_to_investigation');
      const ack = jest.fn();

      await handler({
        shortcut: {
          type: 'global_shortcut', // Invalid type
          user: { id: 'U123456' },
          trigger_id: 'trigger123',
        },
        ack,
        client: mockClient,
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.investigation.findMany).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.investigation.findMany.mockRejectedValue(new Error('Database error'));

      const handler = shortcuts.get('add_event_to_investigation');
      const ack = jest.fn();

      await handler({
        shortcut: {
          type: 'message_action',
          channel: { id: 'C123456' },
          message: { ts: '1234567890.123456' },
          user: { id: 'U123456' },
          trigger_id: 'trigger123',
        },
        ack,
        client: mockClient,
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C123456',
        user: 'U123456',
        text: '⚠️ Failed to add event. Please try again.',
      });
    });
  });

  describe('select_investigation_for_event view', () => {
    it('should handle investigation selection', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);
      mockPrisma.event.create.mockResolvedValue({
        id: 'event-789',
        investigationId: 'inv-123',
        slackMessageUrl: 'https://workspace.slack.com/archives/C123456/p1234567890',
        addedBy: 'U123456',
      });
      mockPrisma.event.count.mockResolvedValue(3);

      const handler = views.get('select_investigation_for_event');
      const ack = jest.fn();

      await handler({
        ack,
        view: {
          private_metadata: JSON.stringify({
            channelId: 'C123456',
            messageTs: '1234567890.123456',
            teamDomain: 'workspace',
          }),
          state: {
            values: {
              investigation_select: {
                selected_investigation: {
                  selected_option: {
                    value: 'inv-123',
                  },
                },
              },
            },
          },
        },
        client: mockClient,
        body: {
          user: { id: 'U123456' },
        },
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.investigation.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
      });
      expect(mockPrisma.event.create).toHaveBeenCalled();
      expect(mockClient.chat.postMessage).toHaveBeenCalled();
      expect(mockClient.chat.postEphemeral).toHaveBeenCalled();
    });

    it('should handle missing investigation selection', async () => {
      const handler = views.get('select_investigation_for_event');
      const ack = jest.fn();

      await handler({
        ack,
        view: {
          private_metadata: JSON.stringify({
            channelId: 'C123456',
            messageTs: '1234567890.123456',
            teamDomain: 'workspace',
          }),
          state: {
            values: {
              investigation_select: {
                selected_investigation: {
                  selected_option: null,
                },
              },
            },
          },
        },
        client: mockClient,
        body: {
          user: { id: 'U123456' },
        },
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.investigation.findUnique).not.toHaveBeenCalled();
    });

    it('should handle investigation not found', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      const handler = views.get('select_investigation_for_event');
      const ack = jest.fn();

      await handler({
        ack,
        view: {
          private_metadata: JSON.stringify({
            channelId: 'C123456',
            messageTs: '1234567890.123456',
            teamDomain: 'workspace',
          }),
          state: {
            values: {
              investigation_select: {
                selected_investigation: {
                  selected_option: {
                    value: 'inv-999',
                  },
                },
              },
            },
          },
        },
        client: mockClient,
        body: {
          user: { id: 'U123456' },
        },
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe('create_investigation_button action', () => {
    it('should open create investigation modal', async () => {
      const handler = actions.get('create_investigation_button');
      const ack = jest.fn();

      await handler({
        ack,
        client: mockClient,
        body: {
          trigger_id: 'trigger123',
        },
      });

      expect(ack).toHaveBeenCalled();
      expect(mockClient.views.open).toHaveBeenCalledWith({
        trigger_id: 'trigger123',
        view: expect.objectContaining({
          type: 'modal',
          callback_id: 'create_investigation_modal',
          title: {
            type: 'plain_text',
            text: 'Create Investigation',
          },
        }),
      });
    });

    it('should handle missing trigger_id', async () => {
      const handler = actions.get('create_investigation_button');
      const ack = jest.fn();

      await handler({
        ack,
        client: mockClient,
        body: {},
      });

      expect(ack).toHaveBeenCalled();
      expect(mockClient.views.open).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Re-create mock client for this test to avoid affecting other tests
      const errorClient = {
        ...mockClient,
        views: {
          open: jest.fn(() => Promise.reject(new Error('API error'))),
        },
      };

      const handler = actions.get('create_investigation_button');
      const ack = jest.fn();

      await handler({
        ack,
        client: errorClient,
        body: {
          trigger_id: 'trigger123',
        },
      });

      expect(ack).toHaveBeenCalled();
      // Error is logged but doesn't crash
    });
  });

  describe('show_help_button action', () => {
    it('should call help handler', async () => {
      const { handleHelp } = await import('../handlers/help');

      const handler = actions.get('show_help_button');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        ack,
        respond,
      });

      expect(ack).toHaveBeenCalled();
      expect(handleHelp).toHaveBeenCalledWith({ respond });
    });
  });

  describe('investigation_selected action', () => {
    it('should show investigation details', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-api-issue-abc',
        title: 'API issues',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        _count: { events: 5 },
        incident: null,
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      const handler = actions.get('investigation_selected');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        action: {
          type: 'static_select',
          selected_option: {
            value: 'inv-123',
          },
        },
        ack,
        respond,
        body: {
          team: { id: 'T123456' },
        },
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.investigation.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        include: {
          _count: {
            select: { events: true },
          },
          incident: true,
        },
      });
      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'case-api-issue-abc',
            },
          }),
          expect.objectContaining({
            type: 'actions',
            elements: expect.arrayContaining([
              expect.objectContaining({
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Go to Channel',
                },
              }),
            ]),
          }),
        ]),
      });
    });

    it('should show escalated investigation with incident', async () => {
      const mockInvestigation = {
        id: 'inv-123',
        name: 'case-payment-fail-xyz',
        title: 'Payment failures',
        status: 'escalated',
        channelId: 'C999INVEST',
        createdBy: 'U999999',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        _count: { events: 12 },
        incident: {
          id: 'inc-456',
          incidentCommander: 'U789012',
          escalatedAt: new Date(),
        },
      };

      mockPrisma.investigation.findUnique.mockResolvedValue(mockInvestigation);

      const handler = actions.get('investigation_selected');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        action: {
          type: 'static_select',
          selected_option: {
            value: 'inv-123',
          },
        },
        ack,
        respond,
        body: {
          team: { id: 'T123456' },
        },
      });

      expect(respond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Incident Commander:* <@U789012>',
            },
          }),
        ]),
      });
    });

    it('should handle investigation not found', async () => {
      mockPrisma.investigation.findUnique.mockResolvedValue(null);

      const handler = actions.get('investigation_selected');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        action: {
          type: 'static_select',
          selected_option: {
            value: 'inv-999',
          },
        },
        ack,
        respond,
        body: {},
      });

      expect(respond).toHaveBeenCalledWith({
        text: '⚠️ Investigation not found.',
        response_type: 'ephemeral',
      });
    });

    it('should handle invalid action type', async () => {
      const handler = actions.get('investigation_selected');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        action: {
          type: 'button', // Invalid type
        },
        ack,
        respond,
        body: {},
      });

      expect(ack).toHaveBeenCalled();
      expect(mockPrisma.investigation.findUnique).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.investigation.findUnique.mockRejectedValue(new Error('Database error'));

      const handler = actions.get('investigation_selected');
      const ack = jest.fn();
      const respond = jest.fn();

      await handler({
        action: {
          type: 'static_select',
          selected_option: {
            value: 'inv-123',
          },
        },
        ack,
        respond,
        body: {},
      });

      expect(respond).toHaveBeenCalledWith({
        text: '⚠️ Failed to fetch investigation details.',
        response_type: 'ephemeral',
      });
    });
  });
});