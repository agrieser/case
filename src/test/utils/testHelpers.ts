import { RespondFn } from '@slack/bolt';
import { SlackCommandMiddlewareArgs } from '@slack/bolt';

export function createMockRespond(): RespondFn {
  return jest.fn().mockImplementation(() => Promise.resolve()) as RespondFn;
}

export function createMockCommand(overrides?: Partial<SlackCommandMiddlewareArgs['command']>): SlackCommandMiddlewareArgs['command'] {
  return {
    token: 'test-token',
    team_id: 'T123456',
    team_domain: 'test-team',
    channel_id: 'C123456',
    channel_name: 'test-channel',
    user_id: 'U123456',
    user_name: 'testuser',
    command: '/trace',
    text: '',
    api_app_id: 'A123456',
    response_url: 'https://hooks.slack.com/response',
    trigger_id: 'trigger123',
    ...overrides,
  };
}

export function createMockPrismaClient() {
  return {
    investigation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    incident: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };
}

export function createMockWebClient() {
  return {
    conversations: {
      create: jest.fn().mockResolvedValue({ ok: true, channel: { id: 'C999NEW' } }),
      join: jest.fn().mockResolvedValue({ ok: true }),
      invite: jest.fn().mockResolvedValue({ ok: true }),
      list: jest.fn().mockResolvedValue({ ok: true, channels: [] }),
      archive: jest.fn().mockResolvedValue({ ok: true }),
    },
    chat: {
      postMessage: jest.fn().mockResolvedValue({ ok: true }),
      postEphemeral: jest.fn().mockResolvedValue({ ok: true }),
    },
    views: {
      open: jest.fn().mockResolvedValue({ ok: true }),
      update: jest.fn().mockResolvedValue({ ok: true }),
      push: jest.fn().mockResolvedValue({ ok: true }),
    },
  };
}