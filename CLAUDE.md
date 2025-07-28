# Case - Slack Incident Management App

## Project Overview

Case is a Slack app that implements a streamlined incident management workflow. It helps teams track the flow from events → investigations → incidents, with each investigation having its own dedicated Slack channel.

### Key Features
- **Dedicated Channels**: Each investigation creates its own Slack channel
- **Intuitive Channel Names**: Channels named after your description (e.g., `case-api-down-a3f`)
- **Simple Commands**: Just 9 intuitive slash commands  
- **Message Shortcuts**: Right-click any message to add it as evidence
- **Central Notifications**: Investigation summaries posted to issues channel
- **Smart Event Linking**: Add events from any channel to any investigation
- **PagerDuty Integration**: Automatically create and resolve PagerDuty incidents (optional)

### Investigation & Incident Lifecycle

1. **Investigation Created** → Active investigation for tracking issues
2. **Escalate to Incident** → When service is impacted (optional)
3. **Resolve Incident** → When service is restored (incident only)
4. **Close Investigation** → When all follow-up work is complete

Key distinction: Incidents are resolved when service is restored, but investigations remain open for root cause analysis, post-mortems, and follow-up work.

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
├── commands.ts        # Command router for /case
├── db/
│   └── client.ts      # Prisma client singleton
├── handlers/          # Command handlers
│   ├── investigate.ts # Create new investigation & channel
│   ├── status.ts      # Show investigation status
│   ├── incident.ts    # Escalate to incident
│   ├── list.ts        # List active investigations
│   └── help.ts        # Show help message
├── services/          # External service integrations
│   └── pagerduty.ts   # PagerDuty API integration
├── utils/             # Utility functions
│   ├── nameGenerator.ts   # Generate investigation & channel names
│   └── formatters.ts      # Format Slack messages
├── middleware/        # Middleware functions
│   ├── validation.ts      # Input validation
│   └── rateLimit.ts       # Rate limiting
├── test/              # Test utilities
│   ├── setup.ts           # Jest setup
│   └── mocks/             # Mock objects
└── listeners.ts       # Event listeners & shortcuts
```

### Database Schema

```prisma
model Investigation {
  id            String              @id @default(uuid())
  name          String              @unique // "case-golden-falcon"
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
  pagerDutyIncidentKey String?      // PagerDuty dedup key for incident tracking
  
  investigation       Investigation @relation(fields: [investigationId], references: [id])
}
```

## Commands

All commands use the `/case` prefix:

1. **`/case open [title]`** - Open a new investigation
   - Generates investigation name (e.g., "case-golden-falcon")
   - Creates channel based on title (e.g., #case-api-down-a3f)
   - Posts summary to issues channel
   - Automatically adds the user to the channel
   - Example: `/case open API response times increasing`

2. **Message Shortcut: "Collect Evidence"**
   - Right-click (or tap ⋯) on any message
   - Select "Collect Evidence" from shortcuts menu
   - If multiple investigations exist, shows a modal to select
   - Adds the message as evidence with a link back to original

3. **`/case status`** - Show investigation details
   - **Only works within investigation channels**
   - Displays name, title, event count, duration
   - Shows if escalated to incident
   - Ephemeral response (only visible to user)

4. **`/case incident`** - Escalate to incident
   - **Only works within investigation channels**
   - Converts investigation to incident
   - Sets the user as incident commander
   - Updates investigation status to "escalated"

5. **`/case list`** - List active investigations
   - Shows a formatted list of all active investigations
   - Displays title, channel link, event count, duration, and creator
   - Lists up to 25 most recent investigations
   - Excludes closed investigations

6. **`/case stats`** - View operational dashboard
   - Shows real-time operational metrics
   - Current active investigations and incidents
   - 7-day activity metrics (cases opened, time spent)
   - Average investigation close and incident resolution times
   - Updates timestamp for freshness

7. **`/case export`** - Export all investigations to CSV
   - Exports complete investigation history
   - Includes all investigation details, incident data, and metrics
   - Sends CSV file as a direct message
   - Useful for external analysis and reporting

8. **`/case resolve`** - Resolve incident
   - **Only works for escalated incidents**
   - Marks the incident as resolved (service restored)
   - Investigation remains open for follow-up work
   - Posts resolution notice to channel and issues channel
   - Tracks who resolved it and when

9. **`/case transfer @user`** - Transfer incident commander role
   - **Only works within investigation channels that have been escalated**
   - Changes the incident commander to the mentioned user
   - Posts public confirmation in the channel
   - Example: `/case transfer @sarah`

10. **`/case close`** - Close investigation
    - **Only works within investigation channels**
    - Cannot close if incident is unresolved
    - Archives the Slack channel
    - Updates investigation status to "closed"
    - Tracks who closed it and when

11. **`/case help`** - Show available commands

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
- `ISSUES_CHANNEL_ID` - Channel ID for issues notifications (e.g., C0123456789)

Optional:
- `EXPORT_AUTHORIZED_USERS` - Comma-separated list of Slack user IDs who can export data (e.g., U123456,U789012,U345678)
  - If not set, all users can export
  - If set, only listed users can use `/case export`
  - Spaces around IDs are automatically trimmed
  - To find a user's ID: Click their profile → More → Copy member ID
- `PAGERDUTY_ROUTING_KEY` - PagerDuty Events API V2 routing key (32-character string)
  - When set, PagerDuty integration is automatically enabled
  - Incidents will be automatically created when Case escalates to incident
  - Incidents will be automatically resolved when Case incident is resolved
  - To obtain: Create an Events API V2 integration in PagerDuty service settings

Test environment uses `.env.test` with separate database.

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
- Channel name derived from investigation title
- Status and incident commands only work within investigation channels

### Event Addition Flow
1. User right-clicks message in any channel
2. Selects "Collect Evidence" shortcut
3. If one investigation exists, adds immediately
4. If multiple exist, shows modal to select
5. Creates event record with message link
6. Posts confirmation to investigation channel
7. Shows ephemeral confirmation to user

### Error Handling
- All handlers wrap operations in try-catch
- User-friendly error messages via `respond()`
- Sensitive errors logged but not exposed to users
- Input validation before processing
- Rate limiting to prevent abuse

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

1. **External User Blocking**: Users from connected workspaces (Slack Connect) are blocked from all commands
   - External users identified by user ID patterns: `U123_T456` or `W` prefix
   - Blocked users receive: "This command is not available for external users"
   - All blocked attempts are logged for security monitoring
2. **Input Validation**: All user input sanitized against XSS and injection
3. **Rate Limiting**: 60 requests/minute per user
4. **SQL Injection**: Protected via Prisma parameterized queries
5. **Error Handling**: Internal errors not exposed to users
6. **Permissions**: Bot only joins channels it creates
7. **Message Security**: Only stores links, not content
8. **Workspace Restrictions**: Optional `ALLOWED_WORKSPACE_IDS` environment variable to limit to specific workspaces

## Channel Naming Convention

Channels are named using the pattern: `case-[description]-[random]`
- Prefix: Always `case-`
- Description: Derived from user's title, max 11 chars
- Random: 3 character hex string for uniqueness
- Max length: 21 characters (Slack limit)

Examples:
- "API down" → `case-api-down-a3f`
- "Payment processing errors" → `case-payment-pro-b2c`
- "Database performance" → `case-database-pe-d4e`

## Branding & Theme

Case uses a subtle detective/investigation theme throughout the user experience while maintaining professionalism suitable for incident management:

### Language Choices
- **Commands**: "open" instead of "create" to pair with "close" 
- **Terminology**: "case files", "evidence", "investigation toolkit"
- **Emojis**: 🔍 for investigations, 🚨 for incidents, ✅ for resolved, 📋 for lists

### User-Facing Messages
- Headers use "Case - Incident Investigation Platform"
- Status displays show "Case File" instead of "Investigation"
- Events are referred to as "Evidence Collected"
- Message shortcuts use "Collect Evidence" language

### Design Philosophy
- Professional first - this is for serious incident management
- Subtle thematic elements enhance the experience without being distracting
- Consistent terminology reinforces the investigation metaphor
- Clear visual indicators (emojis) for different states

## Slack App Manifest

Key configuration in `manifest.yml`:
- Socket mode enabled
- Interactivity enabled
- Message shortcut: "Collect Evidence"
- Slash command: `/case`
- Required bot scopes

## PagerDuty Integration

When `PAGERDUTY_ROUTING_KEY` is set, Case automatically integrates with PagerDuty:

### How It Works
1. **Incident Creation**: When a Case investigation is escalated to incident via `/case incident`:
   - A PagerDuty incident is automatically triggered
   - The incident uses a dedup key of `case-{investigationId}` for correlation
   - Incident includes investigation title, channel link, and incident commander
   
2. **Incident Resolution**: When a Case incident is resolved via `/case resolve`:
   - The corresponding PagerDuty incident is automatically resolved
   - Resolution status is shown in the Slack confirmation message

3. **Status Visibility**: 
   - `/case status` shows PagerDuty integration status when enabled
   - Incident escalation messages indicate if PagerDuty was triggered
   - Resolution messages show if PagerDuty was successfully resolved

### PagerDuty Setup
1. In PagerDuty, navigate to your service's Integrations tab
2. Add a new integration and select "Events API V2"
3. Copy the Integration Key (routing key)
4. Set `PAGERDUTY_ROUTING_KEY` in your `.env` file
5. Restart the Case app

### Error Handling
- PagerDuty failures don't block Case operations
- All PagerDuty errors are logged but operations continue
- Users see PagerDuty status in command responses

## Future Enhancements

1. **Event Details**: Capture message content, not just links
2. **Notifications**: Alert on escalations
3. **Metrics**: Track investigation duration, event counts
4. **Archive**: Auto-archive old investigation channels
5. **Permissions**: Role-based access control
6. **Integration**: Webhook support for external systems

## Maintenance Notes

- Database migrations in `prisma/migrations/`
- Prisma schema in `prisma/schema.prisma`
- All handlers are stateless and idempotent
- Tests use `--forceExit` due to Prisma connection pooling
- Socket mode requires persistent connection