import { App } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { handleInvestigate } from './handlers/investigate';
import { handleStatus } from './handlers/status';
import { handleIncident } from './handlers/incident';
import { handleHelp } from './handlers/help';
import { handleList } from './handlers/list';
import { handleClose } from './handlers/close';
import { handleTransfer } from './handlers/transfer';
import { handleResolve } from './handlers/resolve';
import { handleStats } from './handlers/stats';
import { handleExport } from './handlers/export';
import { 
  validateCommandContext, 
  parseCommandArgs, 
  createSafeErrorMessage,
  sanitizeInput 
} from './middleware/validation';
import { checkRateLimit } from './middleware/rateLimit';
import { validateUserAccess, getUserContext } from './middleware/security';

export function registerCommands(app: App, prisma: PrismaClient): void {
  // Handle /trace command
  app.command('/trace', async ({ command, ack, respond, client }) => {
    await ack();

    try {
      // Check user access (block external users)
      const accessError = validateUserAccess(command);
      if (accessError) {
        await respond({
          text: accessError,
          response_type: 'ephemeral'
        });
        
        // Log blocked attempt for security monitoring
        const userContext = getUserContext(command);
        console.log('Blocked external user attempt:', {
          ...userContext,
          command: command.text,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check rate limit
      const rateLimitCheck = checkRateLimit(command);
      if (!rateLimitCheck.allowed) {
        await respond({
          text: rateLimitCheck.message || '⚠️ Rate limit exceeded. Please try again later.',
          response_type: 'ephemeral'
        });
        return;
      }

      // Validate command context
      validateCommandContext(command);
      
      // Parse and validate command arguments
      const { subcommand, args } = parseCommandArgs(command.text);

      switch (subcommand) {
        case 'create':
          await handleInvestigate({
            command,
            respond,
            title: args, // Will be validated in handler
            client
          }, prisma);
          break;


        case 'status':
          await handleStatus({
            command,
            respond
          }, prisma);
          break;

        case 'incident':
          await handleIncident({
            command,
            respond,
            client
          }, prisma);
          break;

        case 'list':
          await handleList({
            respond,
            userId: command.user_id!
          }, prisma);
          break;

        case 'close':
          await handleClose({
            respond,
            channelId: command.channel_id!,
            userId: command.user_id!,
            client
          }, prisma);
          break;

        case 'transfer':
          await handleTransfer({
            respond,
            channelId: command.channel_id!,
            userId: command.user_id!,
            newCommander: args
          }, prisma);
          break;

        case 'resolve':
          await handleResolve({
            respond,
            channelId: command.channel_id!,
            userId: command.user_id!
          }, prisma);
          break;

        case 'stats':
          await handleStats({
            respond
          }, prisma);
          break;

        case 'export':
          await handleExport({
            respond,
            userId: command.user_id!,
            client
          }, prisma);
          break;

        case 'help':
          await handleHelp({
            respond
          });
          break;

        case '':
          // No subcommand - show interactive list instead of help
          await handleList({
            respond,
            userId: command.user_id!
          }, prisma);
          break;

        default:
          // Sanitize subcommand before displaying
          const safeSubcommand = sanitizeInput(subcommand);
          await respond({
            text: `⚠️ Unknown command: \`${safeSubcommand}\`. Use \`/trace help\` for available commands.`,
            response_type: 'ephemeral'
          });
      }
    } catch (error) {
      // Send safe error message to user
      await respond({
        text: createSafeErrorMessage(error),
        response_type: 'ephemeral'
      });
    }
  });
}