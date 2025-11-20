import { PrismaClient, PayoutType, PayoutAccountStatus } from "@prisma/client";
import { z } from "zod";
import { encrypt, decrypt } from "../utils/encryption";

const prisma = new PrismaClient();

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) {
    return "*".repeat(accountNumber.length);
  }
  const last4 = accountNumber.slice(-4);
  const masked = "*".repeat(Math.min(accountNumber.length - 4, 8));
  return masked + last4;
}

interface PayoutDetails {
  accountNumber?: string;
  routingNumber?: string;
  bankName?: string;
  mobileNumber?: string;
  stripeAccountId?: string;
  [key: string]: any;
}

export const createPayoutAccountSchema = z.object({
  ownerType: z.enum(["driver", "restaurant"]),
  ownerId: z.string(),
  countryCode: z.enum(["BD", "US"]),
  payoutType: z.enum(["mobile_wallet", "bank_account", "stripe_connect", "manual"]),
  provider: z.string().optional(),
  displayName: z.string().min(1),
  accountHolderName: z.string().min(1),
  isDefault: z.boolean().optional(),
  details: z.object({
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    bankName: z.string().optional(),
    mobileNumber: z.string().optional(),
    stripeAccountId: z.string().optional(),
  }),
});

export const updatePayoutAccountSchema = z.object({
  displayName: z.string().min(1).optional(),
  accountHolderName: z.string().min(1).optional(),
  status: z.enum(["pending_verification", "active", "inactive"]).optional(),
  details: z.object({
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    bankName: z.string().optional(),
    mobileNumber: z.string().optional(),
    stripeAccountId: z.string().optional(),
  }).optional(),
});

export type CreatePayoutAccountInput = z.infer<typeof createPayoutAccountSchema>;
export type UpdatePayoutAccountInput = z.infer<typeof updatePayoutAccountSchema>;

function validateCountrySpecificRules(input: CreatePayoutAccountInput): void {
  const { countryCode, payoutType, provider, details } = input;

  if (countryCode === "BD") {
    if (payoutType === "mobile_wallet") {
      if (!provider || !["bkash", "nagad"].includes(provider.toLowerCase())) {
        throw new Error("For BD mobile wallets, provider must be 'bkash' or 'nagad'");
      }
      if (!details.mobileNumber) {
        throw new Error("Mobile number is required for mobile wallet");
      }
    } else if (payoutType === "bank_account") {
      if (!details.accountNumber || !details.bankName) {
        throw new Error("Account number and bank name are required for BD bank accounts");
      }
    }
  } else if (countryCode === "US") {
    if (payoutType === "bank_account") {
      if (!details.accountNumber || !details.routingNumber) {
        throw new Error("Account number and routing number are required for US bank accounts");
      }
    } else if (payoutType === "stripe_connect") {
      if (!details.stripeAccountId) {
        throw new Error("Stripe account ID is required for Stripe Connect");
      }
    }
  }
}

