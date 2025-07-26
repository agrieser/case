import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleEvent } from '../event';
import { createMockRespond, createMockCommand } from '../../test/mocks/slack';
import { prisma } from '../../test/setup';

describe('handleEvent', () => {
  let mockRespond: ReturnType<typeof createMockRespond>;

  beforeEach(() => {
    mockRespond = createMockRespond();
  });

  it('should create an event when there is an investigation for the channel', async () => {
    const command = createMockCommand('event');
    
    // Create a real investigation in the database
    const investigation = await prisma.investigation.create({
      data: {
        name: 'trace-golden-falcon',
        title: 'Test Investigation',
        channelId: command.channel_id,
        createdBy: 'U123456',
      }
    });
    
    await handleEvent({
      command,
      respond: mockRespond
    }, prisma);

    // Check event was created in the database
    const events = await prisma.event.findMany({
      where: { investigationId: investigation.id }
    });
    
    expect(events).toHaveLength(1);
    expect(events[0].investigationId).toBe(investigation.id);
    expect(events[0].addedBy).toBe(command.user_id);
    expect(events[0].slackMessageUrl).toContain('slack.com');

    // Check response was sent
    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'in_channel',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('✅ Event added to investigation')
            })
          })
        ])
      })
    );
  });

  it('should show error when no investigation exists for the channel', async () => {
    const command = createMockCommand('event');
    
    // No investigation created - channel should have no investigation
    
    await handleEvent({
      command,
      respond: mockRespond
    }, prisma);

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('This channel is not associated with an investigation'),
        response_type: 'ephemeral'
      })
    );

    // No event should be created
    const events = await prisma.event.findMany();
    expect(events).toHaveLength(0);
  });

});