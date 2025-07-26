# Trace - Slack Incident Management

A streamlined Slack app for tracking the flow from events → investigations → incidents.

## Key Features

- **Dedicated Investigation Channels**: Each investigation gets its own Slack channel
- **Memorable Names**: Auto-generated investigation names like "trace-golden-falcon"
- **Simple Commands**: Just 4 intuitive slash commands
- **Message-based Events**: Reply to any message with `/trace event` to add it as evidence
- **Clean Data Model**: Built with TypeScript, Prisma, and PostgreSQL

## Commands

All commands use the `/trace` prefix:

### `/trace investigate [title]`
Creates a new investigation with a dedicated Slack channel
- Generates a memorable name (e.g., "trace-golden-falcon")
- Creates a new channel (e.g., #golden-falcon)
- Automatically adds you and the bot to the channel
- Example: `/trace investigate API response times increasing`

### `/trace event`
Adds a message as evidence to the current investigation
- Must be used as a reply to capture the message
- Works within investigation channels
- No arguments needed

### `/trace status`
Shows the current investigation details
- Displays name, title, event count, duration
- Shows if escalated to incident
- Works within investigation channels

### `/trace incident`
Escalates the current investigation to an incident
- Sets you as the incident commander
- Updates investigation status to "escalated"
- Works within investigation channels

### `/trace help`
Shows available commands and usage

## Database Schema

```sql
-- Investigations (primary entity)
investigations:
- id (uuid, PRIMARY KEY)
- name (text, UNIQUE)                -- "trace-golden-falcon"
- title (text)                       -- User-provided description
- status (enum)                      -- investigating/escalated/resolved
- channelId (text, UNIQUE)           -- Dedicated Slack channel ID
- createdBy (text)                   -- Slack user ID
- createdAt (timestamp)

-- Events (Slack messages)
events:
- id (uuid, PRIMARY KEY)
- investigationId (uuid, FK)         -- Links to investigation
- slackMessageUrl (text)             -- Link to Slack message
- addedBy (text)                     -- User who added event
- addedAt (timestamp)

-- Incidents (escalated investigations)
incidents:
- id (uuid, PRIMARY KEY)
- investigationId (uuid, UNIQUE, FK) -- Links to investigation
- incidentCommander (text)           -- Slack user ID
- escalatedAt (timestamp)
```

## Technical Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Slack Bolt (Socket Mode)
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest with real database integration tests
- **Architecture**: Clean separation of concerns with handlers, utilities, and middleware

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Slack app with Socket Mode enabled

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `SLACK_BOT_TOKEN` - Bot user OAuth token
   - `SLACK_SIGNING_SECRET` - App signing secret
   - `SLACK_APP_TOKEN` - Socket mode app token
4. Run database migrations: `npm run prisma:migrate`
5. Start development: `npm run dev`

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Tests use a separate test database and include full integration testing.

## Deployment

The app runs in Socket Mode, which means:
- No public URL required
- Works behind firewalls
- Can run anywhere (local, Railway, Heroku, etc.)
- Just needs outbound HTTPS access

### Environment Variables

Required for production:
- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection
- `SLACK_BOT_TOKEN` - From Slack app settings
- `SLACK_SIGNING_SECRET` - From Slack app settings
- `SLACK_APP_TOKEN` - From Slack app settings

## How It Works

1. **Investigation Creation**: `/trace investigate` creates a new investigation and dedicated Slack channel
2. **Event Collection**: Team members use `/trace event` to add evidence from Slack messages
3. **Status Monitoring**: `/trace status` shows investigation progress
4. **Incident Escalation**: `/trace incident` escalates when immediate action is needed

Each investigation has its own channel, making it easy to:
- Keep discussions focused
- Control access to sensitive investigations
- Archive completed investigations
- Track all related events in one place

## Security Features

- Input validation and sanitization
- Rate limiting (60 requests/minute per user)
- SQL injection protection via Prisma ORM
- No storage of message content (only links)
- Workspace isolation
- Secure error handling