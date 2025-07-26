import { Event, Investigation, Incident } from '@prisma/client';
import { SectionBlock } from '@slack/types';

type EventWithRelations = Event;
type InvestigationWithRelations = Investigation & {
  events?: Event[];
  _count?: { events: number };
};
type IncidentWithRelations = Incident & {
  investigation?: Investigation;
};

export function formatEvent(event: EventWithRelations): SectionBlock {
  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Event ID:*\n${event.id}`,
      },
      {
        type: 'mrkdwn',
        text: `*Added:*\n<!date^${Math.floor(event.addedAt.getTime() / 1000)}^{date_short_pretty} at {time}|${event.addedAt.toISOString()}>`,
      },
      {
        type: 'mrkdwn',
        text: `*Message:*\n<${event.slackMessageUrl}|View in Slack>`,
      },
      {
        type: 'mrkdwn',
        text: `*Added by:*\n<@${event.addedBy}>`,
      },
    ],
  };
}

export function formatInvestigation(investigation: InvestigationWithRelations): SectionBlock {
  const eventCount = investigation._count?.events || investigation.events?.length || 0;

  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Investigation:*\n${investigation.name}`,
      },
      {
        type: 'mrkdwn',
        text: `*Title:*\n${investigation.title}`,
      },
      {
        type: 'mrkdwn',
        text: `*Status:*\n${investigation.status}`,
      },
      {
        type: 'mrkdwn',
        text: `*Events:*\n${eventCount}`,
      },
      {
        type: 'mrkdwn',
        text: `*Created:*\n<!date^${Math.floor(investigation.createdAt.getTime() / 1000)}^{date_short_pretty} at {time}|${investigation.createdAt.toISOString()}>`,
      },
      {
        type: 'mrkdwn',
        text: `*Created by:*\n<@${investigation.createdBy}>`,
      },
    ],
  };
}

export function formatIncident(incident: IncidentWithRelations): SectionBlock {
  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Investigation:*\n${incident.investigationName}`,
      },
      {
        type: 'mrkdwn',
        text: `*Commander:*\n<@${incident.incidentCommander}>`,
      },
      {
        type: 'mrkdwn',
        text: `*Escalated:*\n<!date^${Math.floor(incident.escalatedAt.getTime() / 1000)}^{date_short_pretty} at {time}|${incident.escalatedAt.toISOString()}>`,
      },
    ],
  };
}
