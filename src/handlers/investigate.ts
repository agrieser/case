import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { generateUniqueName } from '../utils/nameGenerator';
import { setCurrentInvestigation } from '../utils/channelState';
import { validateTitle, createSafeErrorMessage } from '../middleware/validation';

interface InvestigateContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
  title: string;
}

export async function handleInvestigate(
  { command, respond, title }: InvestigateContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Validate and sanitize title
    const validatedTitle = validateTitle(title);

    // Generate unique name based on title
    const name = await generateUniqueName(validatedTitle, async (n) => {
      const existing = await prisma.investigation.findUnique({
        where: { name: n }
      });
      return !!existing;
    });

    // Create investigation
    await prisma.investigation.create({
      data: {
        name,
        title: validatedTitle,
        channelId: command.channel_id,
        createdBy: command.user_id
      }
    });

    // Set as current investigation for this channel
    await setCurrentInvestigation(prisma, command.channel_id, name);

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ Investigation created: *${name}*`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            // Title is already sanitized, safe to display
            text: `*Title:* ${validatedTitle}\n*Channel:* <#${command.channel_id}>\n*Created by:* <@${command.user_id}>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Reply to any message with \`/trace event\` to add it to this investigation`
            }
          ]
        }
      ]
    });
  } catch (error) {
    // Log error safely without exposing sensitive details
    console.error('Error in handleInvestigate:', error instanceof Error ? error.message : 'Unknown error');
    
    await respond({
      text: createSafeErrorMessage(error),
      response_type: 'ephemeral'
    });
  }
}