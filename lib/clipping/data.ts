import { prisma } from '@/lib/prisma';

// Read helpers for the Content Engine surfaces.

export async function listStrategies() {
  return prisma.clipStrategy.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      status: true,
      usedWebSearch: true,
      createdAt: true,
      contentSource: { select: { title: true, sourceType: true, guestName: true } },
      _count: { select: { clips: true } },
    },
  });
}

export async function getStrategy(id: string) {
  return prisma.clipStrategy.findUnique({
    where: { id },
    include: {
      contentSource: true,
      clips: {
        orderBy: { index: 'asc' },
        include: { ticket: { select: { id: true, title: true, prioStatus: true } } },
      },
    },
  });
}

export type StrategyDetail = NonNullable<Awaited<ReturnType<typeof getStrategy>>>;
export type StrategyListItem = Awaited<ReturnType<typeof listStrategies>>[number];
