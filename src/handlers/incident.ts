import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';
import { pagerDutyService } from '../services/pagerduty';

interface IncidentContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
  client: WebClient;
}

export async function handleIncident(
  { command, respond, client }: IncidentContext,
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
        text: '⚠️ The `/case incident` command can only be used within investigation channels.',
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

    if (investigation.status === 'closed') {
      await respond({
        text: '⚠️ This investigation is closed and cannot be escalated to an incident',
        response_type: 'ephemeral',
      });
      return;
    }

    // Trigger PagerDuty incident if enabled
    let pagerDutyIncidentKey: string | null = null;
    if (pagerDutyService.isEnabled()) {
      try {
        // Get workspace URL from team info if available
        let slackWorkspaceUrl: string | undefined;
        try {
          const teamInfo = await client.team.info();
          slackWorkspaceUrl = teamInfo.team?.url;
        } catch (error) {
          // If we can't get team info, continue without the URL
          console.error('Failed to get team info for workspace URL:', error);
        }
        pagerDutyIncidentKey = await pagerDutyService.triggerIncident(
          investigation.id,
          investigation.name,
          investigation.title,
          command.channel_id,
          command.user_id,
          slackWorkspaceUrl
        );
      } catch (error) {
        // Log but don't fail the incident escalation if PagerDuty fails
        console.error('Failed to trigger PagerDuty incident:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Create incident
    await prisma.incident.create({
      data: {
        investigationId: investigation.id,
        incidentCommander: command.user_id,
        pagerDutyIncidentKey,
      },
    });

    // Update investigation status
    await prisma.investigation.update({
      where: { id: investigation.id },
      data: { status: 'escalated' },
    });

    // Add incident response team if configured
    const incidentResponseGroup = process.env.INCIDENT_RESPONSE_GROUP_ID;
    if (incidentResponseGroup) {
      try {
        // Invite the user group directly to the channel
        // Slack accepts user group IDs (S...) in the users parameter
        await client.conversations.invite({
          channel: command.channel_id,
          users: incidentResponseGroup,
        });
      } catch (error) {
        // Log but don't fail the incident escalation if group invite fails
        console.error('Failed to add incident response team:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Post to issues channel as a reply to the original message
    const issuesChannelId = process.env.ISSUES_CHANNEL_ID;
    if (issuesChannelId && investigation.issuesMessageTs) {
      try {
        await client.chat.postMessage({
          channel: issuesChannelId,
          thread_ts: investigation.issuesMessageTs,
          reply_broadcast: true, // Also send to channel
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '🚨 *Escalated to incident*',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Incident Commander:* <@${command.user_id}>\n*Channel:* <#${command.channel_id}>`,
              },
            },
          ],
        });
      } catch (error) {
        console.error('Failed to post incident escalation to issues channel:', error);
      }
    }

    await respond({
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🚨 *Case escalated to active incident*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Investigation:* ${investigation.name}\n*Title:* ${investigation.title}\n*Incident Commander:* <@${command.user_id}>${pagerDutyIncidentKey ? '\n*PagerDuty:* ✅ Incident triggered' : ''}`,
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
