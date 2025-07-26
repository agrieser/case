import { PrismaClient } from '@prisma/client';

export const createTestPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
};