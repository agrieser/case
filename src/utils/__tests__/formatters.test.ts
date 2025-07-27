import { describe, it, expect } from '@jest/globals';
import { formatEvent, formatInvestigation, formatIncident } from '../formatters';
import { Event, Investigation, Incident, InvestigationStatus } from '@prisma/client';

describe('formatters', () => {
  describe('formatEvent', () => {
    it('should format event correctly', () => {
      const event: Event = {
        id: 'event-123',
        investigationId: 'inv-123',
        slackMessageUrl: 'https://slack.com/archives/C123/p123',
        addedBy: 'U123456',
        addedAt: new Date('2024-01-15T10:00:00Z')
      };

      const formatted = formatEvent(event);

      expect(formatted.type).toBe('section');
      expect(formatted.fields).toHaveLength(4);
      expect(formatted.fields![0].text).toContain('event-123');
      expect(formatted.fields![2].text).toContain('View in Slack');
      expect(formatted.fields![3].text).toContain('U123456');
    });
  });

  describe('formatInvestigation', () => {
    it('should format investigation correctly', () => {
      const investigation: Investigation & { _count: { events: number } } = {
        id: 'inv-123',
        name: 'case-golden-falcon',
        title: 'API response times increasing',
        status: 'investigating' as InvestigationStatus,
        channelId: 'C123456',
        createdBy: 'U123456',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        closedBy: null,
        closedAt: null,
        issuesMessageTs: '1234567890.123456',
        _count: { events: 3 }
      };

      const formatted = formatInvestigation(investigation);

      expect(formatted.type).toBe('section');
      expect(formatted.fields).toHaveLength(6);
      expect(formatted.fields![0].text).toContain('case-golden-falcon');
      expect(formatted.fields![1].text).toContain('API response times increasing');
      expect(formatted.fields![2].text).toContain('investigating');
      expect(formatted.fields![3].text).toContain('3');
    });
  });

  describe('formatIncident', () => {
    it('should format incident correctly', () => {
      const incident: Incident & { investigation?: Investigation } = {
        id: 'inc-123',
        investigationId: 'inv-123',
        incidentCommander: 'U789012',
        escalatedAt: new Date('2024-01-15T11:00:00Z'),
        resolvedAt: null,
        resolvedBy: null,
        investigation: {
          id: 'inv-123',
          name: 'case-golden-falcon',
          title: 'Test Investigation',
          status: 'escalated' as InvestigationStatus,
          channelId: 'C123456',
          createdBy: 'U123456',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          closedBy: null,
          closedAt: null,
          issuesMessageTs: '1234567890.123456'
        }
      };

      const formatted = formatIncident(incident);

      expect(formatted.type).toBe('section');
      expect(formatted.fields).toHaveLength(3);
      expect(formatted.fields![0].text).toContain('case-golden-falcon');
      expect(formatted.fields![1].text).toContain('U789012');
      expect(formatted.fields![2].text).toContain('Escalated');
    });
  });
});