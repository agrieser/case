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
          text: '🔍 Trace - Incident Management'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• `/trace investigate [title]` - Create new investigation (becomes current in channel)\n' +
                '• `/trace event` - Add replied message as event to current investigation\n' +
                '• `/trace status` - Show current investigation status\n' +
                '• `/trace incident` - Escalate current investigation to incident\n' +
                '• `/trace switch [name]` - Switch to different investigation in this channel\n' +
                '• `/trace help` - Show this help message'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '*Note:* Use `/trace event` as a reply to any message to add it to the current investigation'
          }
        ]
      }
    ],
    response_type: 'ephemeral'
  });
}