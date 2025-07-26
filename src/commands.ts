import { App } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { handleInvestigate } from './handlers/investigate';
import { handleEvent } from './handlers/event';
import { handleStatus } from './handlers/status';
import { handleIncident } from './handlers/incident';
import { handleSwitch } from './handlers/switch';
import { handleHelp } from './handlers/help';
import { 
  validateCommandContext, 
  parseCommandArgs, 
  createSafeErrorMessage,
  sanitizeInput 
} from './middleware/validation';

export function registerCommands(app: App, prisma: PrismaClient): void {
  // Handle /trace command
  app.command('/trace', async ({ command, ack, respond }) => {
    await ack();

    try {
      // Validate command context
      validateCommandContext(command);
      
      // Parse and validate command arguments
      const { subcommand, args } = parseCommandArgs(command.text);

      switch (subcommand) {
        case 'investigate':
          await handleInvestigate({
            command,
            respond,
            title: args // Will be validated in handler
          }, prisma);
          break;

        case 'event':
          await handleEvent({
            command,
            respond
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
            respond
          }, prisma);
          break;

        case 'switch':
          await handleSwitch({
            command,
            respond,
            investigationName: args // Will be validated in handler
          }, prisma);
          break;

        case 'help':
        case '':
          await handleHelp({
            respond
          });
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