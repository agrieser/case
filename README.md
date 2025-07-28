# Case - Slack Incident Management

A lightweight Slack app that helps teams track the flow from events → investigations → incidents, with each investigation getting its own dedicated Slack channel.

## 🎯 Quick Demo

See Case in action - here's how it works:

### 1. Something happens (alert fires, customer complains, metrics spike)

```
/case open API response times increasing
```

→ Opens `#case-api-respons-a3f` channel and adds you to it

### 2. Collect evidence by right-clicking any message

Right-click any Slack message → "Collect Evidence" → Links it to your investigation channel

### 3. If it's serious, escalate to incident

```
/case incident
```

→ You're now the incident commander, team gets notified

### 4. When service is restored

```
/case resolve
```

→ Incident resolved, but investigation stays open for follow-up

### 5. After completing post-mortem

```
/case close
```

→ Archives the channel, complete audit trail preserved

**That's it!** Every action is tracked with who did what and when.

## ✨ Key Features

- **🔍 Dedicated Channels**: Each investigation gets its own channel (e.g., `#case-api-down-a3f`)
- **📎 Evidence Collection**: Right-click any message to add it as evidence
- **🚨 Smart Escalation**: Not every investigation needs to be an incident
- **📊 Full Reporting**: Export everything to CSV for analysis
- **🛡️ Secure**: Can't read your messages, only stores links
- **📈 Metrics**: Track MTTR, escalation rates, and team performance
- **🔔 PagerDuty Integration**: Automatically create and resolve PagerDuty incidents

## 🚀 Quick Start

### Prerequisites

- Slack workspace (admin access needed)
- PostgreSQL database
- Node.js 18+

### Installation

1. **Create Slack App**

   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From manifest"
   - Paste the manifest from `manifest.yml`
   - Install to your workspace

2. **Set up environment**

   ```bash
   # Required environment variables
   DATABASE_URL=postgresql://localhost/case_production
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   ISSUES_CHANNEL_ID=C123456789  # Your incidents channel
   ```

3. **Deploy**
   ```bash
   npm install
   npm run prisma:migrate deploy
   npm start
   ```

For detailed setup instructions, see [INSTALLATION.md](INSTALLATION.md).

## 📖 How to Use Case

### Commands Overview

All commands start with `/case`:

| Command                     | What it does                    | Where to use          |
| --------------------------- | ------------------------------- | --------------------- |
| `/case open [description]`  | Open new investigation          | Any channel           |
| `/case list`                | See active investigations       | Any channel           |
| `/case stats`               | View operational dashboard      | Any channel           |
| `/case export`              | Export all data to CSV          | Any channel           |
| `/case help`                | Show available commands         | Any channel           |
| `/case status`              | Show investigation details      | Investigation channel |
| `/case incident`            | Escalate to incident            | Investigation channel |
| `/case resolve`             | Mark incident resolved          | Investigation channel |
| `/case transfer @user`      | Transfer incident commander     | Investigation channel |
| `/case close`               | Close investigation             | Investigation channel |

### Typical Workflow Example

**Scenario**: Your monitoring alerts that API response times are degrading.

1. **Open Investigation** (2:45 PM)

   ```
   /case open API response times degrading
   ```

   - Opens `#case-api-respons-3f2` channel
   - Posts notification to your incidents channel
   - Investigation timer starts

2. **Gather Evidence** (2:46 PM - 2:55 PM)

   - Right-click the monitoring alert → "Collect Evidence"
   - Right-click customer complaint → "Collect Evidence"
   - Right-click relevant error logs → "Collect Evidence"
   - All evidence is linked in the investigation channel

3. **Escalate to Incident** (2:55 PM)

   ```
   /case incident
   ```

   - You become incident commander
   - Status changes to "escalated"
   - Incident response team auto-added (if configured)
   - PagerDuty incident automatically triggered (if configured)

4. **Resolve Incident** (3:30 PM)

   ```
   /case resolve
   ```

   - Incident marked resolved (35 min duration)
   - Investigation remains open for RCA
   - PagerDuty incident automatically resolved (if configured)

