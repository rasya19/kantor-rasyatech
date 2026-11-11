import { prisma } from '../lib/prisma';
import { checkBudget, OpenRouterError } from './openrouter';

export const approvedVideoBudgetIdr = 100_000;
const configId = 'global';

export async function getVideoRuntimeConfig() {
  return prisma.videoRuntimeConfig.upsert({
    where: { id: configId },
    create: { id: configId, enabled: false, approvedBudgetIdr: approvedVideoBudgetIdr },
    update: {},
    select: { enabled: true, approvedBudgetIdr: true, updatedAt: true },
  });
}

export async function setVideoEnabled(enabled: boolean) {
  if (enabled) {
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      throw new OpenRouterError('Atur OPENROUTER_API_KEY sebelum mengaktifkan video.', 503);
    }
    await checkBudget();
  }
  return prisma.$transaction(async (tx) => {
    const config = await tx.videoRuntimeConfig.upsert({
      where: { id: configId },
      create: { id: configId, enabled, approvedBudgetIdr: approvedVideoBudgetIdr },
      update: { enabled },
      select: { enabled: true, approvedBudgetIdr: true, updatedAt: true },
    });
    if (!enabled) {
      await tx.videoJob.updateMany({
        where: { status: 'QUEUED' },
        data: { status: 'CANCELLED', activeDraftId: null, error: 'Dibatalkan oleh admin sebelum video mulai diproses.' },
      });
    }
    return config;
  });
}

export async function videoEnabled(): Promise<boolean> {
  return (await getVideoRuntimeConfig()).enabled;
}
