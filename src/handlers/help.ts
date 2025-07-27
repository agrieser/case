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
          text: '🔍 Case - Incident Management',
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
          text: '• `/case create [title]` - Create new investigation with dedicated channel\n' +
                '• `/case list` - List all active investigations\n' +
                '• `/case stats` - View investigation and incident statistics\n' +
                '• `/case export` - Export all investigations to CSV\n' +
                '• `/case status` - Show investigation status (in investigation channels)\n' +
                '• `/case incident` - Escalate to incident (in investigation channels)\n' +
                '• `/case resolve` - Resolve incident when service is restored (for incidents only)\n' +
                '• `/case transfer @user` - Transfer incident commander role (for incidents only)\n' +
                '• `/case close` - Close investigation and archive channel (in investigation channels)\n' +
                '• `/case help` - Show this help message',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Adding Events:*\nTo add a message as evidence:\n1. Click the three dots (⋯) on any message\n2. Select "Add to Investigation" from the shortcuts menu',
        },
      },
    ],
    response_type: 'ephemeral',
  });
}
