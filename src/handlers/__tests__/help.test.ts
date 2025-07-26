import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleHelp } from '../help';
import { createMockRespond } from '../../test/mocks/slack';

describe('handleHelp', () => {
  let mockRespond: ReturnType<typeof createMockRespond>;

  beforeEach(() => {
    mockRespond = createMockRespond();
  });

  it('should display help message with all commands', async () => {
    await handleHelp({ respond: mockRespond });

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '🔍 Trace - Incident Management'
            })
          }),
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              type: 'mrkdwn',
              text: expect.stringContaining('/trace investigate')
            })
          })
        ])
      })
    );
  });

  it('should include all command options in help text', async () => {
    await handleHelp({ respond: mockRespond });

    const call = mockRespond.mock.calls[0][0];
    const helpText = JSON.stringify(call);

    expect(helpText).toContain('/trace investigate');
    expect(helpText).toContain('/trace event');
    expect(helpText).toContain('/trace status');
    expect(helpText).toContain('/trace incident');
    expect(helpText).toContain('/trace help');
  });
});