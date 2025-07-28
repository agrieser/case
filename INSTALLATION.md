# Detailed Installation Guide

This guide provides step-by-step instructions for installing Case in your Slack workspace.

## Prerequisites

Before you begin, ensure you have:

- **Slack workspace** with admin permissions
- **PostgreSQL database** (version 12 or higher)
- **Node.js** (version 18 or higher)
- **Git** for cloning the repository

## Step 1: Create the Slack App

### 1.1 Create App from Manifest

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From an app manifest"**
4. Choose your workspace
5. Select **"YAML"** format
6. Copy the entire contents of `manifest.yml` from this repository
7. Paste it into the text box
8. Click **"Next"** and review the configuration
9. Click **"Create"**

### 1.2 Install App to Workspace

1. On the app configuration page, go to **"Install App"**
2. Click **"Install to Workspace"**
3. Review and accept the permissions
4. You'll be redirected back to the app configuration

### 1.3 Collect Tokens

From the Slack app configuration page, collect these tokens:

1. **Bot User OAuth Token** (starts with `xoxb-`)

   - Found under **"OAuth & Permissions"**

2. **Signing Secret**

   - Found under **"Basic Information"** → **"App Credentials"**

3. **App-Level Token** (for Socket Mode)
   - Go to **"Basic Information"** → **"App-Level Tokens"**
   - Click **"Generate Token and Scopes"**
   - Name it (e.g., "socket-mode")
   - Add scope: `connections:write`
   - Click **"Generate"**
   - Copy the token (starts with `xapp-`)

### 1.4 Enable Socket Mode

1. Go to **"Socket Mode"** in the left sidebar
2. Toggle **"Enable Socket Mode"** to On
3. Select the app-level token you just created

## Step 2: Set Up the Database

### 2.1 Create PostgreSQL Database

```bash
# Using PostgreSQL command line
createdb case_production

# Or using psql
psql -U postgres -c "CREATE DATABASE case_production;"
```

### 2.2 Create Database User (Optional but recommended)

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create user and grant permissions
CREATE USER case_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE case_production TO case_user;
```

## Step 3: Configure the Application

### 3.1 Clone the Repository

```bash
git clone https://github.com/agrieser/case.git
cd case
```

### 3.2 Install Dependencies

```bash
npm install
```

### 3.3 Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://case_user:secure_password@localhost:5432/case_production"

# Slack Credentials (from Step 1.3)
SLACK_BOT_TOKEN="xoxb-your-bot-token"
SLACK_SIGNING_SECRET="your-signing-secret"
SLACK_APP_TOKEN="xapp-your-app-token"

# Required Configuration
ISSUES_CHANNEL_ID="C123456789"  # See below for how to find this

# Optional Configuration
NODE_ENV="production"
# INCIDENT_RESPONSE_GROUP_ID="S123456789"  # Optional: User group for incidents
# ALLOWED_WORKSPACE_IDS="T123456,T789012"  # Optional: Restrict to workspaces
# PAGERDUTY_ROUTING_KEY="your-32-char-routing-key"  # Optional: Enable PagerDuty integration
```

### 3.4 Find Your Issues Channel ID

To find the channel ID for notifications:

1. Open Slack in your browser
2. Navigate to the channel you want to use (e.g., #incidents)
3. Click the channel name at the top
4. Scroll down and click **"More"** → **"Additional options"**
5. The Channel ID is at the bottom (starts with C)

Alternatively, in Slack:

- Right-click the channel name
- Select **"View channel details"**
- The ID is shown at the bottom

### 3.5 Run Database Migrations

```bash
npm run prisma:migrate deploy
```

This creates all necessary database tables.

## Step 4: Deploy the Application

### 4.1 Build the Application

```bash
npm run build
```

### 4.2 Start the Application

For production:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### 4.3 Verify Installation

1. In Slack, type `/case help`
2. You should see the help message with available commands
3. Try creating a test investigation: `/case create Test investigation`

## Step 5: Production Deployment Options

### Option A: Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name case

# Save PM2 configuration
pm2 save
pm2 startup
```

### Option B: Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### Option C: Using systemd

Create `/etc/systemd/system/case.service`:

```ini
[Unit]
Description=Case Slack Bot
After=network.target

[Service]
Type=simple
User=case
WorkingDirectory=/opt/case
ExecStart=/usr/bin/node /opt/case/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Bot doesn't respond to commands

1. Check Socket Mode is enabled in Slack app settings
2. Verify the app-level token has `connections:write` scope
3. Check application logs for connection errors

### Database connection errors

1. Verify PostgreSQL is running: `pg_isready`
2. Check database exists: `psql -U postgres -l`
3. Test connection string: `psql "postgresql://...""`

### Permission errors

1. Ensure bot is installed to workspace
2. Verify all required scopes are present in manifest
3. Reinstall the app if permissions were changed

### Channel creation fails

1. Check bot has `channels:manage` permission
2. Verify workspace allows apps to create channels
3. Check for rate limiting in logs

## Optional: PagerDuty Integration

Case can automatically create and resolve PagerDuty incidents when investigations are escalated.

### Setting Up PagerDuty Integration

1. **Create PagerDuty Integration**
   - Log into your PagerDuty account
   - Navigate to your service
   - Go to **Integrations** tab
   - Click **"Add Integration"**
   - Select **"Events API V2"**
   - Copy the Integration Key (Routing Key)

2. **Configure Case**
   - Add to your `.env` file:
     ```bash
     PAGERDUTY_ROUTING_KEY="your-32-character-routing-key"
     ```
   - Restart the Case application

3. **How It Works**
   - When you run `/case incident`, a PagerDuty incident is automatically triggered
   - When you run `/case resolve`, the PagerDuty incident is automatically resolved
   - Check status with `/case status` in any investigation channel
   - PagerDuty failures don't block Case operations

## Next Steps

- Configure incident response team: Set `INCIDENT_RESPONSE_GROUP_ID`
- Enable PagerDuty integration: Set `PAGERDUTY_ROUTING_KEY`
- Set up monitoring for the application
- Configure log aggregation
- Set up database backups
- Review [SECURITY.md](SECURITY.md) for security best practices

## Getting Help

- Check application logs: `npm run logs`
- Join our [Discussions](https://github.com/agrieser/case/discussions)
- Report issues: [GitHub Issues](https://github.com/agrieser/case/issues)
