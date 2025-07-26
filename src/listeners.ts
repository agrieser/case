import { App } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { isExternalUser } from './middleware/security';

export function registerListeners(app: App, prisma: PrismaClient): void {
  // Handle message shortcut to add event to investigation
  app.shortcut('add_event_to_investigation', async ({ shortcut, ack, client }) => {
    await ack();

    try {
      if (shortcut.type !== 'message_action') {
        throw new Error('Invalid shortcut type');
      }

      const channelId = shortcut.channel.id;
      const messageTs = shortcut.message.ts;
      const userId = shortcut.user.id;
      const triggerId = shortcut.trigger_id;
      const teamId = shortcut.team?.id || '';
      const enterpriseId = shortcut.enterprise?.id;

      // Check if user is external
      if (isExternalUser(userId, teamId, enterpriseId)) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '⚠️ This action is not available for external users.',
        });
        
        console.log('Blocked external user shortcut attempt:', {
          userId,
          teamId,
          enterpriseId,
          isExternal: true,
          action: 'add_event_to_investigation',
          timestamp: new Date().toISOString()
        });
        return;
      }

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
      });

      if (investigations.length === 0) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '⚠️ No active investigations found. Create one with `/trace create [title]`',
        });
        return;
      }

      // If only one investigation, add the event directly
      if (investigations.length === 1) {
        const investigation = investigations[0];
        await addEventToInvestigation(client, investigation, channelId, messageTs, userId, shortcut.team?.domain);
        return;
      }

      // Multiple investigations - show a modal to select
      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          callback_id: 'select_investigation_for_event',
          private_metadata: JSON.stringify({
            channelId,
            messageTs,
            teamDomain: shortcut.team?.domain || 'workspace'
          }),
          title: {
            type: 'plain_text',
            text: 'Add Event'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Select the investigation to add this message to:'
              }
            },
            {
              type: 'input',
              block_id: 'investigation_select',
              label: {
                type: 'plain_text',
                text: 'Investigation'
              },
              element: {
                type: 'static_select',
                action_id: 'selected_investigation',
                placeholder: {
                  type: 'plain_text',
                  text: 'Choose an investigation'
                },
                options: investigations.map(inv => ({
                  text: {
                    type: 'plain_text',
                    text: `${inv.name} - ${inv.title.substring(0, 30)}${inv.title.length > 30 ? '...' : ''}`
                  },
                  value: inv.id
                }))
              }
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Add Event'
          }
        }
      });
    } catch (error) {
      console.error('Error handling add_event_to_investigation:', error);
      
      if (shortcut.type === 'message_action') {
        await client.chat.postEphemeral({
          channel: shortcut.channel.id,
          user: shortcut.user.id,
          text: '⚠️ Failed to add event. Please try again.',
        });
      }
    }
  });

  // Helper function to add event to investigation
  async function addEventToInvestigation(
    client: any,
    investigation: any,
    channelId: string,
    messageTs: string,
    userId: string,
    teamDomain?: string
  ) {
    // Construct the message link
    const domain = teamDomain || 'workspace';
    const slackMessageUrl = `https://${domain}.slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`;

    // Create event
    await prisma.event.create({
      data: {
        investigationId: investigation.id,
        slackMessageUrl,
        addedBy: userId,
      },
    });

    // Get updated event count
    const eventCount = await prisma.event.count({
      where: { investigationId: investigation.id },
    });

    // Post confirmation to the investigation channel
    await client.chat.postMessage({
      channel: investigation.channelId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ New event added to investigation *${investigation.name}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📎 <${slackMessageUrl}|View message> from <#${channelId}>`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Added by: <@${userId}> • Total events: ${eventCount}`,
            },
          ],
        },
      ],
    });

    // Also confirm to the user in the original channel
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: `✅ Event added to investigation *${investigation.name}* in <#${investigation.channelId}>`,
    });
  }

  // Handle modal submission
  app.view('select_investigation_for_event', async ({ ack, view, client, body }) => {
    await ack();

    try {
      const userId = body.user.id;
      const metadata = JSON.parse(view.private_metadata);
      const selectedInvestigationId = view.state.values.investigation_select.selected_investigation.selected_option?.value;

      if (!selectedInvestigationId) {
        throw new Error('No investigation selected');
      }

      // Get the selected investigation
      const investigation = await prisma.investigation.findUnique({
        where: { id: selectedInvestigationId }
      });

      if (!investigation) {
        throw new Error('Investigation not found');
      }

      // Add the event
      await addEventToInvestigation(
        client,
        investigation,
        metadata.channelId,
        metadata.messageTs,
        userId,
        metadata.teamDomain
      );
    } catch (error) {
      console.error('Error handling investigation selection:', error);
    }
  });

  // Handle create investigation button
  app.action('create_investigation_button', async ({ ack, client, body }) => {
    await ack();

    try {
      // Check if we have trigger_id (we should for button clicks)
      const triggerId = (body as any).trigger_id;
      if (!triggerId) {
        console.error('No trigger_id in button action');
        return;
      }

      // Open a modal to create new investigation
      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          callback_id: 'create_investigation_modal',
          title: {
            type: 'plain_text',
            text: 'Create Investigation'
          },
          blocks: [
            {
              type: 'input',
              block_id: 'title_block',
              label: {
                type: 'plain_text',
                text: 'Investigation Title'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'title_input',
                placeholder: {
                  type: 'plain_text',
                  text: 'e.g., API response times increasing'
                }
              }
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Create'
          }
        }
      });
    } catch (error) {
      console.error('Error opening create investigation modal:', error);
    }
  });

  // Handle help button
  app.action('show_help_button', async ({ ack, respond }) => {
    await ack();
    
    const { handleHelp } = await import('./handlers/help');
    await handleHelp({ respond });
  });

  // Handle investigation selection from /trace list dropdown
  app.action('investigation_selected', async ({ action, ack, respond, body }) => {
    await ack();

    try {
      // Extract the investigation ID from the action
      if (action.type !== 'static_select') {
        throw new Error('Invalid action type');
      }

      const investigationId = action.selected_option.value;

      // Fetch investigation details
      const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        include: {
          _count: {
            select: { events: true }
          },
          incident: true
        }
      });

      if (!investigation) {
        await respond({
          text: '⚠️ Investigation not found.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Calculate duration
      const now = new Date();
      const duration = Math.floor((now.getTime() - investigation.createdAt.getTime()) / 1000 / 60);
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // Build response blocks
      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: investigation.name,
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
              text: `*Status:*\n${investigation.status === 'escalated' ? '🚨 Escalated' : '🔍 Investigating'}`
            },
            {
              type: 'mrkdwn',
              text: `*Events:*\n${investigation._count.events}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${durationText}`
            }
          ]
        }
      ];

      // Add incident info if escalated
      if (investigation.incident) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Incident Commander:* <@${investigation.incident.incidentCommander}>`
          }
        });
      }

      // Add channel link button
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Go to Channel'
            },
            url: `slack://channel?team=${body.team?.id}&id=${investigation.channelId}`,
            action_id: 'go_to_channel'
          }
        ]
      });

      await respond({
        response_type: 'ephemeral',
        blocks: blocks
      });
    } catch (error) {
      console.error('Error handling investigation selection:', error);
      await respond({
        text: '⚠️ Failed to fetch investigation details.',
        response_type: 'ephemeral',
      });
    }
  });
}