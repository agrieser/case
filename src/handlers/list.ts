import { RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface ListContext {
  respond: RespondFn;
  userId: string;
}

export async function handleList(
  { respond }: ListContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Get all active investigations (exclude closed)
    const investigations = await prisma.investigation.findMany({
      where: {
        status: {
          not: 'closed'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 25, // Slack select menu limit
      include: {
        _count: {
          select: { events: true }
        },
        incident: true
      }
    });

    if (investigations.length === 0) {
      await respond({
        text: 'No active investigations found. Open one with `/case open [title]`',
        response_type: 'ephemeral',
      });
      return;
    }

    // Build the list of investigations
    const investigationsList = investigations.map((inv, index) => {
      const duration = Math.floor((Date.now() - inv.createdAt.getTime()) / (1000 * 60));
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      // Add status indicator
      let statusEmoji = '🔍';
      
      if (inv.status === 'escalated' && inv.incident) {
        if (inv.incident.resolvedAt) {
          statusEmoji = '✅';
        } else {
          statusEmoji = '🚨';
        }
      }
      
      let entry = `${index + 1}. ${statusEmoji} *${inv.name}*\n`;
      entry += `   • Title: ${inv.title}\n`;
      entry += `   • Channel: <#${inv.channelId}>\n`;
      entry += `   • Events: ${inv._count.events}\n`;
      entry += `   • Duration: ${durationText}\n`;
      entry += `   • Created by: <@${inv.createdBy}>`;
      
      // Add incident commander if escalated
      if (inv.incident) {
        entry += `\n   • Incident Commander: <@${inv.incident.incidentCommander}>`;
      }
      
      return entry;
    }).join('\n\n');

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Active Case Files'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Found *${investigations.length} open case${investigations.length !== 1 ? 's' : ''}*:`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: investigationsList
          }
        }
      ]
    });
  } catch (error) {
    console.error('Error in handleList:', error);
    await respond({
      text: '⚠️ Failed to list investigations. Please try again.',
      response_type: 'ephemeral',
    });
  }
}