import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { getCurrentInvestigation } from '../utils/channelState';

interface IncidentContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleIncident(
  { command, respond }: IncidentContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Get current investigation for this channel
    const currentInvestigation = await getCurrentInvestigation(prisma, command.channel_id);
    
    if (!currentInvestigation) {
      await respond({
        text: '⚠️ No active investigation in this channel. Create one with `/trace investigate [title]`',
        response_type: 'ephemeral'
      });
      return;
    }

    // Check if already escalated
    const investigation = await prisma.investigation.findUnique({
      where: { name: currentInvestigation },
      include: { incident: true }
    });

    if (!investigation) {
      await respond({
        text: '⚠️ Investigation not found',
        response_type: 'ephemeral'
      });
      return;
    }

    if (investigation.incident) {
      await respond({
        text: '⚠️ This investigation has already been escalated to an incident',
        response_type: 'ephemeral'
      });
      return;
    }

    // Create incident
    await prisma.incident.create({
      data: {
        investigationName: currentInvestigation,
        incidentCommander: command.user_id
      }
    });

    // Update investigation status
    await prisma.investigation.update({
      where: { name: currentInvestigation },
      data: { status: 'escalated' }
    });

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🚨 *Investigation escalated to incident*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Investigation:* ${currentInvestigation}\n*Title:* ${investigation.title}\n*Incident Commander:* <@${command.user_id}>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Escalated at ${new Date().toISOString()}`
            }
          ]
        }
      ]
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleIncident:', error instanceof Error ? error.message : 'Unknown error');
    await respond({
      text: '⚠️ Failed to escalate to incident. Please try again.',
      response_type: 'ephemeral'
    });
  }
}