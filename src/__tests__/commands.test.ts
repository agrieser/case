import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { App } from '@slack/bolt';
import { registerCommands } from '../commands';
import { createMockRespond, createMockCommand, createMockPrismaClient, createMockWebClient } from '../test/utils/testHelpers';

// Mock all handlers
jest.mock('../handlers/investigate', () => ({
  handleInvestigate: jest.fn()
}));
jest.mock('../handlers/status', () => ({
  handleStatus: jest.fn()
}));
jest.mock('../handlers/incident', () => ({
  handleIncident: jest.fn()
}));
jest.mock('../handlers/help', () => ({
  handleHelp: jest.fn()
}));
jest.mock('../handlers/list', () => ({
  handleList: jest.fn()
}));
jest.mock('../handlers/close', () => ({
  handleClose: jest.fn()
}));
jest.mock('../handlers/transfer', () => ({
  handleTransfer: jest.fn()
}));
jest.mock('../handlers/resolve', () => ({
  handleResolve: jest.fn()
}));

// Mock middleware
jest.mock('../middleware/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true })
}));
jest.mock('../middleware/validation', () => ({
  validateCommandContext: jest.fn(),
  parseCommandArgs: jest.fn((text: string) => {
    const [subcommand, ...args] = text.trim().split(/\s+/);
    return { subcommand: subcommand || '', args: args.join(' ') };
  }),
  createSafeErrorMessage: jest.fn(() => '⚠️ An error occurred. Please try again.'),
  sanitizeInput: jest.fn((input: string) => input.replace(/[<>]/g, ''))
}));
jest.mock('../middleware/security', () => ({
  validateUserAccess: jest.fn().mockReturnValue(null),
  getUserContext: jest.fn((command: any) => ({
    userId: command.user_id,
    teamId: command.team_id,
    isExternal: false,
    channelId: command.channel_id
  }))
}));

