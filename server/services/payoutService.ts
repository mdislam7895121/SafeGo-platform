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
