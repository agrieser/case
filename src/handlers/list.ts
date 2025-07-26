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
        }
      }
    });

    if (investigations.length === 0) {
      await respond({
        text: 'No active investigations found. Create one with `/trace investigate [title]`',
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
      
      return `${index + 1}. *${inv.name}*\n   • Title: ${inv.title}\n   • Channel: <#${inv.channelId}>\n   • Events: ${inv._count.events}\n   • Duration: ${durationText}\n   • Created by: <@${inv.createdBy}>`;
    }).join('\n\n');

    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Active Trace Investigations'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Found *${investigations.length} active investigation${investigations.length !== 1 ? 's' : ''}*:`
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