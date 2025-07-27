import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface EventContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleEvent(
  { command, respond }: EventContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Find investigation by channel ID
    const investigation = await prisma.investigation.findUnique({
      where: { channelId: command.channel_id },
    });

    if (!investigation) {
      await respond({
        text: '⚠️ This channel is not associated with an investigation. Open one with `/case open [title]`',
        response_type: 'ephemeral',
      });
      return;
    }

    // Get the message link from the parent message (when used as a reply)
    // For now, we'll construct a placeholder URL - in production, this would come from the message event
    const messageTs = command.trigger_id.split('.')[0]; // Extract timestamp from trigger_id
    const slackMessageUrl = `https://${command.team_domain}.slack.com/archives/${command.channel_id}/p${messageTs}`;

    // Create event
    await prisma.event.create({
      data: {
        investigationId: investigation.id,
        slackMessageUrl,
        addedBy: command.user_id,
      },
    });

    // Get updated event count
    const eventCount = await prisma.event.count({
      where: { investigationId: investigation.id },
    });

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🗜️ Evidence logged in case *${investigation.name}*`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Case: ${investigation.title} • Evidence count: ${eventCount}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleEvent:', error instanceof Error ? error.message : 'Unknown error');
    await respond({
      text: '⚠️ Failed to add event. Please try again.',
      response_type: 'ephemeral',
    });
  }
}
