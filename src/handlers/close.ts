import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

interface CloseContext {
  respond: RespondFn;
  channelId: string;
  userId: string;
  client: WebClient;
}

export async function handleClose(
  { respond, channelId, userId, client }: CloseContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Find the investigation for this channel
    const investigation = await prisma.investigation.findUnique({
      where: { channelId },
      include: {
        _count: {
          select: { events: true }
        }
      }
    });

    if (!investigation) {
      await respond({
        text: '⚠️ This command only works in investigation channels.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Check if already closed
    if (investigation.status === 'closed') {
      await respond({
        text: '⚠️ This investigation is already closed.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Update investigation status to closed
    await prisma.investigation.update({
      where: { id: investigation.id },
      data: { 
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId
      }
    });

    // Archive the Slack channel
    try {
      await client.conversations.archive({
        channel: channelId,
      });
    } catch (error: any) {
      console.error('Failed to archive channel:', error?.data?.error || error);
      // Continue even if archive fails - the investigation is still closed
    }

    // Post to #h-potential-issues about the closure
    const potentialIssuesChannelId = process.env.POTENTIAL_ISSUES_CHANNEL_ID;
    if (potentialIssuesChannelId) {
      try {
        const duration = Math.floor((Date.now() - investigation.createdAt.getTime()) / (1000 * 60));
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        await client.chat.postMessage({
          channel: potentialIssuesChannelId,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔒 Investigation closed: *${investigation.name}*`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Title:* ${investigation.title}\n*Duration:* ${durationText}\n*Events collected:* ${investigation._count.events}\n*Closed by:* <@${userId}>`,
              },
            },
          ],
        });
      } catch (error) {
        console.error('Failed to post closure to potential issues channel:', error);
      }
    }

    // Send confirmation
    await respond({
      response_type: 'ephemeral',
      text: `✅ Investigation *${investigation.name}* has been closed and the channel will be archived.`,
    });
  } catch (error) {
    console.error('Error in handleClose:', error);
    await respond({
      text: '⚠️ Failed to close investigation. Please try again.',
      response_type: 'ephemeral',
    });
  }
}