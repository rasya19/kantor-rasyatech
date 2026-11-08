import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton untuk Kantor AI PT Rasyatech Digital Zenith
 * Dioptimalkan untuk PostgreSQL Serverless (Neon DB)
 * Mencegah koneksi berlebih (connection pool exhaustion) saat reload/re-render di Node.js/Express.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
export * from '@prisma/client';
