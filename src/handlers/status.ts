import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { pagerDutyService } from '../services/pagerduty';

interface StatusContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
}

export async function handleStatus(
  { command, respond }: StatusContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Get investigation details with event count
    const investigation = await prisma.investigation.findUnique({
      where: { channelId: command.channel_id },
      include: {
        _count: {
          select: { events: true },
        },
        incident: true,
      },
    });

    if (!investigation) {
      await respond({
        text: '⚠️ The `/case status` command can only be used within investigation channels.',
        response_type: 'ephemeral',
      });
      return;
    }

    const timeSinceCreation = Date.now() - investigation.createdAt.getTime();
    const duration = formatDuration(timeSinceCreation);

    // Build fields array
    const fields = [
      {
        type: 'mrkdwn' as const,
        text: `*Title:*\n${investigation.title}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Status:*\n${investigation.status}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Evidence Collected:*\n${investigation._count.events} pieces`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Duration:*\n${duration}`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Created by:*\n<@${investigation.createdBy}>`,
      },
      {
        type: 'mrkdwn' as const,
        text: `*Incident:*\n${getIncidentStatus(investigation.incident)}`,
      },
    ];

    // Add PagerDuty status if enabled and incident exists
    if (pagerDutyService.isEnabled() && investigation.incident) {
      fields.push({
        type: 'mrkdwn' as const,
        text: `*PagerDuty:*\n${investigation.incident.pagerDutyIncidentKey ? '✅ Integrated' : '❌ Not integrated'}`,
      });
    }

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Case File: ${investigation.name}*`,
          },
        },
        {
          type: 'section',
          fields,
        },
      ],
    });
  } catch (error) {
    // Log error safely
    console.error('Error in handleStatus:', error instanceof Error ? error.message : 'Unknown error');
    await respond({
      text: '⚠️ Failed to fetch status. Please try again.',
      response_type: 'ephemeral',
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

function getIncidentStatus(incident: any): string {
  if (!incident) {
    return 'None';
  }

  if (incident.resolvedAt) {
    return '✅ Resolved';
  }

  return '🚨 Active';
}
