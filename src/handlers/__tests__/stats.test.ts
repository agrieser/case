import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleStats } from '../stats';
import { createMockRespond, createMockPrismaClient } from '../../test/utils/testHelpers';

describe('handleStats', () => {
  let mockPrisma: any;
  let mockRespond: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockRespond = createMockRespond();
    
    // Default mock implementations
    mockPrisma.investigation.count.mockResolvedValue(0);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);
    mockPrisma.investigation.groupBy.mockResolvedValue([]);
    mockPrisma.incident.groupBy.mockResolvedValue([]);
  });

  describe('basic statistics', () => {
    it('should display statistics when data exists', async () => {
      // Mock investigation counts
      mockPrisma.investigation.count
        .mockResolvedValueOnce(25) // total
        .mockResolvedValueOnce(5);  // active
      
      // Mock incident count
      mockPrisma.incident.count.mockResolvedValue(8);
      
      // Mock resolved incidents for average resolution time
      mockPrisma.incident.findMany.mockResolvedValue([
        {
          escalatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)   // 1 hour ago
        },
        {
          escalatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          resolvedAt: new Date(Date.now() - 30 * 60 * 1000)       // 30 minutes ago
        }
      ]);
      
      // Mock event count
      mockPrisma.event.count.mockResolvedValue(150);
      
      // Mock top investigators
      mockPrisma.investigation.groupBy.mockResolvedValue([
        { createdBy: 'U123456', _count: { createdBy: 10 } },
        { createdBy: 'U789012', _count: { createdBy: 8 } },
        { createdBy: 'U345678', _count: { createdBy: 5 } }
      ]);
      
      // Mock top commanders
      mockPrisma.incident.groupBy.mockResolvedValue([
        { incidentCommander: 'U123456', _count: { incidentCommander: 4 } },
        { incidentCommander: 'U789012', _count: { incidentCommander: 3 } }
      ]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '📊 Case Statistics'
            })
          }),
          expect.objectContaining({
            type: 'section',
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('25 (5 active)')
              }),
              expect.objectContaining({
                text: expect.stringContaining('8 incidents (32.0%)')
              }),
              expect.objectContaining({
                text: expect.stringContaining('1h 45m') // Average of 2h and 1.5h
              }),
              expect.objectContaining({
                text: expect.stringContaining('150 total')
              })
            ])
          })
        ])
      });
    });

    it('should handle empty statistics gracefully', async () => {
      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('0 (0 active)')
              }),
              expect.objectContaining({
                text: expect.stringContaining('0 incidents (0.0%)')
              }),
              expect.objectContaining({
                text: expect.stringContaining('0m')
              })
            ])
          }),
          expect.objectContaining({
            text: expect.objectContaining({
              text: '_No investigations yet_'
            })
          }),
          expect.objectContaining({
            text: expect.objectContaining({
              text: '_No incidents yet_'
            })
          })
        ])
      });
    });

    it('should calculate correct average resolution time', async () => {
      mockPrisma.incident.findMany.mockResolvedValue([
        {
          escalatedAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: new Date('2024-01-01T12:30:00Z') // 2.5 hours
        },
        {
          escalatedAt: new Date('2024-01-01T14:00:00Z'),
          resolvedAt: new Date('2024-01-01T14:30:00Z') // 30 minutes
        },
        {
          escalatedAt: new Date('2024-01-01T16:00:00Z'),
          resolvedAt: new Date('2024-01-01T17:00:00Z') // 1 hour
        }
      ]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      // Average: (150 + 30 + 60) / 3 = 80 minutes = 1h 20m
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('1h 20m')
              })
            ])
          })
        ])
      });
    });

    it('should handle division by zero for escalation rate', async () => {
      mockPrisma.investigation.count
        .mockResolvedValueOnce(0)  // total
        .mockResolvedValueOnce(0); // active

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('0 incidents (0.0%)')
              })
            ])
          })
        ])
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.investigation.count.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to generate statistics. Please try again.',
        response_type: 'ephemeral'
      });
    });
  });

  describe('leaderboards', () => {
    it('should display top 3 investigators', async () => {
      mockPrisma.investigation.groupBy.mockResolvedValue([
        { createdBy: 'U111111', _count: { createdBy: 15 } },
        { createdBy: 'U222222', _count: { createdBy: 12 } },
        { createdBy: 'U333333', _count: { createdBy: 10 } }
      ]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      const response = mockRespond.mock.calls[0][0];
      const leaderboardBlock = response.blocks.find((block: any) => 
        block.text?.text?.includes('<@U111111>')
      );

      expect(leaderboardBlock.text.text).toContain('1. <@U111111> - 15 investigations');
      expect(leaderboardBlock.text.text).toContain('2. <@U222222> - 12 investigations');
      expect(leaderboardBlock.text.text).toContain('3. <@U333333> - 10 investigations');
    });

    it('should display top 3 incident commanders', async () => {
      mockPrisma.incident.groupBy.mockResolvedValue([
        { incidentCommander: 'U555555', _count: { incidentCommander: 8 } },
        { incidentCommander: 'U666666', _count: { incidentCommander: 6 } },
        { incidentCommander: 'U777777', _count: { incidentCommander: 4 } }
      ]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      const response = mockRespond.mock.calls[0][0];
      const commanderBlock = response.blocks.find((block: any) => 
        block.text?.text?.includes('<@U555555>')
      );

      expect(commanderBlock.text.text).toContain('1. <@U555555> - 8 incidents');
      expect(commanderBlock.text.text).toContain('2. <@U666666> - 6 incidents');
      expect(commanderBlock.text.text).toContain('3. <@U777777> - 4 incidents');
    });
  });
});