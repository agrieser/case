import { App, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import { registerCommands } from './commands';
import { registerListeners } from './listeners';
import prisma from './db/client';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_APP_TOKEN',
  'DATABASE_URL'
] as const;

const missingVars: string[] = [];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in your .env file or environment.');
  console.error('See .env.example for the required format.');
  process.exit(1);
}

// Validate environment variable formats
if (!process.env.SLACK_BOT_TOKEN!.startsWith('xoxb-')) {
  console.error('❌ Invalid SLACK_BOT_TOKEN format. Should start with "xoxb-"');
  process.exit(1);
}

if (!process.env.SLACK_APP_TOKEN!.startsWith('xapp-')) {
  console.error('❌ Invalid SLACK_APP_TOKEN format. Should start with "xapp-"');
  process.exit(1);
}

if (!process.env.DATABASE_URL!.startsWith('postgresql://')) {
  console.error('❌ Invalid DATABASE_URL format. Should start with "postgresql://"');
  process.exit(1);
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
});

registerCommands(app, prisma);
registerListeners(app, prisma);

(async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    await app.start();
    console.log('⚡️ Case app is running!');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
  } catch (error) {
    console.error('❌ Failed to start app:', error);
    process.exit(1);
  }
})();