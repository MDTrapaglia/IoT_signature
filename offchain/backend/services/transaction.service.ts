import { prisma } from '../config/prisma.js';
import type { OracleTransactionStatus } from '@prisma/client';

export const transactionService = {
  async getAll(page = 1, limit = 100) {
    return await prisma.oracleTransaction.findMany({
      orderBy: { submitted_at: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { sensor: true }
    });
  },

  async getBySensor(sensor_id: string, limit = 100) {
    return await prisma.oracleTransaction.findMany({
      where: { sensor_id },
      orderBy: { submitted_at: 'desc' },
      take: limit,
      include: { sensor: true }
    });
  },

  async getByStatus(status: OracleTransactionStatus, limit = 100) {
    return await prisma.oracleTransaction.findMany({
      where: { status },
      orderBy: { submitted_at: 'desc' },
      take: limit,
      include: { sensor: true }
    });
  },

  async getRecent(limit = 10) {
    return await prisma.oracleTransaction.findMany({
      orderBy: { submitted_at: 'desc' },
      take: limit,
      include: { sensor: true }
    });
  },

  async getStatistics() {
    const [total, pending, confirmed, failed, retrying] = await Promise.all([
      prisma.oracleTransaction.count(),
      prisma.oracleTransaction.count({ where: { status: 'PENDING' } }),
      prisma.oracleTransaction.count({ where: { status: 'CONFIRMED' } }),
      prisma.oracleTransaction.count({ where: { status: 'FAILED' } }),
      prisma.oracleTransaction.count({ where: { status: 'RETRYING' } })
    ]);

    return { total, pending, confirmed, failed, retrying };
  }
};
