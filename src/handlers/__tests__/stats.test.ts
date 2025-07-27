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
    mockPrisma.investigation.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);
    mockPrisma.incident.findMany.mockResolvedValue([]);
  });

  describe('operational metrics', () => {
    it('should display current status', async () => {
      // Mock current state
      mockPrisma.investigation.count
        .mockResolvedValueOnce(3)  // current investigations
        .mockResolvedValueOnce(1)  // current incidents
        .mockResolvedValueOnce(8)  // 7-day investigations
        .mockResolvedValue(0);
      
      mockPrisma.incident.count.mockResolvedValueOnce(4); // 7-day incidents
      
      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '📊 Operational Dashboard'
            })
          }),
          expect.objectContaining({
            type: 'section',
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('Active Investigations:*\n3')
              }),
              expect.objectContaining({
                text: expect.stringContaining('Active Incidents:*\n1')
              })
            ])
          })
        ])
      });
    });

    it('should display 7-day activity metrics', async () => {
      const now = new Date();
      
      // Mock 7-day counts
      mockPrisma.investigation.count
        .mockResolvedValueOnce(0)  // current investigations
        .mockResolvedValueOnce(0)  // current incidents
        .mockResolvedValueOnce(15); // 7-day investigations
      
      mockPrisma.incident.count.mockResolvedValueOnce(5); // 7-day incidents
      
      // Mock investigation time data
      mockPrisma.investigation.findMany
        .mockResolvedValueOnce([
          {
            createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
            closedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago (2 hours)
            status: 'closed'
          },
          {
            createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
            closedAt: null, // Still open (3 hours)
            status: 'investigating'
          }
        ])
        .mockResolvedValueOnce([]); // closed investigations
      
      // Mock incident time data
      mockPrisma.incident.findMany
        .mockResolvedValueOnce([
          {
            escalatedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
            resolvedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago (2 hours)
          },
          {
            escalatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            resolvedAt: null // Still active (2 hours)
          }
        ])
        .mockResolvedValueOnce([]); // resolved incidents

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: '*Cases Opened:*\n15'
              }),
              expect.objectContaining({
                text: '*Incidents Declared:*\n5'
              }),
              expect.objectContaining({
                text: '*Investigation Time:*\n5h 0m' // 2 + 3 hours
              }),
              expect.objectContaining({
                text: '*Incident Time:*\n4h 0m' // 2 + 2 hours
              })
            ])
          })
        ])
      });
    });

    it('should calculate average resolution times', async () => {
      // Mock closed investigations
      mockPrisma.investigation.findMany
        .mockResolvedValueOnce([]) // 7-day data
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2024-01-01T10:00:00Z'),
            closedAt: new Date('2024-01-01T14:00:00Z') // 4 hours
          },
          {
            createdAt: new Date('2024-01-01T12:00:00Z'),
            closedAt: new Date('2024-01-01T13:30:00Z') // 1.5 hours
          },
          {
            createdAt: new Date('2024-01-01T15:00:00Z'),
            closedAt: new Date('2024-01-01T17:30:00Z') // 2.5 hours
          }
        ]);
      
      // Mock resolved incidents
      mockPrisma.incident.findMany
        .mockResolvedValueOnce([]) // 7-day data
        .mockResolvedValueOnce([
          {
            escalatedAt: new Date('2024-01-01T10:00:00Z'),
            resolvedAt: new Date('2024-01-01T11:00:00Z') // 1 hour
          },
          {
            escalatedAt: new Date('2024-01-01T14:00:00Z'),
            resolvedAt: new Date('2024-01-01T16:00:00Z') // 2 hours
          }
        ]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: '*Investigation Close:*\n2h 40m' // Average of 4, 1.5, 2.5 hours = 160 minutes
              }),
              expect.objectContaining({
                text: '*Incident Resolve:*\n1h 30m' // Average of 1, 2 hours = 90 minutes
              })
            ])
          })
        ])
      });
    });

    it('should handle no data gracefully', async () => {
      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: '*Investigation Close:*\nNo data'
              }),
              expect.objectContaining({
                text: '*Incident Resolve:*\nNo data'
              })
            ])
          })
        ])
      });
    });

    it('should format long durations correctly', async () => {
      const now = new Date();
      
      // Mock investigation with very long duration
      mockPrisma.investigation.findMany
        .mockResolvedValueOnce([
          {
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            closedAt: null, // Still open
            status: 'investigating'
          }
        ])
        .mockResolvedValueOnce([]); // closed investigations
      
      mockPrisma.incident.findMany.mockResolvedValue([]);

      await handleStats({ respond: mockRespond }, mockPrisma);

      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('3d 0h') // 3 days duration
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

  describe('timestamp display', () => {
    it('should include update timestamp', async () => {
      await handleStats({ respond: mockRespond }, mockPrisma);

      const response = mockRespond.mock.calls[0][0];
      const contextBlock = response.blocks.find((block: any) => 
        block.type === 'context'
      );

      expect(contextBlock.elements[0].text).toMatch(/_Updated \d{1,2}:\d{2}:\d{2}/);
    });
  });
});