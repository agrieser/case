import { PrismaClient } from '@prisma/client';

export async function getCurrentInvestigation(
  prisma: PrismaClient,
  channelId: string
): Promise<string | null> {
  const state = await prisma.channelState.findUnique({
    where: { channelId }
  });
  
  return state?.currentInvestigation || null;
}

export async function setCurrentInvestigation(
  prisma: PrismaClient,
  channelId: string,
  investigationName: string | null
): Promise<void> {
  await prisma.channelState.upsert({
    where: { channelId },
    create: {
      channelId,
      currentInvestigation: investigationName
    },
    update: {
      currentInvestigation: investigationName
    }
  });
}