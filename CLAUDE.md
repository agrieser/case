# Trace - Slack Incident Management App

## Project Overview

Trace is a Slack app that implements a streamlined incident management workflow. It helps teams track the flow from events → investigations → incidents, with each investigation having its own dedicated Slack channel.

### Key Features
- **Dedicated Channels**: Each investigation creates its own Slack channel
- **Memorable Names**: Auto-generated investigation names like "trace-golden-falcon"
- **Simple Commands**: Just 4 intuitive slash commands
- **Message-based Events**: Reply to any message with `/trace event` to add it as evidence

## Architecture

### Technology Stack
- **Language**: TypeScript/Node.js
- **Framework**: Slack Bolt framework
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest with real database integration
- **Environment**: Runs in socket mode for easy development

### Module Structure

```
src/
├── index.ts           # Application entry point
├── commands.ts        # Command router for /trace
├── db/
│   └── client.ts      # Prisma client singleton
├── handlers/          # Command handlers
│   ├── investigate.ts # Create new investigation & channel
│   ├── event.ts       # Add event to investigation
│   ├── status.ts      # Show investigation status
│   ├── incident.ts    # Escalate to incident
│   └── help.ts        # Show help message
├── utils/             # Utility functions
│   ├── nameGenerator.ts   # Generate memorable names
│   └── formatters.ts      # Format Slack messages
├── middleware/        # Middleware functions
│   ├── validation.ts      # Input validation
│   └── rateLimit.ts       # Rate limiting
├── test/              # Test utilities
│   ├── setup.ts           # Jest setup
│   └── mocks/             # Mock objects
└── listeners.ts       # Event listeners (placeholder)
```

### Database Schema

```prisma
model Investigation {
  id            String              @id @default(uuid())
  name          String              @unique // "trace-golden-falcon"
  title         String              // User-provided description
  status        InvestigationStatus @default(investigating)
  channelId     String              @unique // Dedicated Slack channel ID
  createdBy     String              // Slack user ID
  createdAt     DateTime            @default(now())
  
  events        Event[]
  incident      Incident?
}

model Event {
  id                  String        @id @default(uuid())
  investigationId     String        // Foreign key to Investigation
  slackMessageUrl     String        // Link to Slack message
  addedBy             String        // Slack user ID
  addedAt             DateTime      @default(now())
  
  investigation       Investigation @relation(fields: [investigationId], references: [id])
}

model Incident {
  id                  String        @id @default(uuid())
  investigationId     String        @unique // Foreign key to Investigation
  incidentCommander   String        // Slack user ID
  escalatedAt         DateTime      @default(now())
  
  investigation       Investigation @relation(fields: [investigationId], references: [id])
}
```

## Commands

All commands use the `/trace` prefix:

1. **`/trace investigate [title]`** - Create a new investigation
   - Generates a memorable name (e.g., "trace-golden-falcon")
   - Creates a dedicated Slack channel (#golden-falcon)
   - Automatically adds the user and bot to the channel
   - Example: `/trace investigate API response times increasing`

2. **`/trace event`** - Add a message as evidence
   - Must be used as a reply to capture the message
   - Adds to the investigation associated with the current channel
   - No arguments needed

3. **`/trace status`** - Show investigation details
   - Displays name, title, event count, duration
   - Shows if escalated to incident
   - Ephemeral response (only visible to user)

4. **`/trace incident`** - Escalate to incident
   - Converts investigation to incident
   - Sets the user as incident commander
   - Updates investigation status to "escalated"

5. **`/trace help`** - Show available commands

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
  client?: WebClient;  // For handlers that need Slack API
}

export async function handleCommand(
  { command, respond, ...params }: HandlerContext,
  prisma: PrismaClient
): Promise<void> {
  // Implementation
}
```

### Investigation-Channel Model
- Each investigation has one dedicated channel (1:1 relationship)
- Channel ID stored in investigation record
- Commands work within the context of the channel
- No need for channel state management

### Error Handling
- All handlers wrap operations in try-catch
- User-friendly error messages via `respond()`
- Sensitive errors logged but not exposed to users
- Input validation before processing

## Testing Strategy

### Integration Tests
- Uses real PostgreSQL test database
- Tests run in transactions for isolation
- Automatic cleanup between tests
- Mock Slack API responses

### Test Structure
```
src/
├── handlers/__tests__/   # Handler tests
├── utils/__tests__/      # Utility tests
├── middleware/__tests__/ # Middleware tests
└── test/
    ├── setup.ts         # Database setup/teardown
    └── mocks/           # Slack API mocks
```

## Security Considerations

1. **Input Validation**: All user input sanitized
2. **Rate Limiting**: 60 requests/minute per user
3. **SQL Injection**: Protected via Prisma parameterized queries
4. **Error Handling**: Internal errors not exposed to users
5. **Permissions**: Bot only joins channels it creates

## Future Enhancements

1. **Event Details**: Capture message content, not just links
2. **Notifications**: Alert on escalations
3. **Metrics**: Track investigation duration, event counts
4. **Archive**: Auto-archive old investigation channels
5. **Permissions**: Role-based access control

## Maintenance Notes

- Database migrations in `prisma/migrations/`
- Prisma schema in `prisma/schema.prisma`
- All handlers are stateless and idempotent
- Tests use `--forceExit` due to Prisma connection pooling