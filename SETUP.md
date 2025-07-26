# Trace - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Slack workspace with admin permissions

## Quick Start

1. **Clone and install dependencies**
   ```bash
   ./scripts/setup.sh
   ```

2. **Set up your Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From an app manifest"
   - Choose your workspace
   - Copy the contents of `manifest.yml` and paste it
   - Click "Create"

3. **Configure your app**
   - Go to "Basic Information" → "App-Level Tokens"
   - Create a token with `connections:write` scope
   - Copy the token (starts with `xapp-`)
   
   - Go to "OAuth & Permissions"
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)
   
   - Go to "Basic Information"
   - Copy the "Signing Secret"

4. **Update your .env file**
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   DATABASE_URL="postgresql://username:password@localhost:5432/trace?schema=public"
   ```

5. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   ```

6. **Start the app**
   ```bash
   npm run dev
   ```

## Testing the App

1. **Test basic functionality**
   ```
   /trace help
   ```

2. **Create an event**
   ```
   /trace event API response times increasing
   ```

3. **Start an investigation**
   ```
   /trace investigate [event-id]
   ```

4. **Declare an emergency**
   ```
   /trace emergency
   ```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run prisma:studio` - Open Prisma Studio to view database

## Deployment

The app is ready for deployment to:
- Vercel (with Serverless Functions)
- Railway
- Heroku
- Any Node.js hosting platform

Make sure to:
1. Set all environment variables
2. Run database migrations
3. Use `npm run build && npm start` for production