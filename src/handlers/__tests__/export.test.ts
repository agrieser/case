import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleExport } from '../export';
import { createMockRespond, createMockPrismaClient, createMockWebClient } from '../../test/utils/testHelpers';

describe('handleExport', () => {
  let mockPrisma: any;
  let mockClient: any;
  let mockRespond: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.EXPORT_AUTHORIZED_USERS;
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();
    mockRespond = createMockRespond();
    
    // Default mock implementations
    mockPrisma.investigation.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('successful export', () => {
    it('should export investigations to CSV and upload file', async () => {
      const mockInvestigations = [
        {
          id: 'inv-123',
          name: 'case-api-issue-abc',
          title: 'API issues critical',
          status: 'escalated',
          channelId: 'C999INVEST',
          createdBy: 'U123456',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          closedBy: null,
          closedAt: null,
          issuesMessageTs: '1234567890.123456',
          _count: { events: 5 },
          incident: {
            id: 'inc-456',
            investigationId: 'inv-123',
            incidentCommander: 'U789012',
            escalatedAt: new Date('2024-01-01T11:00:00Z'),
            resolvedAt: new Date('2024-01-01T13:00:00Z'),
            resolvedBy: 'U345678'
          }
        },
        {
          id: 'inv-789',
          name: 'case-db-slow-def',
          title: 'Database queries slow',
          status: 'closed',
          channelId: 'C999INVEST2',
          createdBy: 'U999999',
          createdAt: new Date('2024-01-02T09:00:00Z'),
          closedBy: 'U999999',
          closedAt: new Date('2024-01-02T10:30:00Z'),
          issuesMessageTs: '1234567890.654321',
          _count: { events: 3 },
          incident: null
        }
      ];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      // Verify investigations were fetched
      expect(mockPrisma.investigation.findMany).toHaveBeenCalledWith({
        include: {
          incident: true,
          _count: {
            select: { events: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Verify file was uploaded
      expect(mockClient.files.uploadV2).toHaveBeenCalledWith({
        channel_id: 'U123456',
        filename: expect.stringMatching(/^case-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.csv$/),
        file: expect.any(Buffer),
        initial_comment: '📊 Case Export - 2 investigations'
      });

      // Verify CSV content includes headers
      const uploadCall = mockClient.files.uploadV2.mock.calls[0][0];
      const csvContent = uploadCall.file.toString();
      expect(csvContent).toContain('Investigation Name,Title,Status,Channel ID');
      expect(csvContent).toContain('case-api-issue-abc,"API issues critical",escalated');
      expect(csvContent).toContain('case-db-slow-def,"Database queries slow",closed');

      // Verify response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: '✅ Export complete! I\'ve sent you the CSV file as a direct message.'
            })
          })
        ])
      });
    });

    it('should handle investigations with special characters in title', async () => {
      const mockInvestigations = [{
        id: 'inv-123',
        name: 'case-special-abc',
        title: 'Title with "quotes" and, commas',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 2 },
        incident: null
      }];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      const uploadCall = mockClient.files.uploadV2.mock.calls[0][0];
      const csvContent = uploadCall.file.toString();
      
      // Verify quotes are properly escaped
      expect(csvContent).toContain('"Title with ""quotes"" and, commas"');
    });

    it('should calculate durations correctly', async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const mockInvestigations = [{
        id: 'inv-123',
        name: 'case-duration-test',
        title: 'Duration test',
        status: 'investigating',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: twoHoursAgo,
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 0 },
        incident: null
      }];

      mockPrisma.investigation.findMany.mockResolvedValue(mockInvestigations);

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      const uploadCall = mockClient.files.uploadV2.mock.calls[0][0];
      const csvContent = uploadCall.file.toString();
      
      // Should show approximately 2 hours duration
      expect(csvContent).toMatch(/2\.\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle no investigations', async () => {
      mockPrisma.investigation.findMany.mockResolvedValue([]);

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockClient.files.uploadV2).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        text: 'No investigations found to export.',
        response_type: 'ephemeral',
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors', async () => {
      mockPrisma.investigation.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to export data. Please try again.',
        response_type: 'ephemeral',
      });
    });

    it('should handle file upload failure', async () => {
      mockPrisma.investigation.findMany.mockResolvedValue([{
        id: 'inv-123',
        name: 'case-test',
        title: 'Test',
        status: 'investigating',
        channelId: 'C999',
        createdBy: 'U123',
        createdAt: new Date(),
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '123.456',
        _count: { events: 0 },
        incident: null
      }]);

      mockClient.files.uploadV2.mockResolvedValue({ ok: false });

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456',
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Failed to export data. Please try again.',
        response_type: 'ephemeral',
      });
    });
  });

  describe('authorization', () => {
    it('should allow export when no authorized users are configured', async () => {
      // No EXPORT_AUTHORIZED_USERS env var set
      mockPrisma.investigation.findMany.mockResolvedValue([{
        id: 'inv-123',
        name: 'case-test-abc',
        title: 'Test issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(),
        closedBy: 'U123456',
        closedAt: new Date(),
        issuesMessageTs: '1234567890.123456',
        _count: { events: 1 },
        incident: null
      }]);

      mockClient.files.uploadV2.mockResolvedValue({ ok: true });

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U999999', // Any user
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockClient.files.uploadV2).toHaveBeenCalled();
    });

    it('should allow authorized users to export', async () => {
      process.env.EXPORT_AUTHORIZED_USERS = 'U123456,U789012,U345678';
      
      mockPrisma.investigation.findMany.mockResolvedValue([{
        id: 'inv-123',
        name: 'case-test-abc',
        title: 'Test issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(),
        closedBy: 'U123456',
        closedAt: new Date(),
        issuesMessageTs: '1234567890.123456',
        _count: { events: 1 },
        incident: null
      }]);

      mockClient.files.uploadV2.mockResolvedValue({ ok: true });

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U789012', // Authorized user
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockClient.files.uploadV2).toHaveBeenCalled();
    });

    it('should block unauthorized users from exporting', async () => {
      process.env.EXPORT_AUTHORIZED_USERS = 'U123456,U789012,U345678';

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U999999', // Unauthorized user
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: '🔒 You are not authorized to export data. Please contact your administrator.',
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.findMany).not.toHaveBeenCalled();
      expect(mockClient.files.uploadV2).not.toHaveBeenCalled();
    });

    it('should handle whitespace in authorized users list', async () => {
      process.env.EXPORT_AUTHORIZED_USERS = ' U123456 , U789012 , U345678 ';
      
      mockPrisma.investigation.findMany.mockResolvedValue([{
        id: 'inv-123',
        name: 'case-test-abc',
        title: 'Test issue',
        status: 'closed',
        channelId: 'C999INVEST',
        createdBy: 'U123456',
        createdAt: new Date(),
        closedBy: 'U123456',
        closedAt: new Date(),
        issuesMessageTs: '1234567890.123456',
        _count: { events: 1 },
        incident: null
      }]);

      mockClient.files.uploadV2.mockResolvedValue({ ok: true });

      await handleExport(
        { 
          respond: mockRespond, 
          userId: 'U123456', // Authorized user (with spaces trimmed)
          client: mockClient 
        },
        mockPrisma
      );

      expect(mockClient.files.uploadV2).toHaveBeenCalled();
    });
  });
});