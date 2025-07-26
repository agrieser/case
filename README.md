# Trace - Slack Incident Management

A lightweight Slack app that implements a structured methodology for incident management, organizing the flow from events → investigations → incidents, with comprehensive tracking and reporting.

## What is Trace?

Trace implements a structured approach to incident management that provides:

- **Clear stages**: Events → Investigations → Incidents
- **Dedicated spaces**: Each investigation gets its own channel
- **Evidence collection**: Link related messages and alerts
- **Complete tracking**: Who did what, when, and for how long

This methodology creates accountability, enables better reporting, and ensures nothing falls through the cracks.

## ✨ Key Features

### 🔍 **Dedicated Investigation Channels**

Each investigation gets its own Slack channel (e.g., `#trace-api-down-a3f`), keeping discussions organized and focused.

### 📎 **Easy Evidence Collection**

Right-click any message in Slack to add it as evidence to an investigation - no copying and pasting required.

### 🚨 **Simple Incident Escalation**

Escalate investigations to incidents with one command, automatically setting the incident commander.

### 📊 **Central Visibility**

All new investigations are announced in your designated channel (e.g., `#potential-issues`) for team awareness.

### 🛡️ **Secure by Default**

External users from connected workspaces are automatically blocked from using commands, protecting your incident data.

## 📚 Methodology

Trace implements a structured incident management methodology that emphasizes investigation before escalation:

### The Flow: Events → Investigations → Incidents

1. **Events**: Things that happen (alerts, errors, customer reports)

   - Exist as messages across your Slack workspace
   - Can be linked to investigations as evidence

2. **Investigations**: Organized efforts to understand what's happening

   - Created when events need deeper analysis
   - Have dedicated channels for focused discussion
   - Collect related events as evidence
   - May or may not become incidents

3. **Incidents**: Investigations that require immediate action
   - Escalated from investigations when severity is confirmed
   - Have an assigned incident commander
   - Must be resolved before investigation can close

### Why This Approach?

- **Not everything is an incident**: Many issues can be investigated and resolved without declaring an incident
- **Evidence-based decisions**: Collect information before escalating
- **Clear accountability**: Track who did what and when
- **Better post-mortems**: All evidence is already collected and timestamped
- **Reduced noise**: Only real incidents trigger full incident response

### Lifecycle Example

```
Alert fires → Create investigation → Collect evidence → Assess severity
  ↓                                                         ↓
  └─→ Minor issue: Fix and close ←─────────────────────────┘
                                                           ↓
                                                    Major issue: Escalate to incident
                                                           ↓
                                                    Respond and resolve incident
                                                           ↓
                                                    Complete follow-up work
                                                           ↓
                                                    Close investigation
```

## 🚀 Getting Started

### Installation Requirements

- A Slack workspace with admin permissions
- PostgreSQL database
- Node.js 18+ (for self-hosting)

### Quick Start

1. **Create a Slack App**

   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From manifest"
   - Copy the manifest from `manifest.yml` in this repo
   - Install the app to your workspace

2. **Set up the database**

   ```bash
   # Create a PostgreSQL database
   createdb trace_production
   ```

3. **Configure environment variables**

   ```bash
   # Required
   DATABASE_URL=postgresql://user:password@localhost:5432/trace_production
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   POTENTIAL_ISSUES_CHANNEL_ID=C123456789  # Channel ID for notifications

   # Optional
   ALLOWED_WORKSPACE_IDS=T123456,T789012  # Restrict to specific workspaces
   ```

4. **Deploy the app**
   ```bash
   npm install
   npm run prisma:migrate deploy
   npm run build
   npm start
   ```

## 📖 How to Use Trace

### Basic Commands

All commands start with `/trace`:

| Command                       | Description                    | Where to Use                |
| ----------------------------- | ------------------------------ | --------------------------- |
| `/trace create [description]` | Create a new investigation     | Any channel                 |
| `/trace list`                 | View all active investigations | Any channel                 |
| `/trace status`               | Show investigation details     | Investigation channels only |
| `/trace incident`             | Escalate to incident           | Investigation channels only |
| `/trace resolve`              | Mark incident as resolved      | Investigation channels only |
| `/trace close`                | Close the investigation        | Investigation channels only |
| `/trace help`                 | Show available commands        | Any channel                 |

