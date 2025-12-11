import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../utils/audit';
import {
  getRestaurantEarningsSummary,
  getEarningsTimeline,
} from '../services/earningsCommissionService';

const router = Router();

router.get(
  '/dashboard',
  authenticateToken,
  requireRole(['restaurant']),
  async (req: AuthRequest, res) => {
    try {
      const restaurantId = req.user!.restaurantProfile!.id;

      const summary = await getRestaurantEarningsSummary(restaurantId);

      const last30Days = await prisma.earningsTransaction.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const earningsOverTime = last30Days.reduce((acc, transaction) => {
        const date = transaction.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            netEarnings: 0,
            commission: 0,
            orders: 0,
          };
        }
        acc[date].netEarnings += Number(transaction.netEarnings);
        acc[date].commission += Number(transaction.totalCommission);
        acc[date].orders += 1;
        return acc;
      }, {} as Record<string, { date: string; netEarnings: number; commission: number; orders: number }>);

      const chartData = Object.values(earningsOverTime);

      const wallet = await prisma.restaurantWallet.findUnique({
        where: { restaurantId },
      });

      res.json({
        summary: {
          ...summary,
          walletBalance: wallet ? Number(wallet.currentBalance) : 0,
        },
        chartData,
      });
    } catch (error: any) {
      console.error('Error fetching earnings dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/timeline',
  authenticateToken,
  requireRole(['restaurant']),
  async (req: AuthRequest, res) => {
    try {
      const restaurantId = req.user!.restaurantProfile!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await getEarningsTimeline(restaurantId, limit, offset);

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching earnings timeline:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/export',
  authenticateToken,
  requireRole(['restaurant']),
  async (req: AuthRequest, res) => {
    try {
      const restaurantId = req.user!.restaurantProfile!.id;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const transactions = await prisma.earningsTransaction.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderCode: true,
              status: true,
              createdAt: true,
              deliveredAt: true,
            },
          },
        },
      });

      const csvHeader = [
        'Date',
        'Order Code',
        'Status',
        'Gross Amount',
        'Commission',
        'Net Earnings',
        'Earnings Status',
        'Delivered At',
      ].join(',');

      const csvRows = transactions.map((t) => {
        return [
          t.createdAt.toISOString().split('T')[0],
          t.order.orderCode || t.orderId,
          t.orderStatus,
          Number(t.grossAmount).toFixed(2),
          Number(t.totalCommission).toFixed(2),
          Number(t.netEarnings).toFixed(2),
          t.status,
          t.order.deliveredAt
            ? t.order.deliveredAt.toISOString().split('T')[0]
            : '-',
        ].join(',');
      });

      const csv = [csvHeader, ...csvRows].join('\n');

      await logAuditEvent(
        req.user!.id,
        'restaurant',
        'earnings_export',
        restaurantId,
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          transactionCount: transactions.length,
        }
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="earnings-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error('Error exporting earnings:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/statements/:month',
  authenticateToken,
  requireRole(['restaurant']),
  async (req: AuthRequest, res) => {
    try {
      const restaurantId = req.user!.restaurantProfile!.id;
      const month = req.params.month;

      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);

      const transactions = await prisma.earningsTransaction.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderCode: true,
              status: true,
              createdAt: true,
              deliveredAt: true,
            },
          },
        },
      });

      const totalGross = transactions.reduce(
        (sum, t) => sum + Number(t.grossAmount),
        0
      );
      const totalCommission = transactions.reduce(
        (sum, t) => sum + Number(t.totalCommission),
        0
      );
      const totalNet = transactions.reduce(
        (sum, t) => sum + Number(t.netEarnings),
        0
      );

      const pendingCount = transactions.filter(
        (t) => t.status === 'pending'
      ).length;
      const clearedCount = transactions.filter(
        (t) => t.status === 'cleared'
      ).length;
      const refundedCount = transactions.filter(
        (t) => t.status === 'refunded'
      ).length;

      res.json({
        month,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          totalOrders: transactions.length,
          totalGross,
          totalCommission,
          totalNet,
          pendingCount,
          clearedCount,
          refundedCount,
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          orderId: t.orderId,
          orderCode: t.order.orderCode || t.orderId,
          createdAt: t.createdAt,
          deliveredAt: t.order.deliveredAt,
          grossAmount: Number(t.grossAmount),
          commission: Number(t.totalCommission),
          netEarnings: Number(t.netEarnings),
          status: t.status,
          orderStatus: t.orderStatus,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching monthly statement:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
