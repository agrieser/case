import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface IncidentContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleIncident(
  { command, respond }: IncidentContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Check if already escalated
    const investigation = await prisma.investigation.findUnique({
      where: { channelId: command.channel_id },
      include: { incident: true },
    });

    if (!investigation) {
      await respond({
        text: '⚠️ This channel is not associated with an investigation. Create one with `/trace investigate [title]`',
        response_type: 'ephemeral',
      });
      return;
    }

    if (investigation.incident) {
      await respond({
        text: '⚠️ This investigation has already been escalated to an incident',
        response_type: 'ephemeral',
      });
      return;
    }

    // Create incident
    await prisma.incident.create({
      data: {
        investigationId: investigation.id,
        incidentCommander: command.user_id,
      },
    });

    // Update investigation status
    await prisma.investigation.update({
      where: { id: investigation.id },
      data: { status: 'escalated' },
    });

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🚨 *Investigation escalated to incident*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Investigation:* ${investigation.name}\n*Title:* ${investigation.title}\n*Incident Commander:* <@${command.user_id}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Escalated at ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleIncident:', error instanceof Error ? error.message : 'Unknown error');
    await respond({
      text: '⚠️ Failed to escalate to incident. Please try again.',
      response_type: 'ephemeral',
    });
  }
}