export async function createPayoutAccount(input: CreatePayoutAccountInput) {
  const validated = createPayoutAccountSchema.parse(input);
  
  validateCountrySpecificRules(validated);

  const accountIdentifier =
    validated.details.accountNumber ||
    validated.details.mobileNumber ||
    validated.details.stripeAccountId ||
    "N/A";

  const maskedAccount = maskAccountNumber(accountIdentifier);

  const encryptedDetails = encrypt(JSON.stringify(validated.details));

  if (validated.isDefault) {
    await prisma.payoutAccount.updateMany({
      where: {
        ownerType: validated.ownerType,
        ownerId: validated.ownerId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  const payoutAccount = await prisma.payoutAccount.create({
    data: {
      ownerType: validated.ownerType,
      ownerId: validated.ownerId,
      countryCode: validated.countryCode,
      payoutType: validated.payoutType,
      provider: validated.provider || null,
      displayName: validated.displayName,
      accountHolderName: validated.accountHolderName,
      maskedAccount,
      encryptedDetails,
      isDefault: validated.isDefault || false,
      status: PayoutAccountStatus.pending_verification,
    },
  });

  return sanitizePayoutAccount(payoutAccount);
}

export async function updatePayoutAccount(id: string, input: UpdatePayoutAccountInput) {
  const validated = updatePayoutAccountSchema.parse(input);

  const existingAccount = await prisma.payoutAccount.findUnique({
    where: { id },
  });

  if (!existingAccount) {
    throw new Error("Payout account not found");
  }

  let encryptedDetails = existingAccount.encryptedDetails;
  let maskedAccount = existingAccount.maskedAccount;

  if (validated.details) {
    const currentDetails = JSON.parse(decrypt(existingAccount.encryptedDetails));
    const updatedDetails = { ...currentDetails, ...validated.details };
    encryptedDetails = encrypt(JSON.stringify(updatedDetails));

    const accountIdentifier =
      updatedDetails.accountNumber ||
      updatedDetails.mobileNumber ||
      updatedDetails.stripeAccountId ||
      "N/A";
    maskedAccount = maskAccountNumber(accountIdentifier);
  }

  const updatedAccount = await prisma.payoutAccount.update({
    where: { id },
    data: {
      displayName: validated.displayName,
      accountHolderName: validated.accountHolderName,
      status: validated.status,
      encryptedDetails,
      maskedAccount,
      updatedAt: new Date(),
    },
  });

  return sanitizePayoutAccount(updatedAccount);
}

export async function setDefaultPayoutAccount(
  ownerType: "driver" | "restaurant",
  ownerId: string,
  payoutAccountId: string
) {
  const account = await prisma.payoutAccount.findUnique({
    where: { id: payoutAccountId },
  });

  if (!account) {
    throw new Error("Payout account not found");
  }

  if (account.ownerType !== ownerType || account.ownerId !== ownerId) {
    throw new Error("Payout account does not belong to this owner");
  }

  await prisma.$transaction([
    prisma.payoutAccount.updateMany({
      where: {
        ownerType,
        ownerId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    }),
    prisma.payoutAccount.update({
      where: { id: payoutAccountId },
      data: {
        isDefault: true,
      },
    }),
  ]);

  const updatedAccount = await prisma.payoutAccount.findUnique({
    where: { id: payoutAccountId },
    select: SAFE_PAYOUT_ACCOUNT_SELECT,
  });

  return updatedAccount;
}

const SAFE_PAYOUT_ACCOUNT_SELECT = {
  id: true,
  ownerType: true,
  ownerId: true,
  countryCode: true,
  payoutType: true,
  provider: true,
  displayName: true,
  accountHolderName: true,
  maskedAccount: true,
  isDefault: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  encryptedDetails: false,
} as const;

function sanitizePayoutAccount(account: any) {
  const { encryptedDetails, ...safeData } = account;
  return safeData;
}

export async function listPayoutAccounts(ownerType: "driver" | "restaurant", ownerId: string) {
  const accounts = await prisma.payoutAccount.findMany({
    where: {
      ownerType,
      ownerId,
    },
    select: SAFE_PAYOUT_ACCOUNT_SELECT,
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" },
    ],
  });

  return accounts;
}

export async function getDefaultPayoutAccount(ownerType: "driver" | "restaurant", ownerId: string) {
  const account = await prisma.payoutAccount.findFirst({
    where: {
      ownerType,
      ownerId,
      isDefault: true,
      status: PayoutAccountStatus.active,
    },
    select: SAFE_PAYOUT_ACCOUNT_SELECT,
  });

  return account;
}

export async function getPayoutAccount(id: string) {
  const account = await prisma.payoutAccount.findUnique({
    where: { id },
    select: SAFE_PAYOUT_ACCOUNT_SELECT,
  });

  return account;
}

import type {
  WalletOwnerType,
  PayoutMethod,
  PayoutStatus,
} from "@prisma/client";
import { walletService } from "./walletService";

export interface CreateWalletPayoutParams {
  ownerId: string;
  ownerType: WalletOwnerType;
  amount: number;
  method: PayoutMethod;
  scheduledAt?: Date;
  createdByAdminId?: string;
}

export interface UpdateWalletPayoutStatusParams {
  payoutId: string;
  status: PayoutStatus;
  failureReason?: string;
  externalReferenceId?: string;
  processedByAdminId?: string;
}

export class WalletPayoutService {
  async createWalletPayout(params: CreateWalletPayoutParams) {
    const {
      ownerId,
      ownerType,
      amount,
      method,
      scheduledAt,
      createdByAdminId,
    } = params;

    if (amount <= 0) {
      throw new Error("Payout amount must be greater than zero");
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: {
          ownerId_ownerType: {
            ownerId,
            ownerType,
          },
        },
      });

      if (!wallet) {
        throw new Error(`Wallet not found for ${ownerType} ${ownerId}`);
      }

      const availableBalance = parseFloat(wallet.availableBalance.toString());
      const negativeBalance = parseFloat(wallet.negativeBalance.toString());

      if (negativeBalance > 0) {
        throw new Error(
          `Cannot process payout. Outstanding commission debt of ${negativeBalance.toFixed(2)} ${wallet.currency} must be settled first. Available balance: ${availableBalance.toFixed(2)}`
        );
      }

      if (availableBalance < amount) {
        throw new Error(
          `Insufficient balance. Available: ${availableBalance}, Requested: ${amount}`
        );
      }

      const newAvailableBalance = availableBalance - amount;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: newAvailableBalance,
        },
      });

      const payout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          countryCode: wallet.countryCode,
          ownerType,
          ownerId,
          amount,
          method,
          status: "pending",
          scheduledAt,
          createdByAdminId,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType,
          countryCode: wallet.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount,
          balanceSnapshot: newAvailableBalance,
          negativeBalanceSnapshot: wallet.negativeBalance,
          referenceType: "payout",
          referenceId: payout.id,
          description: `Payout request: ${amount.toFixed(2)} ${wallet.currency}`,
          createdByAdminId,
        },
      });

      return payout;
    });
  }

  async updateWalletPayoutStatus(params: UpdateWalletPayoutStatusParams) {
    const {
      payoutId,
      status,
      failureReason,
      externalReferenceId,
      processedByAdminId,
    } = params;

    return await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      if (payout.status === "completed") {
        throw new Error("Cannot modify a completed payout");
      }

      if (status === "failed" && payout.status !== "completed") {
        const wallet = await tx.wallet.findUnique({
          where: { id: payout.walletId },
        });

        if (!wallet) {
          throw new Error(`Wallet ${payout.walletId} not found`);
        }

        const refundAmount = parseFloat(payout.amount.toString());
        const newAvailableBalance = parseFloat(wallet.availableBalance.toString()) + refundAmount;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: newAvailableBalance,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            ownerType: payout.ownerType,
            countryCode: payout.countryCode,
            serviceType: "adjustment",
            direction: "credit",
            amount: payout.amount,
            balanceSnapshot: newAvailableBalance,
            negativeBalanceSnapshot: wallet.negativeBalance,
            referenceType: "payout",
            referenceId: payout.id,
            description: `Payout failed - refund: ${refundAmount.toFixed(2)} ${wallet.currency}`,
            createdByAdminId: processedByAdminId,
          },
        });
      }

      const updatedPayout = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status,
          failureReason: status === "failed" ? failureReason : null,
          externalReferenceId,
          processedAt: status === "completed" || status === "failed" ? new Date() : null,
        },
      });

      return updatedPayout;
    });
  }

  async getWalletPayoutById(payoutId: string) {
    return prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        wallet: true,
      },
    });
  }

  async listWalletPayouts(filters?: {
    ownerType?: WalletOwnerType;
    ownerId?: string;
    status?: PayoutStatus;
    countryCode?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    if (filters?.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return prisma.payout.findMany({
      where,
      include: {
        wallet: true,
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  }

  async getWalletPayoutCount(filters?: {
    ownerType?: WalletOwnerType;
    ownerId?: string;
    status?: PayoutStatus;
    countryCode?: string;
  }): Promise<number> {
    const where: any = {};

    if (filters?.ownerType) {
      where.ownerType = filters.ownerType;
    }

    if (filters?.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.countryCode) {
      where.countryCode = filters.countryCode;
    }

    return prisma.payout.count({ where });
  }

  async getPendingWalletPayoutsByOwner(ownerId: string, ownerType: WalletOwnerType) {
    return prisma.payout.findMany({
      where: {
        ownerId,
        ownerType,
        status: {
          in: ["pending", "processing"],
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTotalPayoutAmountByOwner(
    ownerId: string,
    ownerType: WalletOwnerType
  ): Promise<number> {
    const payouts = await prisma.payout.findMany({
      where: {
        ownerId,
        ownerType,
        status: "completed",
      },
      select: {
        amount: true,
      },
    });

    return payouts.reduce((sum, payout) => sum + parseFloat(payout.amount.toString()), 0);
  }
}

export const walletPayoutService = new WalletPayoutService();
