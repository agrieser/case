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
          text: '• `/trace create [title]` - Create new investigation with dedicated channel\n' +
                '• `/trace list` - List all active investigations\n' +
                '• `/trace stats` - View investigation and incident statistics\n' +
                '• `/trace export` - Export all investigations to CSV\n' +
                '• `/trace status` - Show investigation status (in investigation channels)\n' +
                '• `/trace incident` - Escalate to incident (in investigation channels)\n' +
                '• `/trace resolve` - Resolve incident when service is restored (for incidents only)\n' +
                '• `/trace transfer @user` - Transfer incident commander role (for incidents only)\n' +
                '• `/trace close` - Close investigation and archive channel (in investigation channels)\n' +
                '• `/trace help` - Show this help message',
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
