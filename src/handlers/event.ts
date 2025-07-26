import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { getCurrentInvestigation } from '../utils/channelState';

interface EventContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleEvent(
  { command, respond }: EventContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Get current investigation for this channel
    const currentInvestigation = await getCurrentInvestigation(prisma, command.channel_id);

    if (!currentInvestigation) {
      await respond({
        text: '⚠️ No active investigation in this channel. Create one with `/trace investigate [title]`',
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
        investigationName: currentInvestigation,
        slackMessageUrl,
        addedBy: command.user_id,
      },
    });

    // Get investigation details
    const investigation = await prisma.investigation.findUnique({
      where: { name: currentInvestigation },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ Event added to investigation *${currentInvestigation}*`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Investigation: ${investigation?.title} • Events: ${investigation?._count.events || 0}`,
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
