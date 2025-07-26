import { beforeEach, afterAll } from '@jest/globals';
import prisma from '../db/client';

// Clean database between tests
beforeEach(async () => {
  // Use Prisma's transaction API for faster cleanup
  await prisma.$transaction([
    prisma.event.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.investigation.deleteMany(),
  ]);
});

// IMPORTANT: This is the key to preventing Jest from hanging
afterAll(async () => {
  await prisma.$disconnect();
});

// Use the same prisma instance from our app
export { prisma };
export default prisma;