5. **Close Investigation** (Next day after post-mortem)
   ```
   /case close
   ```
   - Channel archived
   - Full timeline preserved
   - Data available for reporting

## 📚 Why Case? The Methodology

Case implements a proven incident management methodology:

### Events → Investigations → Incidents

**Not everything is an incident!** This is the core principle. Many issues can be investigated and resolved without triggering full incident response.

```mermaid
flowchart TD
    A[Event Occurs] --> B[Open Investigation]
    B --> C[Collect Evidence]
    C --> D{Assess Severity}

    D -->|Minor Issue| E[Fix & Close]
    D -->|Major Issue| F[Escalate to Incident]

    F --> G[Incident Response]
    G --> H[Resolve Incident]
    H --> I[Post-Mortem]
    I --> J[Close Investigation]
```

### Benefits

- **🎯 Focused Response**: Only real problems become incidents
- **📊 Better Metrics**: Track everything, not just declared incidents
- **🔍 Evidence-Based**: Collect data before making decisions
- **📝 Complete Records**: Every investigation has an audit trail
- **🧠 Learning Culture**: Easy post-mortems with all context preserved

## 🔒 Security & Privacy

### Zero Message Access Policy

**Case cannot read your messages.** We deliberately chose not to request message reading permissions:

- ✅ Only stores links to messages, not content
- ✅ No risk of exposing sensitive data
- ✅ Compliant with strict security policies
- ✅ External users automatically blocked

### Minimal Permissions

Case only requests:

- `commands` - Respond to slash commands
- `chat:write` - Post updates
- `channels:manage` - Create investigation channels
- `channels:join` - Join notification channel

No message reading, no user data access, no file access.

## 📊 Reporting & Analytics

Get insights into your incident management:

```
/case stats
```

Shows:

- Current active investigations and incidents
- 7-day activity (cases opened, time spent)
- Average resolution times
- Real-time operational status

```
/case export
```

Exports CSV with:

- All investigation details
- Incident timelines
- Resolution metrics
- Perfect for quarterly reviews

## 🔔 PagerDuty Integration

Case seamlessly integrates with PagerDuty to automate incident management:

1. **Set up**: Add your PagerDuty Events API V2 routing key to `PAGERDUTY_ROUTING_KEY`
2. **Automatic triggers**: When you run `/case incident`, PagerDuty incident is created
3. **Automatic resolution**: When you run `/case resolve`, PagerDuty incident is resolved
4. **Status tracking**: See PagerDuty status in `/case status` within investigation channels

No additional commands needed - it just works!

## 🛠️ Configuration

### Required Environment Variables

| Variable               | Description                  |
| ---------------------- | ---------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string |
| `SLACK_BOT_TOKEN`      | Bot OAuth token (xoxb-...)   |
| `SLACK_SIGNING_SECRET` | App signing secret           |
| `SLACK_APP_TOKEN`      | Socket mode token (xapp-...) |
| `ISSUES_CHANNEL_ID`    | Channel for notifications    |

### Optional Configuration

| Variable                     | Description                        |
| ---------------------------- | ---------------------------------- |
| `INCIDENT_RESPONSE_GROUP_ID` | User group auto-added to incidents |
| `ALLOWED_WORKSPACE_IDS`      | Restrict to specific workspaces    |
| `EXPORT_AUTHORIZED_USERS`    | Comma-separated Slack user IDs who can export data |
| `PAGERDUTY_ROUTING_KEY`      | Enable PagerDuty integration (32-char Events API V2 key) |

## 🏗️ Technical Details

- **Language**: TypeScript/Node.js
- **Database**: PostgreSQL with Prisma ORM
- **Slack Integration**: Bolt framework in socket mode
- **Architecture**: Stateless handlers, event-driven
- **Testing**: Jest with 80%+ coverage

For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/agrieser/case/issues)
- **Discussions**: [GitHub Discussions](https://github.com/agrieser/case/discussions)

---

Built with ❤️ for incident responders who value organized, efficient investigations.
