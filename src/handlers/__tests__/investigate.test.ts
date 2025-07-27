import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleInvestigate } from '../investigate';
import { createMockRespond, createMockCommand, createMockPrismaClient, createMockWebClient } from '../../test/utils/testHelpers';

describe('handleInvestigate', () => {
  let mockPrisma: any;
  let mockClient: any;
  let mockRespond: any;
  let mockCommand: any;
  
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment
    process.env = { ...originalEnv };
    process.env.ISSUES_CHANNEL_ID = 'C123ISSUES';

    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();
    mockRespond = createMockRespond();
    mockCommand = createMockCommand();
    
    // Default successful mock implementations
    mockClient.conversations.create.mockResolvedValue({
      ok: true,
      channel: { id: 'C999NEWCHANNEL', name: 'trace-test-issue-abc' },
    });
    
    mockPrisma.investigation.findUnique.mockResolvedValue(null);
    mockPrisma.investigation.create.mockResolvedValue({
      id: 'inv-123',
      name: 'trace-test-issue-abc',
      title: 'Test issue',
      status: 'investigating',
      channelId: 'C999NEWCHANNEL',
      createdBy: 'U123456',
      createdAt: new Date(),
      issuesMessageTs: '1234567890.123456',
    });
    
    // Mock the postMessage response with timestamp
    mockClient.chat.postMessage.mockResolvedValue({
      ok: true,
      ts: '1234567890.123456',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('successful investigation creation', () => {
    it('should create investigation with valid title', async () => {
      const title = 'API response times increasing';
      
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title, client: mockClient },
        mockPrisma
      );

      // Verify channel was created
      expect(mockClient.conversations.create).toHaveBeenCalledWith({
        name: expect.stringMatching(/^trace-api-respons-[a-f0-9]{3}$/),
        is_private: false,
      });

      // Verify investigation was created in database
      expect(mockPrisma.investigation.create).toHaveBeenCalledWith({
        data: {
          name: expect.stringMatching(/^trace-api-respons-[a-f0-9]{3}$/),
          title: 'API response times increasing',
          channelId: 'C999NEWCHANNEL',
          createdBy: 'U123456',
          issuesMessageTs: '1234567890.123456',
        },
      });

      // Verify bot joined channel
      expect(mockClient.conversations.join).toHaveBeenCalledWith({
        channel: 'C999NEWCHANNEL',
      });

      // Verify user was invited
      expect(mockClient.conversations.invite).toHaveBeenCalledWith({
        channel: 'C999NEWCHANNEL',
        users: 'U123456',
      });

      // Verify message posted to issues channel
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123ISSUES',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining('Investigation created'),
            }),
          }),
        ]),
      });

      // Verify user response
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: expect.stringContaining('Investigation'),
      });
    });

    it('should handle channel name truncation for long titles', async () => {
      const title = 'This is a very long investigation title that will be truncated';
      
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title, client: mockClient },
        mockPrisma
      );

      expect(mockClient.conversations.create).toHaveBeenCalledWith({
        name: expect.stringMatching(/^trace-this-is-a-v-[a-f0-9]{3}$/),
        is_private: false,
      });
    });

    it('should sanitize special characters in title', async () => {
      const title = 'Database @ Performance! Issue #123';
      
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title, client: mockClient },
        mockPrisma
      );

      expect(mockClient.conversations.create).toHaveBeenCalledWith({
        name: expect.stringMatching(/^trace-database-pe-[a-f0-9]{3}$/),
        is_private: false,
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing user ID', async () => {
      mockCommand.user_id = undefined;
      
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test', client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('error'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.create).not.toHaveBeenCalled();
    });

    it('should handle empty title', async () => {
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: '', client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('Title cannot be empty'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.create).not.toHaveBeenCalled();
    });

    it('should handle title that is too long', async () => {
      const longTitle = 'a'.repeat(201);
      
      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: longTitle, client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('200 characters'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.create).not.toHaveBeenCalled();
    });

    it('should handle channel creation failure', async () => {
      mockClient.conversations.create.mockResolvedValue({
        ok: false,
        error: 'name_taken',
      });

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('error'),
        response_type: 'ephemeral',
      });
      expect(mockPrisma.investigation.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrisma.investigation.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('error'),
        response_type: 'ephemeral',
      });
    });

    it('should continue if bot fails to join channel', async () => {
      mockClient.conversations.join.mockRejectedValue(
        new Error('already_in_channel')
      );

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      // Should still create investigation
      expect(mockPrisma.investigation.create).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: expect.stringContaining('successfully'),
      });
    });

    it('should continue if user invite fails', async () => {
      mockClient.conversations.invite.mockRejectedValue(
        new Error('already_in_channel')
      );

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      // Should still create investigation
      expect(mockPrisma.investigation.create).toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: expect.stringContaining('successfully'),
      });
    });
  });

  describe('unique name generation', () => {
    it('should retry with new name if name already exists', async () => {
      // First call returns existing investigation, second returns null
      mockPrisma.investigation.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      // Should check uniqueness twice
      expect(mockPrisma.investigation.findUnique).toHaveBeenCalledTimes(2);
      
      // Should create with unique name
      expect(mockPrisma.investigation.create).toHaveBeenCalled();
    });
  });

  describe('issues channel', () => {
    it('should handle missing ISSUES_CHANNEL_ID env var', async () => {
      delete process.env.ISSUES_CHANNEL_ID;

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('An error occurred'),
        response_type: 'ephemeral',
      });
    });

    it('should handle failure to post to issues channel', async () => {
      mockClient.chat.postMessage.mockRejectedValue(
        new Error('channel_not_found')
      );

      await handleInvestigate(
        { command: mockCommand, respond: mockRespond, title: 'Test issue', client: mockClient },
        mockPrisma
      );

      // Should fail because posting to issues channel failed
      expect(mockRespond).toHaveBeenCalledWith({
        text: expect.stringContaining('An error occurred'),
        response_type: 'ephemeral',
      });
    });
  });
});