### Typical Workflow

1. **Something happens** (alert, customer report, monitoring notification)

   ```
   /trace create API response times increasing
   ```

   📊 **Tracked**: Investigation created by @user at 2:45 PM

2. **Trace creates a dedicated channel** (e.g., `#trace-api-respons-a3f`)

   - You're automatically added to the channel
   - A summary is posted to your notification channel
   - Clock starts for investigation duration

3. **Collect evidence**

   - Right-click any relevant message → "Add to Investigation"
   - Messages are linked in the investigation channel

   📊 **Tracked**: Each event added with timestamp and who added it

4. **If it's serious, escalate**

   ```
   /trace incident
   ```

   - This marks it as an active incident
   - Sets you as the incident commander

   📊 **Tracked**: Escalation time, incident commander assigned

5. **When service is restored**

   ```
   /trace resolve
   ```

   📊 **Tracked**: Resolution time, resolved by whom, total incident duration

6. **After follow-up is complete**

   ```
   /trace close
   ```

   📊 **Tracked**: Investigation closed, total duration, complete timeline available

### Adding Evidence

To add any Slack message as evidence:

1. Hover over the message
2. Click the three dots (⋯) menu
3. Select "Add to Investigation"
4. Choose the investigation (if multiple are active)

The message will be linked in the investigation channel with context about who added it and when.

## 🏗️ Architecture

Trace is designed to be simple and reliable:

- **Runs in Socket Mode**: No public URL needed, works behind firewalls
- **Stateless handlers**: Each command is independent
- **PostgreSQL storage**: Reliable data persistence
- **TypeScript**: Type-safe and maintainable
- **Comprehensive tests**: 80%+ code coverage

## 🔒 Security & Privacy

- **External user protection**: Users from other Slack workspaces (via Slack Connect) are automatically blocked
- **No message content storage**: Only stores links to messages, not the content itself
- **Input validation**: All user input is sanitized
- **Rate limiting**: Prevents abuse (60 requests/minute per user)
- **Workspace isolation**: Investigations are completely isolated to your workspace

## 🛠️ Configuration Options

### Environment Variables

| Variable                      | Required | Description                                    |
| ----------------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string                   |
| `SLACK_BOT_TOKEN`             | Yes      | Bot user OAuth token                           |
| `SLACK_SIGNING_SECRET`        | Yes      | App signing secret                             |
| `SLACK_APP_TOKEN`             | Yes      | Socket mode app token                          |
| `POTENTIAL_ISSUES_CHANNEL_ID` | Yes      | Channel ID for investigation notifications     |
| `ALLOWED_WORKSPACE_IDS`       | No       | Comma-separated list of allowed workspace IDs  |
| `NODE_ENV`                    | No       | Set to `production` for production deployments |

### Customization

You can customize Trace by:

- Changing the notification channel (set `POTENTIAL_ISSUES_CHANNEL_ID`)
- Restricting to specific workspaces (set `ALLOWED_WORKSPACE_IDS`)
- Modifying the channel naming pattern in `src/utils/nameGenerator.ts`

## 📊 What Gets Tracked

### Comprehensive Audit Trail

Trace automatically tracks:

- **Investigation Timeline**

  - When created and by whom
  - Duration (time from creation to closure)
  - All linked events with timestamps
  - Status changes (investigating → escalated → closed)

- **Incident Details** (when escalated)

  - Who declared the incident
  - Incident commander assignments
  - Time to resolution
  - Who resolved it

- **Evidence Collection**
  - Every message added as evidence
  - Who added each piece of evidence
  - Original message location and timestamp
  - Direct links back to source messages

### Reporting Benefits

This tracking enables:

- **Accurate timelines**: Know exactly when issues started and actions were taken
- **Response metrics**: Measure time to detection, escalation, and resolution
- **Accountability**: Clear record of who did what and when
- **Learning**: Data-driven post-mortems with complete evidence trails
- **Compliance**: Audit trail for incident response procedures

### Privacy-Conscious Design

- Only stores message links, not content
- No PII beyond Slack user IDs
- All data confined to your workspace
- Investigations isolated in dedicated channels

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/agrieser/trace/issues)
- **Discussions**: [GitHub Discussions](https://github.com/agrieser/trace/discussions)

---

Built with ❤️ for incident responders who value organized, efficient investigations.
