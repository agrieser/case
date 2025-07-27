import { RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface TransferContext {
  respond: RespondFn;
  channelId: string;
  userId: string;
  newCommander: string;
}

export async function handleTransfer(
  { respond, channelId, userId, newCommander }: TransferContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Find the investigation for this channel
    const investigation = await prisma.investigation.findUnique({
      where: { channelId },
      include: { incident: true },
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
        text: '⚠️ This investigation has not been escalated to an incident yet. Use `/case incident` first.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Extract user ID from mention format <@U123456>
    const userIdMatch = newCommander.match(/^<@([A-Z0-9]+)>$/);
    if (!userIdMatch) {
      await respond({
        text: '⚠️ Please mention a user to transfer incident commander role to (e.g., `/case transfer @username`).',
        response_type: 'ephemeral',
      });
      return;
    }
    const newCommanderId = userIdMatch[1];

    // Check if already the incident commander
    if (investigation.incident.incidentCommander === newCommanderId) {
      await respond({
        text: `⚠️ <@${newCommanderId}> is already the incident commander.`,
        response_type: 'ephemeral',
      });
      return;
    }

    const previousCommander = investigation.incident.incidentCommander;

    // Update incident commander
    await prisma.incident.update({
      where: { id: investigation.incident.id },
      data: { 
        incidentCommander: newCommanderId,
      },
    });

    // Send confirmation
    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔄 Incident commander role transferred',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*From:* <@${previousCommander}>\n*To:* <@${newCommanderId}>\n*By:* <@${userId}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Incident: *${investigation.name}*`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error in handleTransfer:', error);
    await respond({
      text: '⚠️ Failed to transfer incident commander role. Please try again.',
      response_type: 'ephemeral',
    });
  }
}