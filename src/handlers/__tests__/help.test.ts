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
              text: '🔍 Case - Incident Management'
            })
          }),
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              type: 'mrkdwn',
              text: expect.stringContaining('/case create')
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

    expect(helpText).toContain('/case create');
    expect(helpText).toContain('/case status');
    expect(helpText).toContain('/case incident');
    expect(helpText).toContain('/case list');
    expect(helpText).toContain('/case help');
    expect(helpText).toContain('Add to Investigation');
  });
});