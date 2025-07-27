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
          select: { events: true },
        },
        incident: true,
      },
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

    // Check if there's an unresolved incident
    if (investigation.incident && !investigation.incident.resolvedAt) {
      await respond({
        text: '⚠️ This investigation has an active incident that must be resolved first. Use `/case resolve` to resolve the incident.',
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
        closedBy: userId,
      },
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

    // Send confirmation
    await respond({
      response_type: 'ephemeral',
      text: `📁 Case *${investigation.name}* is now closed. Evidence has been preserved and the channel will be archived.`,
    });
  } catch (error) {
    console.error('Error in handleClose:', error);
    await respond({
      text: '⚠️ Failed to close investigation. Please try again.',
      response_type: 'ephemeral',
    });
  }
}