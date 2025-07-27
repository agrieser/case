import { RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface ResolveContext {
  respond: RespondFn;
  channelId: string;
  userId: string;
}

export async function handleResolve(
  { respond, channelId, userId }: ResolveContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Find the investigation for this channel
    const investigation = await prisma.investigation.findUnique({
      where: { channelId },
      include: {
        incident: true,
        _count: {
          select: { events: true },
        },
      },
    });

    if (!investigation) {
      await respond({
        text: '⚠️ This command only works in investigation channels.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Check if investigation has been escalated to incident
    if (!investigation.incident) {
      await respond({
        text: '⚠️ This investigation has not been escalated to an incident. Only incidents can be resolved.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Check if already resolved
    if (investigation.incident.resolvedAt) {
      await respond({
        text: '⚠️ This incident has already been resolved.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Calculate incident duration
    const duration = Math.floor((Date.now() - investigation.incident.escalatedAt.getTime()) / (1000 * 60));
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // Update incident as resolved
    await prisma.incident.update({
      where: { id: investigation.incident.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });

    // Post resolution message in channel
    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ Incident *${investigation.name}* has been resolved!`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Incident Duration:* ${durationText}\n*Resolved by:* <@${userId}>\n*Incident Commander:* <@${investigation.incident.incidentCommander}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'The investigation remains open for follow-up analysis and post-mortem. Use `/case close` when all follow-up work is complete.',
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error in handleResolve:', error);
    await respond({
      text: '⚠️ Failed to resolve incident. Please try again.',
      response_type: 'ephemeral',
    });
  }
}