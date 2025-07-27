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
          text: '🔍 Case - Incident Investigation Platform',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Your Investigation Toolkit:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• `/case open [title]` - Open a new case and begin investigation\n' +
                '• `/case list` - Review all active cases\n' +
                '• `/case stats` - Analyze case metrics and patterns\n' +
                '• `/case export` - Export case files to CSV\n' +
                '• `/case status` - Check case details and progress\n' +
                '• `/case incident` - Escalate to incident (in investigation channels)\n' +
                '• `/case resolve` - Resolve incident when service is restored (for incidents only)\n' +
                '• `/case transfer @user` - Transfer incident commander role (for incidents only)\n' +
                '• `/case close` - Close the case and archive evidence\n' +
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
          text: '*Gathering Evidence:*\nTo collect evidence for your case:\n1. Click the three dots (⋯) on any message\n2. Select "Add to Investigation" from the shortcuts menu',
        },
      },
    ],
    response_type: 'ephemeral',
  });
}
