import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { handleEvent } from '../event';
import { createMockRespond, createMockCommand } from '../../test/mocks/slack';
import { prismaMock } from '../../test/setup';
import { getCurrentInvestigation } from '../../utils/channelState';

// Mock the channelState module
jest.mock('../../utils/channelState');
const mockGetCurrentInvestigation = getCurrentInvestigation as jest.MockedFunction<typeof getCurrentInvestigation>;

describe('handleEvent', () => {
  let mockRespond: ReturnType<typeof createMockRespond>;

  beforeEach(() => {
    mockRespond = createMockRespond();
    jest.clearAllMocks();
  });

  it('should create an event when there is a current investigation', async () => {
    const command = createMockCommand('event');
    const investigationName = 'trace-golden-falcon';
    
    // Mock current investigation
    mockGetCurrentInvestigation.mockResolvedValue(investigationName);
    
    // Mock investigation lookup
    prismaMock.investigation.findUnique.mockResolvedValue({
      name: investigationName,
      title: 'Test Investigation',
      status: 'investigating',
      channelId: 'C123456',
      createdBy: 'U123456',
      createdAt: new Date(),
      _count: { events: 2 }
    } as any);

    // Mock event creation
    prismaMock.event.create.mockResolvedValue({
      id: 'event-123',
      investigationName,
      slackMessageUrl: `https://test-workspace.slack.com/archives/${command.channel_id}/p123456`,
      addedBy: command.user_id,
      addedAt: new Date()
    });
    
    await handleEvent({
      command,
      respond: mockRespond
    }, prismaMock as unknown as PrismaClient);

    // Check event was created
    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: {
        investigationName,
        slackMessageUrl: expect.stringContaining('slack.com'),
        addedBy: command.user_id
      }
    });

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

  it('should show error when no current investigation', async () => {
    const command = createMockCommand('event');
    
    // Mock no current investigation
    mockGetCurrentInvestigation.mockResolvedValue(null);
    
    await handleEvent({
      command,
      respond: mockRespond
    }, prismaMock as unknown as PrismaClient);

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('No active investigation in this channel'),
        response_type: 'ephemeral'
      })
    );

    // No event should be created
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const command = createMockCommand('event');
    const investigationName = 'trace-golden-falcon';
    
    // Mock current investigation
    mockGetCurrentInvestigation.mockResolvedValue(investigationName);
    
    // Mock database error
    prismaMock.event.create.mockRejectedValueOnce(new Error('Database error'));
    
    await handleEvent({
      command,
      respond: mockRespond
    }, prismaMock as unknown as PrismaClient);

    expect(mockRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Failed to add event'),
        response_type: 'ephemeral'
      })
    );
  });
});