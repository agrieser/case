import { SlackCommandMiddlewareArgs, RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';
import { generateUniqueName, generateChannelName } from '../utils/nameGenerator';
import { validateTitle, createSafeErrorMessage } from '../middleware/validation';

interface InvestigateContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
  title: string;
  client: WebClient;
}

export async function handleInvestigate(
  { command, respond, title, client }: InvestigateContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Validate required fields
    if (!command.user_id) {
      throw new Error('User ID is required');
    }
    const userId = command.user_id;

    // Validate and sanitize title
    const validatedTitle = validateTitle(title);

    // Generate unique name based on title
    const name = await generateUniqueName(validatedTitle, async (n) => {
      const existing = await prisma.investigation.findUnique({
        where: { name: n },
      });
      return !!existing;
    });

    // Generate channel name based on title
    const channelName = generateChannelName(validatedTitle);

    // Create Slack channel for the investigation
    const channelResult = await client.conversations.create({
      name: channelName,
      is_private: false,
    });

    if (!channelResult.ok || !channelResult.channel || !channelResult.channel.id) {
      throw new Error('Failed to create Slack channel');
    }

    const channelId = channelResult.channel.id;

    // Join the channel as the bot first
    try {
      await client.conversations.join({
        channel: channelId,
      });
    } catch (error: any) {
      console.error('Bot failed to join channel:', error?.data?.error || error);
    }

    // Set the channel topic to the investigation title
    // For channel topics, we want the original title without HTML escaping
    const topicTitle = title.trim()
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:\s*/gi, '')
      .substring(0, 250); // Slack topic limit
    
    try {
      await client.conversations.setTopic({
        channel: channelId,
        topic: `🔍 ${topicTitle}`,
      });
    } catch (error: any) {
      console.error('Failed to set channel topic:', error?.data?.error || error);
    }

    // Invite the user who created the investigation to the channel
    try {
      await client.conversations.invite({
        channel: channelId,
        users: userId,
      });
    } catch (error: any) {
      // Only log if it's not an already_in_channel error
      if (error?.data?.error !== 'already_in_channel') {
        console.error('Failed to add user to channel:', error?.data?.error || error);
      }
    }

    // Get the issues channel ID from environment variable
    const issuesChannelId = process.env.ISSUES_CHANNEL_ID;

    if (!issuesChannelId) {
      throw new Error('ISSUES_CHANNEL_ID environment variable not set');
    }

    // Try to join the channel first (in case bot isn't already in it)
    try {
      await client.conversations.join({
        channel: issuesChannelId,
      });
    } catch (error: any) {
      // Log the error but continue - we'll get a better error from postMessage if needed
      console.error('Failed to join issues channel:', error?.data?.error || error);

      // If it's a missing_scope error, we need to add channels:join
      if (error?.data?.error === 'missing_scope') {
        throw new Error(`Bot missing required scope to join channels. Error: ${JSON.stringify(error.data)}`);
      }
    }

    // Post to issues channel first to get the message timestamp
    const issuesMessage = await client.chat.postMessage({
      channel: issuesChannelId,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔍 New case opened: *${name}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Title:* ${validatedTitle}\n*Channel:* <#${channelId}>\n*Created by:* <@${userId}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Head to <#${channelId}> to collaborate on this case.`,
            },
          ],
        },
      ],
    });

    if (!issuesMessage.ts) {
      throw new Error('Failed to get message timestamp from issues channel');
    }

    // Create investigation with the message timestamp
    await prisma.investigation.create({
      data: {
        name,
        title: validatedTitle,
        channelId,
        createdBy: userId,
        issuesMessageTs: issuesMessage.ts,
      },
    });

    // Post initial message to the investigation channel with next steps
    await client.chat.postMessage({
      channel: channelId,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔍 Investigation: ${name}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Title:* ${validatedTitle}\n*Created by:* <@${userId}>\n*Status:* Investigating`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📋 Next Steps:*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '1. *Collect Evidence* 📎\n   Right-click any message → "Collect Evidence" to add context\n\n2. *If Service Impact* 🚨\n   Escalate with `/case incident`\n\n3. *When Resolved* ✅\n   Close with `/case close`',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '💡 All commands work only in this investigation channel',
            },
          ],
        },
      ],
    });

    // Send ephemeral confirmation to the user
    await respond({
      response_type: 'ephemeral',
      text: `✅ Investigation *${name}* created successfully!\n\nChannel: <#${channelId}>\nSummary posted to: <#${issuesChannelId}>`,
    });
  } catch (error) {
    // Log error safely without exposing sensitive details
    console.error('Error in handleInvestigate:', error instanceof Error ? error.message : 'Unknown error');

    await respond({
      text: createSafeErrorMessage(error),
      response_type: 'ephemeral',
    });
  }
}
