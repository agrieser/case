import { RespondFn } from '@slack/bolt';

interface HelpContext {
  respond: RespondFn;
}

export async function handleHelp({ respond }: HelpContext): Promise<void> {
  await respond({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔍 Trace - Incident Management',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• `/trace investigate [title]` - Create new investigation and dedicated channel\n' +
                '• `/trace event` - Add replied message as event to this channel\'s investigation\n' +
                '• `/trace status` - Show investigation status for this channel\n' +
                '• `/trace incident` - Escalate this investigation to incident\n' +
                '• `/trace help` - Show this help message',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '*Note:* Use `/trace event` as a reply to any message to add it to the current investigation',
          },
        ],
      },
    ],
    response_type: 'ephemeral',
  });
}
