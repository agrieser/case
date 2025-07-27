import { RespondFn } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

interface ExportContext {
  respond: RespondFn;
  userId: string;
  client: WebClient;
}

export async function handleExport(
  { respond, userId, client }: ExportContext,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Check if user is authorized to export
    const authorizedUsers = process.env.EXPORT_AUTHORIZED_USERS?.split(',').map(u => u.trim()) || [];
    
    if (authorizedUsers.length > 0 && !authorizedUsers.includes(userId)) {
      await respond({
        text: '🔒 You are not authorized to export data. Please contact your administrator.',
        response_type: 'ephemeral',
      });
      return;
    }
    
    // Fetch all investigations with related data
    const investigations = await prisma.investigation.findMany({
      include: {
        incident: true,
        _count: {
          select: { events: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (investigations.length === 0) {
      await respond({
        text: 'No investigations found to export.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Generate CSV content
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push([
      'Investigation Name',
      'Title',
      'Status',
      'Channel ID',
      'Created By',
      'Created At',
      'Closed By',
      'Closed At',
      'Events Count',
      'Duration (hours)',
      'Escalated to Incident',
      'Incident Commander',
      'Escalated At',
      'Resolved By',
      'Resolved At',
      'Resolution Time (hours)',
    ].join(','));

    // Data rows
    for (const inv of investigations) {
      const duration = inv.closedAt 
        ? (inv.closedAt.getTime() - inv.createdAt.getTime()) / (1000 * 60 * 60)
        : (Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60);
      
      const resolutionTime = inv.incident?.resolvedAt
        ? (inv.incident.resolvedAt.getTime() - inv.incident.escalatedAt.getTime()) / (1000 * 60 * 60)
        : null;

      const row = [
        inv.name,
        `"${inv.title.replace(/"/g, '""')}"`, // Escape quotes in title
        inv.status,
        inv.channelId,
        inv.createdBy,
        inv.createdAt.toISOString(),
        inv.closedBy || '',
        inv.closedAt?.toISOString() || '',
        inv._count.events.toString(),
        duration.toFixed(2),
        inv.incident ? 'Yes' : 'No',
        inv.incident?.incidentCommander || '',
        inv.incident?.escalatedAt.toISOString() || '',
        inv.incident?.resolvedBy || '',
        inv.incident?.resolvedAt?.toISOString() || '',
        resolutionTime?.toFixed(2) || '',
      ].join(',');

      csvRows.push(row);
    }

    const csvContent = csvRows.join('\n');
    const buffer = Buffer.from(csvContent, 'utf-8');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `case-export-${timestamp}.csv`;

    // Upload file to Slack
    const uploadResult = await client.files.uploadV2({
      channel_id: userId, // Send as DM to the user
      filename,
      file: buffer,
      initial_comment: `📊 Case Export - ${investigations.length} investigations`,
    });

    if (!uploadResult.ok) {
      throw new Error('Failed to upload CSV file');
    }

    // Send confirmation message
    await respond({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ Export complete! I\'ve sent you the CSV file as a direct message.',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Export Summary:*\n• Total investigations: ${investigations.length}\n• File: ${filename}\n• Check your DMs for the download link`,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error in handleExport:', error);
    await respond({
      text: '⚠️ Failed to export data. Please try again.',
      response_type: 'ephemeral',
    });
  }
}