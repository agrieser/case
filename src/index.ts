import { App, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import { registerCommands } from './commands';
import { registerListeners } from './listeners';
import prisma from './db/client';

dotenv.config();

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
  await app.start();
  console.log('⚡️ Trace app is running!');
})();