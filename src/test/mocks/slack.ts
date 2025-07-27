import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';

export const createMockSlackClient = (): jest.Mocked<WebClient> => {
  return {
    users: {
      info: jest.fn().mockResolvedValue({
        user: {
          id: 'U123456',
          real_name: 'Test User',
          name: 'testuser'
        }
      })
    },
    chat: {
      postMessage: jest.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C123456'
      }),
      update: jest.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      })
    },
    views: {
      open: jest.fn().mockResolvedValue({ ok: true })
    }
  } as any;
};

export const createMockRespond = (): jest.MockedFunction<RespondFn> => {
  return jest.fn().mockResolvedValue({ ok: true });
};

export const createMockCommand = (text: string = '', userId: string = 'U123456') => {
  return {
    text,
    user_id: userId,
    channel_id: 'C123456',
    channel_name: 'general',
    command: '/case',
    trigger_id: 'trigger_123',
    token: 'xoxb-test-token',
    response_url: 'https://hooks.slack.com/commands/test',
    user_name: 'testuser',
    team_id: 'T123456',
    team_domain: 'test-workspace',
    api_app_id: 'A123456'
  };
};

export const createMockAck = () => jest.fn().mockResolvedValue(undefined);