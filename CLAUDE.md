# Trace - Slack Incident Management App

## Project Overview

Trace is a Slack app that implements a streamlined incident management workflow. It helps teams track the flow from events → investigations → incidents, with a focus on simplicity and ease of use.

### Key Features
- **Memorable Names**: Auto-generated investigation names like "trace-golden-falcon"
- **Channel Context**: Each Slack channel remembers its current investigation
- **Simple Commands**: Just 5 intuitive slash commands
- **Message-based Events**: Reply to any message with `/trace event` to add it as evidence

## Architecture

### Technology Stack
- **Language**: TypeScript/Node.js
- **Framework**: Slack Bolt framework
- **Database**: PostgreSQL with Prisma ORM
- **Environment**: Runs in socket mode for easy development

### Module Structure

```
src/
├── index.ts           # Application entry point
├── commands.ts        # Command router for /trace
├── db/
│   └── client.ts      # Prisma client singleton
├── handlers/          # Command handlers
│   ├── investigate.ts # Create new investigation
│   ├── event.ts       # Add event to current investigation
│   ├── status.ts      # Show current investigation status
│   ├── incident.ts    # Escalate to incident
│   ├── switch.ts      # Switch current investigation
│   └── help.ts        # Show help message
├── utils/             # Utility functions
│   ├── nameGenerator.ts   # Generate memorable names
│   ├── channelState.ts    # Manage per-channel state
│   └── formatters.ts      # Format Slack messages
└── listeners.ts       # Event listeners (placeholder)
```

### Database Schema

```sql
-- Investigations (primary entity)
investigations:
- name (text, PRIMARY KEY)    -- "trace-golden-falcon"
- title (text)                -- User-provided description
- status (enum)               -- investigating/escalated/resolved
- channelId (text)           -- Slack channel ID
- createdBy (text)           -- Slack user ID
- createdAt (timestamp)

-- Events (Slack messages)
events:
- id (uuid, PRIMARY KEY)
- investigationName (text, FK)
- slackMessageUrl (text)      -- Link to Slack message
- addedBy (text)             -- User who added event
- addedAt (timestamp)

-- Incidents (escalated investigations)
incidents:
- investigationName (text, PRIMARY KEY, FK)
- incidentCommander (text)    -- Slack user ID
- escalatedAt (timestamp)

-- Channel state tracking
channelState:
- channelId (text, PRIMARY KEY)
- currentInvestigation (text)  -- Current investigation name
- updatedAt (timestamp)
```

## Commands

All commands use the `/trace` prefix:

1. **`/trace investigate [title]`** - Create a new investigation
   - Generates a memorable name (e.g., "trace-golden-falcon")
   - Sets as current investigation for the channel
   - Example: `/trace investigate API response times increasing`

2. **`/trace event`** - Add a message as evidence
   - Must be used as a reply to capture the message
   - Adds to the current investigation in the channel
   - No arguments needed

3. **`/trace status`** - Show current investigation
   - Displays name, title, event count, duration
   - Shows if escalated to incident
   - Ephemeral response (only visible to user)

4. **`/trace incident`** - Escalate to incident
   - Converts current investigation to incident
   - Sets the user as incident commander
   - Updates investigation status to "escalated"

5. **`/trace switch [name]`** - Change current investigation
   - Switch to a different investigation in the channel
   - Example: `/trace switch trace-silver-dolphin`

## Development Workflow

### Setup
```bash
npm install
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
```

### Running
```bash
npm run dev    # Development with hot reload
npm run build  # Build TypeScript
npm start      # Production mode
```

### Testing
```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Environment Variables
Required in `.env`:
- `SLACK_BOT_TOKEN` - Bot user OAuth token
- `SLACK_SIGNING_SECRET` - App signing secret
- `SLACK_APP_TOKEN` - Socket mode app token
- `DATABASE_URL` - PostgreSQL connection string

## Code Patterns

### Command Handler Pattern
```typescript
interface HandlerContext {
  command: SlackCommandMiddlewareArgs['command'];
  respond: RespondFn;
  // Additional parameters as needed
}

export async function handleCommand(
  { command, respond, ...params }: HandlerContext,
  prisma: PrismaClient
): Promise<void> {
  // Implementation
}
```

### Channel State Management
- Each channel can have one current investigation
- State persists in database
- Commands operate on current investigation by default

### Error Handling
- All handlers wrap operations in try-catch
- User-friendly error messages via `respond()`
- Console logging for debugging

## Testing Strategy

### Unit Tests
- Handler logic tested with mocked Prisma client
- Uses `jest-mock-extended` for deep mocking
- Mock Slack API responses

### Test Structure
```
src/
├── handlers/__tests__/   # Handler tests
├── utils/__tests__/      # Utility tests
└── test/
    ├── mocks/           # Slack API mocks
    └── setup.ts         # Jest setup with Prisma mocks
```

## Future Enhancements

1. **Event Details**: Capture message content, not just links
2. **Notifications**: Alert on escalations
3. **Metrics**: Track investigation duration, event counts
4. **Integration**: Connect with monitoring tools
5. **Permissions**: Role-based access control

## Maintenance Notes

- Database migrations in `prisma/migrations/`
- Prisma schema in `prisma/schema.prisma`
- All handlers are stateless and idempotent
- Channel state provides context without complex state management