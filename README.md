# Trace - Slack Incident Management

A streamlined Slack app for tracking the flow from events → investigations → incidents.

## Key Features

- **Dedicated Investigation Channels**: Each investigation gets its own Slack channel
- **Intuitive Channel Names**: Channels named after your description (e.g., `trace-api-down-a3f`)
- **Simple Commands**: Just 5 intuitive slash commands
- **Message Shortcuts**: Right-click any message to add it as evidence
- **Central Notifications**: Investigation summaries posted to `#h-potential-issues`
- **Smart Event Linking**: Add events from any channel to any investigation

## Commands

All commands use the `/trace` prefix:

### `/trace create [title]`
Creates a new investigation with a dedicated Slack channel
- Generates investigation name (e.g., "trace-golden-falcon")
- Creates a channel based on your title (e.g., #trace-api-down-a3f)
- Posts summary to #h-potential-issues
- Automatically adds you to the channel
- Example: `/trace create API response times increasing`

### `/trace list`
Lists all active investigations
- Shows investigations in a dropdown menu
- Select one to see details and get a link to its channel

### `/trace status`
Shows the current investigation details
- **Only works within investigation channels**
- Displays name, title, event count, duration
- Shows if escalated to incident

### `/trace incident`
Escalates the current investigation to an incident
- **Only works within investigation channels**
- Sets you as the incident commander
- Updates investigation status to "escalated"

### `/trace help`
Shows available commands and usage

### Adding Events
To add a message as evidence:
1. Right-click (or tap ⋯) on any message in any channel
2. Select "Add to Investigation" from the shortcuts menu
3. If multiple investigations exist, select from the dropdown
4. The event is added to the investigation with a link back to the original message

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
   - `SLACK_BOT_TOKEN` - Bot user OAuth token (xoxb-...)
   - `SLACK_SIGNING_SECRET` - App signing secret
   - `SLACK_APP_TOKEN` - Socket mode app token (xapp-...)
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

1. **Investigation Creation**: `/trace create` creates a new investigation and dedicated Slack channel
2. **Event Collection**: Team members use the "Add to Investigation" message shortcut to add evidence
3. **Status Monitoring**: `/trace status` shows investigation progress within investigation channels
4. **Incident Escalation**: `/trace incident` escalates when immediate action is needed

### Typical Workflow

1. **Alert fires** in #monitoring channel
2. **Create investigation**: `/trace create Database response times spiking`
3. **Add evidence**: Right-click the alert message → "Add to Investigation"
4. **Collaborate**: Team joins the investigation channel (e.g., #trace-database-res-a3f)
5. **Track events**: Add relevant messages from various channels
6. **Escalate if needed**: `/trace incident` if it requires immediate attention

## Security Features

- Input validation and sanitization
- Rate limiting (60 requests/minute per user)
- SQL injection protection via Prisma ORM
- No storage of message content (only links)
- Workspace isolation
- Secure error handling

## Slack App Configuration

### Required Bot Token Scopes
- `channels:manage` - Create channels
- `channels:join` - Join channels
- `chat:write` - Post messages
- `commands` - Handle slash commands
- `channels:read` - List channels
- `groups:read` - Read private channels
- `im:read` - Read DMs
- `mpim:read` - Read group DMs

### Required Features
- Socket Mode enabled
- Interactivity enabled
- Slash commands configured
- Message shortcuts configured