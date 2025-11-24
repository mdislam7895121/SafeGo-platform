import { PrismaClient, EarningsStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Decimal = Prisma.Decimal;

interface CommissionCalculation {
  baseCommission: Decimal;
  categoryCommission: Decimal | null;
  totalCommission: Decimal;
  netEarnings: Decimal;
  baseCommissionRuleId: string | null;
  categoryCommissionRuleId: string | null;
  commissionRate: number;
}

interface OrderEarningsData {
  orderId: string;
  restaurantId: string;
  serviceFare: Decimal;
  orderStatus: string;
  countryCode: string;
  currency: string;
  isDemo: boolean;
  categoryId?: string;
}

export async function calculateCommission(
  orderData: OrderEarningsData
): Promise<CommissionCalculation> {
  const { restaurantId, serviceFare, categoryId } = orderData;

  const serviceFareNum = Number(serviceFare);

  const baseRule = await prisma.commissionRule.findFirst({
    where: {
      restaurantId,
      categoryId: null,
      isActive: true,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!baseRule) {
    const globalRule = await prisma.commissionRule.findFirst({
      where: {
        restaurantId: null,
        categoryId: null,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!globalRule) {
      throw new Error(
        'No commission rule found. Please contact support.'
      );
    }

    const baseCommissionAmount = new Decimal(
      (serviceFareNum * Number(globalRule.commissionRate)) / 100
    );
    const netEarnings = new Decimal(serviceFareNum).minus(baseCommissionAmount);

    return {
      baseCommission: baseCommissionAmount,
      categoryCommission: null,
      totalCommission: baseCommissionAmount,
      netEarnings,
      baseCommissionRuleId: globalRule.id,
      categoryCommissionRuleId: null,
      commissionRate: Number(globalRule.commissionRate),
    };
  }

  const baseCommissionAmount = new Decimal(
    (serviceFareNum * Number(baseRule.commissionRate)) / 100
  );

  let categoryCommissionAmount: Decimal | null = null;
  let categoryRuleId: string | null = null;

  if (categoryId) {
    const categoryRule = await prisma.commissionRule.findFirst({
      where: {
        restaurantId,
        categoryId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (categoryRule) {
      categoryCommissionAmount = new Decimal(
        (serviceFareNum * Number(categoryRule.commissionRate)) / 100
      );
      categoryRuleId = categoryRule.id;
    }
  }

  const totalCommission = categoryCommissionAmount
    ? baseCommissionAmount.plus(categoryCommissionAmount)
    : baseCommissionAmount;

  const netEarnings = new Decimal(serviceFareNum).minus(totalCommission);

  return {
    baseCommission: baseCommissionAmount,
    categoryCommission: categoryCommissionAmount,
    totalCommission,
    netEarnings,
    baseCommissionRuleId: baseRule.id,
    categoryCommissionRuleId: categoryRuleId,
    commissionRate: Number(baseRule.commissionRate),
  };
}

export async function createEarningsTransaction(
  orderData: OrderEarningsData
): Promise<void> {
  const {
    orderId,
    restaurantId,
    serviceFare,
    orderStatus,
    countryCode,
    currency,
    isDemo,
  } = orderData;

  const existing = await prisma.earningsTransaction.findUnique({
    where: { orderId },
  });

  if (existing) {
    return;
  }

  const commission = await calculateCommission(orderData);

  const status: EarningsStatus =
    orderStatus === 'delivered' ? 'cleared' : 'pending';

  await prisma.earningsTransaction.create({
    data: {
      restaurantId,
      orderId,
      orderStatus,
      grossAmount: serviceFare,
      serviceFare,
      baseCommission: commission.baseCommission,
      categoryCommission: commission.categoryCommission,
      totalCommission: commission.totalCommission,
      netEarnings: commission.netEarnings,
      status,
      clearedAt: status === 'cleared' ? new Date() : null,
      commissionRuleId: commission.baseCommissionRuleId,
      categoryCommissionRuleId: commission.categoryCommissionRuleId,
      countryCode,
      currency,
      isDemo,
    },
  });
}

export async function updateEarningsTransactionStatus(
  orderId: string,
  newOrderStatus: string
): Promise<void> {
  const transaction = await prisma.earningsTransaction.findUnique({
    where: { orderId },
  });

  if (!transaction) {
    return;
  }

  const updateData: any = {
    orderStatus: newOrderStatus,
    updatedAt: new Date(),
  };

  if (newOrderStatus === 'delivered' && transaction.status === 'pending') {
    updateData.status = 'cleared';
    updateData.clearedAt = new Date();
  }

  if (
    newOrderStatus === 'cancelled_restaurant' ||
    newOrderStatus === 'cancelled_customer' ||
    newOrderStatus === 'cancelled_driver'
  ) {
    updateData.status = 'refunded';
    updateData.refundedAt = new Date();
  }

  await prisma.earningsTransaction.update({
    where: { orderId },
    data: updateData,
  });
}

export async function getRestaurantEarningsSummary(restaurantId: string) {
  const transactions = await prisma.earningsTransaction.findMany({
    where: { restaurantId },
  });

  const totalEarnings = transactions.reduce(
    (sum, t) => sum.plus(t.netEarnings),
    new Decimal(0)
  );

  const pendingEarnings = transactions
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum.plus(t.netEarnings), new Decimal(0));

  const clearedEarnings = transactions
    .filter((t) => t.status === 'cleared')
    .reduce((sum, t) => sum.plus(t.netEarnings), new Decimal(0));

  const totalCommission = transactions.reduce(
    (sum, t) => sum.plus(t.totalCommission),
    new Decimal(0)
  );

  const refundedAmount = transactions
    .filter((t) => t.status === 'refunded')
    .reduce((sum, t) => sum.plus(t.netEarnings), new Decimal(0));

  return {
    totalEarnings: Number(totalEarnings),
    pendingEarnings: Number(pendingEarnings),
    clearedEarnings: Number(clearedEarnings),
    totalCommission: Number(totalCommission),
    refundedAmount: Number(refundedAmount),
    totalOrders: transactions.length,
  };
}

export async function getEarningsTimeline(
  restaurantId: string,
  limit: number = 50,
  offset: number = 0
) {
  const transactions = await prisma.earningsTransaction.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      order: {
        select: {
          id: true,
          orderCode: true,
          status: true,
          createdAt: true,
          deliveredAt: true,
          items: true,
        },
      },
    },
  });

  const total = await prisma.earningsTransaction.count({
    where: { restaurantId },
  });

  return {
    transactions,
    total,
    limit,
    offset,
  };
}
