import axios from 'axios';

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload?: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    timestamp?: string;
    custom_details?: Record<string, any>;
  };
  links?: Array<{
    href: string;
    text: string;
  }>;
}

interface PagerDutyResponse {
  status: string;
  message: string;
  dedup_key?: string;
}

export class PagerDutyService {
  private readonly routingKey: string | undefined;
  private readonly apiUrl = 'https://events.pagerduty.com/v2/enqueue';
  private readonly enabled: boolean;

  constructor() {
    this.routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    this.enabled = !!this.routingKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Trigger a PagerDuty incident when a Case investigation is escalated
   */
  async triggerIncident(
    investigationId: string,
    investigationName: string,
    title: string,
    channelId: string,
    incidentCommander: string,
    slackWorkspaceUrl?: string
  ): Promise<string | null> {
    if (!this.enabled) {
      console.log('PagerDuty integration is not enabled (PAGERDUTY_ROUTING_KEY not set)');
      return null;
    }

    const dedupKey = `case-${investigationId}`;
    const channelUrl = slackWorkspaceUrl 
      ? `${slackWorkspaceUrl}/archives/${channelId}`
      : `slack://channel?id=${channelId}`;

    const event: PagerDutyEvent = {
      routing_key: this.routingKey!,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        summary: `[Case] ${title}`,
        source: 'case-slack-app',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        custom_details: {
          investigation_name: investigationName,
          investigation_id: investigationId,
          channel_id: channelId,
          incident_commander: incidentCommander,
          case_type: 'incident'
        }
      },
      links: [
        {
          href: channelUrl,
          text: 'View in Slack'
        }
      ]
    };

    try {
      const response = await axios.post<PagerDutyResponse>(
        this.apiUrl,
        event,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pagerduty+json;version=2'
          }
        }
      );

      if (response.data.status === 'success') {
        console.log(`PagerDuty incident triggered successfully: ${dedupKey}`);
        return dedupKey;
      } else {
        console.error('PagerDuty incident trigger failed:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Error triggering PagerDuty incident:', error);
      return null;
    }
  }

  /**
   * Resolve a PagerDuty incident when a Case incident is resolved
   */
  async resolveIncident(investigationId: string): Promise<boolean> {
    if (!this.enabled) {
      console.log('PagerDuty integration is not enabled (PAGERDUTY_ROUTING_KEY not set)');
      return false;
    }

    const dedupKey = `case-${investigationId}`;

    const event: PagerDutyEvent = {
      routing_key: this.routingKey!,
      event_action: 'resolve',
      dedup_key: dedupKey
    };

    try {
      const response = await axios.post<PagerDutyResponse>(
        this.apiUrl,
        event,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pagerduty+json;version=2'
          }
        }
      );

      if (response.data.status === 'success') {
        console.log(`PagerDuty incident resolved successfully: ${dedupKey}`);
        return true;
      } else {
        console.error('PagerDuty incident resolve failed:', response.data);
        return false;
      }
    } catch (error) {
      console.error('Error resolving PagerDuty incident:', error);
      return false;
    }
  }

}

// Singleton instance
export const pagerDutyService = new PagerDutyService();