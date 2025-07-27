import { RespondFn } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

interface StatsContext {
  respond: RespondFn;
}

export async function handleStats(
  { respond }: StatsContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Get all investigations
    const totalInvestigations = await prisma.investigation.count();
    
    // Get active investigations (not closed)
    const activeInvestigations = await prisma.investigation.count({
      where: { status: { not: 'closed' } }
    });
    
    // Get escalated investigations
    const escalatedCount = await prisma.incident.count();
    
    // Calculate escalation rate
    const escalationRate = totalInvestigations > 0 
      ? ((escalatedCount / totalInvestigations) * 100).toFixed(1)
      : '0.0';
    
    // Get average resolution time for incidents
    const resolvedIncidents = await prisma.incident.findMany({
      where: { resolvedAt: { not: null } },
      select: {
        escalatedAt: true,
        resolvedAt: true
      }
    });
    
    let avgResolutionMinutes = 0;
    if (resolvedIncidents.length > 0) {
      const totalMinutes = resolvedIncidents.reduce((sum, inc) => {
        const duration = inc.resolvedAt!.getTime() - inc.escalatedAt.getTime();
        return sum + (duration / (1000 * 60)); // Convert to minutes
      }, 0);
      avgResolutionMinutes = Math.round(totalMinutes / resolvedIncidents.length);
    }
    
    const avgHours = Math.floor(avgResolutionMinutes / 60);
    const avgMinutes = avgResolutionMinutes % 60;
    const avgResolutionTime = avgHours > 0 ? `${avgHours}h ${avgMinutes}m` : `${avgMinutes}m`;
    
    // Get total events collected
    const totalEvents = await prisma.event.count();
    
    // Get most active investigators (by investigations created)
    const topInvestigators = await prisma.investigation.groupBy({
      by: ['createdBy'],
      _count: { createdBy: true },
      orderBy: { _count: { createdBy: 'desc' } },
      take: 3
    });
    
    // Get most active incident commanders
    const topCommanders = await prisma.incident.groupBy({
      by: ['incidentCommander'],
      _count: { incidentCommander: true },
      orderBy: { _count: { incidentCommander: 'desc' } },
      take: 3
    });
    
    // Format the response
    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Trace Statistics',
            emoji: true
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Investigations:*\n${totalInvestigations} (${activeInvestigations} active)`
            },
            {
              type: 'mrkdwn',
              text: `*Escalation Rate:*\n${escalatedCount} incidents (${escalationRate}%)`
            },
            {
              type: 'mrkdwn',
              text: `*Avg Resolution Time:*\n${avgResolutionTime}`
            },
            {
              type: 'mrkdwn',
              text: `*Events Collected:*\n${totalEvents} total`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🏆 Top Investigators:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: topInvestigators.length > 0
              ? topInvestigators.map((inv, i) => 
                  `${i + 1}. <@${inv.createdBy}> - ${inv._count.createdBy} investigations`
                ).join('\n')
              : '_No investigations yet_'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🚨 Top Incident Commanders:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: topCommanders.length > 0
              ? topCommanders.map((cmd, i) => 
                  `${i + 1}. <@${cmd.incidentCommander}> - ${cmd._count.incidentCommander} incidents`
                ).join('\n')
              : '_No incidents yet_'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '_All-time statistics. Time-based filtering coming soon._'
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error in handleStats:', error);
    await respond({
      text: '⚠️ Failed to generate statistics. Please try again.',
      response_type: 'ephemeral',
    });
  }
}