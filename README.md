# Trace - Slack Incident Management App

## Overview
Build a Slack app called "Trace" that implements our incident management methodology. The app helps teams track the flow from events → investigations → incidents, with support for both methodical investigation workflows and emergency "site is down" situations.

## Core Methodology
- **Events**: Initial signals (monitoring alerts, user reports, observations)
- **Investigations**: Analyzing and connecting events to understand scope/impact
- **Incidents**: Escalated situations requiring coordinated response
- **Flow**: Events can open investigations, investigations can escalate to incidents

## Technical Requirements
- **Language**: TypeScript/Node.js
- **Framework**: Slack Bolt framework
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Ready for cloud deployment (Vercel/Railway/similar)

## Key Features Needed

### Slash Commands
Primary command: `/trace`

**Emergency Usage:**
```
/trace site-down
/trace critical-payment-outage
/trace security-breach
```

**Methodical Usage:**
```
/trace event [description]
/trace investigate [event-id or description]
/trace incident [investigation-id or description]
```

### Database Schema
Design tables for:
- **events** (id, description, timestamp, reporter, status, metadata)
- **investigations** (id, title, events[], status, assignee, created_at)
- **incidents** (id, title, severity, investigations[], status, commander, created_at)
- **incident_timeline** (entries linking events/investigations/incidents)

### Slack Integration
- Slash command handling
- Interactive buttons/modals for status updates
- Channel notifications for escalations
- Thread management for ongoing incidents
- Rich formatting for status displays

## Project Structure
Set up a clean TypeScript project with:
- Proper error handling and logging
- Environment configuration
- Database migrations
- Slack app manifest
- Development and production configs

## Success Criteria
1. `/trace` command works for both emergency and methodical workflows
2. Clear progression from events → investigations → incidents
3. Good reporting/tracking for post-incident analysis
4. Intuitive Slack UX that doesn't get in the way during emergencies
5. Solid data model that captures the relationship between all pieces

## Next Steps
1. Initialize the TypeScript project with Bolt and Prisma
2. Set up basic slash command handling
3. Design and implement the database schema
4. Build the core event/investigation/incident creation flows
5. Add Slack UI components (buttons, modals, etc.)
6. Implement status tracking and updates
7. Add reporting and timeline views

Start with a minimal viable version that handles the basic `/trace` command and can create events/investigations/incidents in the database.
