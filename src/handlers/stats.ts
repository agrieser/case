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
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current state metrics
    const currentInvestigations = await prisma.investigation.count({
      where: {
        status: 'investigating',
      },
    });

    const currentIncidents = await prisma.investigation.count({
      where: {
        status: 'escalated',
        incident: {
          resolvedAt: null,
        },
      },
    });

    // 7-day activity metrics
    const investigationsLast7Days = await prisma.investigation.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const incidentsLast7Days = await prisma.incident.count({
      where: {
        escalatedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Calculate time spent in investigations (7 days)
    const investigationsLast7DaysData = await prisma.investigation.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        createdAt: true,
        closedAt: true,
        status: true,
      },
    });

    let totalInvestigationMinutes = 0;
    investigationsLast7DaysData.forEach(inv => {
      const endTime = inv.closedAt || now;
      const duration = endTime.getTime() - inv.createdAt.getTime();
      totalInvestigationMinutes += duration / (1000 * 60);
    });

    // Calculate time spent in incidents (7 days)
    const incidentsLast7DaysData = await prisma.incident.findMany({
      where: {
        escalatedAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        escalatedAt: true,
        resolvedAt: true,
      },
    });

    let totalIncidentMinutes = 0;
    incidentsLast7DaysData.forEach(inc => {
      const endTime = inc.resolvedAt || now;
      const duration = endTime.getTime() - inc.escalatedAt.getTime();
      totalIncidentMinutes += duration / (1000 * 60);
    });

    // Calculate average close times (all time for better data)
    const closedInvestigations = await prisma.investigation.findMany({
      where: {
        closedAt: { not: null },
      },
      select: {
        createdAt: true,
        closedAt: true,
      },
    });

    let avgInvestigationCloseMinutes = 0;
    if (closedInvestigations.length > 0) {
      const totalMinutes = closedInvestigations.reduce((sum, inv) => {
        const duration = inv.closedAt!.getTime() - inv.createdAt.getTime();
        return sum + (duration / (1000 * 60));
      }, 0);
      avgInvestigationCloseMinutes = Math.round(totalMinutes / closedInvestigations.length);
    }

    const resolvedIncidents = await prisma.incident.findMany({
      where: { resolvedAt: { not: null } },
      select: {
        escalatedAt: true,
        resolvedAt: true,
      },
    });

    let avgIncidentResolveMinutes = 0;
    if (resolvedIncidents.length > 0) {
      const totalMinutes = resolvedIncidents.reduce((sum, inc) => {
        const duration = inc.resolvedAt!.getTime() - inc.escalatedAt.getTime();
        return sum + (duration / (1000 * 60));
      }, 0);
      avgIncidentResolveMinutes = Math.round(totalMinutes / resolvedIncidents.length);
    }

    // Format time displays
    const formatMinutes = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
      }
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    // Format the response with operational focus
    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Operational Dashboard',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Current Status*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `🔍 *Active Investigations:*\n${currentInvestigations}`,
            },
            {
              type: 'mrkdwn',
              text: `🚨 *Active Incidents:*\n${currentIncidents}`,
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*7-Day Activity*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Cases Opened:*\n${investigationsLast7Days}`,
            },
            {
              type: 'mrkdwn',
              text: `*Incidents Declared:*\n${incidentsLast7Days}`,
            },
            {
              type: 'mrkdwn',
              text: `*Investigation Time:*\n${formatMinutes(totalInvestigationMinutes)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Incident Time:*\n${formatMinutes(totalIncidentMinutes)}`,
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Average Resolution Times*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Investigation Close:*\n${closedInvestigations.length > 0 ? formatMinutes(avgInvestigationCloseMinutes) : 'No data'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Incident Resolve:*\n${resolvedIncidents.length > 0 ? formatMinutes(avgIncidentResolveMinutes) : 'No data'}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Updated ${now.toLocaleTimeString()}_`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error in handleStats:', error);
    await respond({
      text: '⚠️ Failed to generate statistics. Please try again.',
      response_type: 'ephemeral',
    });
  }
}