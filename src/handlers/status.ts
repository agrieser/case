import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { getCurrentInvestigation } from '../utils/channelState';

interface StatusContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleStatus(
  { command, respond }: StatusContext,
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

    // Get investigation details with event count
    const investigation = await prisma.investigation.findUnique({
      where: { name: currentInvestigation },
      include: {
        _count: {
          select: { events: true }
        },
        incident: true
      }
    });

    if (!investigation) {
      await respond({
        text: '⚠️ Investigation not found',
        response_type: 'ephemeral'
      });
      return;
    }

    const timeSinceCreation = Date.now() - investigation.createdAt.getTime();
    const duration = formatDuration(timeSinceCreation);

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Current Investigation: ${investigation.name}*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Title:*\n${investigation.title}`
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${investigation.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Events:*\n${investigation._count.events}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${duration}`
            },
            {
              type: 'mrkdwn',
              text: `*Created by:*\n<@${investigation.createdBy}>`
            },
            {
              type: 'mrkdwn',
              text: `*Incident:*\n${investigation.incident ? '🚨 Escalated' : 'None'}`
            }
          ]
        }
      ]
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleStatus:', error instanceof Error ? error.message : 'Unknown error');
    await respond({
      text: '⚠️ Failed to fetch status. Please try again.',
      response_type: 'ephemeral'
    });
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}