describe('registerCommands', () => {
  let mockApp: any;
  let mockPrisma: any;
  let mockClient: any;
  let commandHandler: any;

  // Import mocked handlers
  const { handleInvestigate } = jest.requireMock('../handlers/investigate') as any;
  const { handleStatus } = jest.requireMock('../handlers/status') as any;
  const { handleIncident } = jest.requireMock('../handlers/incident') as any;
  const { handleHelp } = jest.requireMock('../handlers/help') as any;
  const { handleList } = jest.requireMock('../handlers/list') as any;
  const { handleClose } = jest.requireMock('../handlers/close') as any;
  const { handleTransfer } = jest.requireMock('../handlers/transfer') as any;
  const { handleResolve } = jest.requireMock('../handlers/resolve') as any;
  const { checkRateLimit } = jest.requireMock('../middleware/rateLimit') as any;
  const { validateCommandContext, createSafeErrorMessage } = jest.requireMock('../middleware/validation') as any;
  const { validateUserAccess, getUserContext } = jest.requireMock('../middleware/security') as any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockPrisma = createMockPrismaClient();
    mockClient = createMockWebClient();
    
    // Mock App with command registration
    mockApp = {
      command: jest.fn((_cmd: string, handler: any) => {
        commandHandler = handler;
      })
    };
    
    // Register commands
    registerCommands(mockApp as App, mockPrisma);
  });

  describe('command registration', () => {
    it('should register /trace command', () => {
      expect(mockApp.command).toHaveBeenCalledWith('/trace', expect.any(Function));
    });
  });

  describe('/trace create', () => {
    it('should call handleInvestigate with title', async () => {
      const mockCommand = createMockCommand({ text: 'create API issues' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(ack).toHaveBeenCalled();
      expect(handleInvestigate).toHaveBeenCalledWith({
        command: mockCommand,
        respond: mockRespond,
        title: 'API issues',
        client: mockClient
      }, mockPrisma);
    });
  });

  describe('/trace status', () => {
    it('should call handleStatus', async () => {
      const mockCommand = createMockCommand({ text: 'status' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleStatus).toHaveBeenCalledWith({
        command: mockCommand,
        respond: mockRespond
      }, mockPrisma);
    });
  });

  describe('/trace incident', () => {
    it('should call handleIncident', async () => {
      const mockCommand = createMockCommand({ text: 'incident' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleIncident).toHaveBeenCalledWith({
        command: mockCommand,
        respond: mockRespond
      }, mockPrisma);
    });
  });

  describe('/trace list', () => {
    it('should call handleList', async () => {
      const mockCommand = createMockCommand({ text: 'list' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleList).toHaveBeenCalledWith({
        respond: mockRespond,
        userId: 'U123456'
      }, mockPrisma);
    });
  });

  describe('/trace close', () => {
    it('should call handleClose', async () => {
      const mockCommand = createMockCommand({ text: 'close' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleClose).toHaveBeenCalledWith({
        respond: mockRespond,
        channelId: 'C123456',
        userId: 'U123456',
        client: mockClient
      }, mockPrisma);
    });
  });

  describe('/trace transfer', () => {
    it('should call handleTransfer with new commander', async () => {
      const mockCommand = createMockCommand({ text: 'transfer <@U789012>' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleTransfer).toHaveBeenCalledWith({
        respond: mockRespond,
        channelId: 'C123456',
        userId: 'U123456',
        newCommander: '<@U789012>'
      }, mockPrisma);
    });
  });

  describe('/trace resolve', () => {
    it('should call handleResolve', async () => {
      const mockCommand = createMockCommand({ text: 'resolve' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleResolve).toHaveBeenCalledWith({
        respond: mockRespond,
        channelId: 'C123456',
        userId: 'U123456',
        client: mockClient
      }, mockPrisma);
    });
  });

  describe('/trace help', () => {
    it('should call handleHelp', async () => {
      const mockCommand = createMockCommand({ text: 'help' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleHelp).toHaveBeenCalledWith({
        respond: mockRespond
      });
    });
  });

  describe('/trace (no subcommand)', () => {
    it('should call handleList when no subcommand provided', async () => {
      const mockCommand = createMockCommand({ text: '' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleList).toHaveBeenCalledWith({
        respond: mockRespond,
        userId: 'U123456'
      }, mockPrisma);
    });

    it('should handle whitespace-only text', async () => {
      const mockCommand = createMockCommand({ text: '   ' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleList).toHaveBeenCalledWith({
        respond: mockRespond,
        userId: 'U123456'
      }, mockPrisma);
    });
  });

  describe('unknown command', () => {
    it('should respond with error for unknown subcommand', async () => {
      const mockCommand = createMockCommand({ text: 'unknown' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Unknown command: `unknown`. Use `/trace help` for available commands.',
        response_type: 'ephemeral'
      });
    });

    it('should sanitize unknown subcommand', async () => {
      const mockCommand = createMockCommand({ text: '<script>alert("xss")</script>' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Unknown command: `scriptalert("xss")/script`. Use `/trace help` for available commands.',
        response_type: 'ephemeral'
      });
    });
  });

  describe('rate limiting', () => {
    it('should reject command when rate limited', async () => {
      checkRateLimit.mockReturnValueOnce({ 
        allowed: false, 
        message: '⚠️ You are sending too many requests. Please wait 30 seconds.' 
      });

      const mockCommand = createMockCommand({ text: 'status' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(checkRateLimit).toHaveBeenCalledWith(mockCommand);
      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ You are sending too many requests. Please wait 30 seconds.',
        response_type: 'ephemeral'
      });
      expect(handleStatus).not.toHaveBeenCalled();
    });

    it('should use default message when rate limit message not provided', async () => {
      checkRateLimit.mockReturnValueOnce({ allowed: false });

      const mockCommand = createMockCommand({ text: 'status' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ Rate limit exceeded. Please try again later.',
        response_type: 'ephemeral'
      });
    });
  });

  describe('external user blocking', () => {
    it('should block external users with underscore format', async () => {
      validateUserAccess.mockReturnValueOnce('⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.');
      getUserContext.mockReturnValueOnce({
        userId: 'U123_T456',
        teamId: 'T999999',
        isExternal: true,
        channelId: 'C123456'
      });

      const mockCommand = createMockCommand({ 
        text: 'create API issue',
        user_id: 'U123_T456'
      });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(validateUserAccess).toHaveBeenCalledWith(mockCommand);
      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.',
        response_type: 'ephemeral'
      });
      expect(handleInvestigate).not.toHaveBeenCalled();
    });

    it('should block external users with W prefix', async () => {
      validateUserAccess.mockReturnValueOnce('⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.');
      getUserContext.mockReturnValueOnce({
        userId: 'W123456',
        teamId: 'T999999',
        isExternal: true,
        channelId: 'C123456'
      });

      const mockCommand = createMockCommand({ 
        text: 'status',
        user_id: 'W123456'
      });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleStatus).not.toHaveBeenCalled();
    });

    it('should log blocked external user attempts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      validateUserAccess.mockReturnValueOnce('⚠️ This command is not available for external users. Please contact a member of this workspace for assistance.');
      getUserContext.mockReturnValueOnce({
        userId: 'U123_T456',
        teamId: 'T999999',
        isExternal: true,
        channelId: 'C123456'
      });

      const mockCommand = createMockCommand({ 
        text: 'incident',
        user_id: 'U123_T456'
      });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(consoleSpy).toHaveBeenCalledWith('Blocked external user attempt:', expect.objectContaining({
        userId: 'U123_T456',
        teamId: 'T999999',
        isExternal: true,
        command: 'incident',
        timestamp: expect.any(String)
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors', async () => {
      validateCommandContext.mockImplementationOnce(() => {
        throw new Error('Invalid command context');
      });

      const mockCommand = createMockCommand({ text: 'status' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(createSafeErrorMessage).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ An error occurred. Please try again.',
        response_type: 'ephemeral'
      });
    });

    it('should handle handler errors', async () => {
      handleStatus.mockRejectedValueOnce(new Error('Database error'));

      const mockCommand = createMockCommand({ text: 'status' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(createSafeErrorMessage).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRespond).toHaveBeenCalledWith({
        text: '⚠️ An error occurred. Please try again.',
        response_type: 'ephemeral'
      });
    });
  });

  describe('command parsing', () => {
    it('should handle multiple word arguments', async () => {
      const mockCommand = createMockCommand({ text: 'create API response times increasing' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleInvestigate).toHaveBeenCalledWith({
        command: mockCommand,
        respond: mockRespond,
        title: 'API response times increasing',
        client: mockClient
      }, mockPrisma);
    });

    it('should handle extra whitespace', async () => {
      const mockCommand = createMockCommand({ text: '  create    API   issues  ' });
      const mockRespond = createMockRespond();
      const ack = jest.fn();

      await commandHandler({
        command: mockCommand,
        ack,
        respond: mockRespond,
        client: mockClient
      });

      expect(handleInvestigate).toHaveBeenCalledWith({
        command: mockCommand,
        respond: mockRespond,
        title: 'API issues',
        client: mockClient
      }, mockPrisma);
    });
  });
});