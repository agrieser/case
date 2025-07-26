import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { setCurrentInvestigation } from '../utils/channelState';
import { validateInvestigationName, createSafeErrorMessage, sanitizeInput } from '../middleware/validation';

interface SwitchContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
  investigationName: string;
}

export async function handleSwitch(
  { command, respond, investigationName }: SwitchContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Validate investigation name format
    const validatedName = validateInvestigationName(investigationName);

    // Check if investigation exists
    const investigation = await prisma.investigation.findUnique({
      where: { name: validatedName },
      include: {
        _count: {
          select: { events: true }
        }
      }
    });

    if (!investigation) {
      await respond({
        text: `⚠️ Investigation *${validatedName}* not found`,
        response_type: 'ephemeral'
      });
      return;
    }

    // Set as current investigation for this channel
    await setCurrentInvestigation(prisma, command.channel_id, validatedName);

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ Switched to investigation: *${validatedName}*`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            // Sanitize title before display
            text: `*Title:* ${sanitizeInput(investigation.title)}\n*Status:* ${investigation.status}\n*Events:* ${investigation._count.events}`
          }
        }
      ]
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleSwitch:', error instanceof Error ? error.message : 'Unknown error');
    
    await respond({
      text: createSafeErrorMessage(error),
      response_type: 'ephemeral'
    });
  }
}