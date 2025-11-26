import { db } from "../db";
import { encryptSensitive, decryptSensitive, maskSensitive } from "../utils/crypto";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import { z } from "zod";
import { BankAccountType } from "@shared/types";

const prisma = db;

const bankAccountTypeValues = Object.values(BankAccountType) as [string, ...string[]];

export const createPayoutMethodSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  countryCode: z.enum(["US", "BD"], { required_error: "Country code is required" }),
  payoutType: z.enum(["mobile_wallet", "bank_account", "stripe_connect"], { required_error: "Payout type is required" }),
  provider: z.string().min(1, "Provider is required for mobile wallets").optional(),
  accountHolderName: z.string().min(2, "Account holder name must be at least 2 characters").max(100, "Account holder name too long"),
  accountNumber: z.string().max(50, "Account number too long").optional(),
  routingNumber: z.string().min(9, "Routing number must be at least 9 digits").max(9, "Routing number must be 9 digits").regex(/^\d{9}$/, "Routing number must be 9 digits").optional(),
  bankName: z.string().min(2, "Bank name must be at least 2 characters").max(100, "Bank name too long").optional(),
  accountType: z.enum(bankAccountTypeValues, { required_error: "Account type is required for bank accounts" }).optional(),
}).refine((data) => {
  if (data.payoutType === "mobile_wallet" && !data.provider) {
    return false;
  }
  if (data.payoutType === "bank_account") {
    if (!data.accountNumber || data.accountNumber.length < 4) return false;
    if (!data.accountType) return false;
    if (data.countryCode === "US" && !data.routingNumber) return false;
  }
  return true;
}, {
  message: "Invalid payout method configuration. Bank accounts require account number and account type.",
});

export type CreatePayoutMethodInput = z.infer<typeof createPayoutMethodSchema>;

export interface UpdatePayoutMethodInput {
  accountHolderName?: string;
  accountNumber?: string;
  routingNumber?: string;
}

/**
 * List all payout methods for a driver
 * Returns masked account numbers for security
 */
export async function listPayoutMethods(userId: string, countryCode: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!driverProfile) {
    throw new Error("Driver profile not found");
  }

  const payoutAccounts = await prisma.payoutAccount.findMany({
    where: {
      ownerType: "driver",
      ownerId: driverProfile.id,
    },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" },
    ],
  });

  return payoutAccounts.map((account) => ({
    id: account.id,
    type: account.payoutType,
    provider: account.provider,
    displayName: account.displayName,
    accountHolderName: account.accountHolderName,
    maskedAccount: account.maskedAccount,
    countryCode: account.countryCode,
    isDefault: account.isDefault,
    status: account.status,
    createdAt: account.createdAt,
  }));
}

/**
 * Get a specific payout method with decrypted details (for editing)
 * Only returns to the owner
 */
export async function getPayoutMethod(methodId: string, userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!driverProfile) {
    throw new Error("Driver profile not found");
  }

  const account = await prisma.payoutAccount.findFirst({
    where: {
      id: methodId,
      ownerType: "driver",
      ownerId: driverProfile.id,
    },
  });

  if (!account) {
    throw new Error("Payout method not found or access denied");
  }

  let accountNumber: string | null = null;
  let routingNumber: string | null = null;

  try {
    if (account.accountNumber_encrypted) {
      accountNumber = decryptSensitive(account.accountNumber_encrypted);
    }
    if (account.routingNumber_encrypted) {
      routingNumber = decryptSensitive(account.routingNumber_encrypted);
    }
  } catch (error) {
    console.error("Failed to decrypt payout method details:", error);
    throw new Error("Failed to retrieve payout method details");
  }

  return {
    id: account.id,
    type: account.payoutType,
    provider: account.provider,
    displayName: account.displayName,
    accountHolderName: account.accountHolderName,
    accountNumber,
    routingNumber,
    countryCode: account.countryCode,
    isDefault: account.isDefault,
    status: account.status,
  };
}

/**
 * Create a new payout method
 */
export async function createPayoutMethod(input: CreatePayoutMethodInput) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: input.userId },
  });

  if (!driverProfile) {
    throw new Error("Driver profile not found");
  }

  // Check if this is the first payout method
  const existingMethods = await prisma.payoutAccount.count({
    where: {
      ownerType: "driver",
      ownerId: driverProfile.id,
    },
  });

  const isFirstMethod = existingMethods === 0;

  // Encrypt sensitive data
  const accountNumberEncrypted = input.accountNumber 
    ? encryptSensitive(input.accountNumber)
    : null;
  const routingNumberEncrypted = input.routingNumber
    ? encryptSensitive(input.routingNumber)
    : null;

  // Create masked account number for display
  const maskedAccount = input.accountNumber 
    ? maskSensitive(input.accountNumber, 4)
    : "";

  // Generate display name
  let displayName = "";
  if (input.payoutType === "mobile_wallet" && input.provider) {
    displayName = `${input.provider.charAt(0).toUpperCase() + input.provider.slice(1)} ${maskedAccount}`;
  } else if (input.payoutType === "bank_account") {
    const bankName = input.bankName || "Bank Account";
    displayName = `${bankName} ${maskedAccount}`;
  } else if (input.payoutType === "stripe_connect") {
    displayName = "Stripe Connect";
  }

  // Create encrypted details JSON
  const encryptedDetails = JSON.stringify({
    accountNumber: accountNumberEncrypted,
    routingNumber: routingNumberEncrypted,
    bankName: input.bankName,
    accountType: input.accountType,
  });

  const payoutAccount = await prisma.payoutAccount.create({
    data: {
      ownerType: "driver",
      ownerId: driverProfile.id,
      countryCode: input.countryCode,
      payoutType: input.payoutType,
      provider: input.provider || (input.payoutType === "stripe_connect" ? "stripe" : null),
      displayName,
      accountHolderName: input.accountHolderName,
      maskedAccount,
      encryptedDetails,
      accountNumber_encrypted: accountNumberEncrypted || "",
      routingNumber_encrypted: routingNumberEncrypted,
      accountType: input.accountType,
      bankName: input.bankName,
      isDefault: isFirstMethod,
      status: input.payoutType === "stripe_connect" ? "pending_verification" : "active",
    },
  });

  await logAuditEvent({
    actorId: input.userId,
    actorEmail: "",
    actorRole: "driver",
    ipAddress: "",
    actionType: ActionType.CREATE,
    entityType: EntityType.PAYOUT_ACCOUNT,
    entityId: payoutAccount.id,
    description: `Driver created new ${input.payoutType} payout method`,
    success: true,
  });

  return {
    id: payoutAccount.id,
    type: payoutAccount.payoutType,
    provider: payoutAccount.provider,
    displayName: payoutAccount.displayName,
    accountHolderName: payoutAccount.accountHolderName,
    maskedAccount: payoutAccount.maskedAccount,
    countryCode: payoutAccount.countryCode,
    isDefault: payoutAccount.isDefault,
    status: payoutAccount.status,
  };
}

/**
 * Set a payout method as default
 */
export async function setDefaultPayoutMethod(methodId: string, userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!driverProfile) {
    throw new Error("Driver profile not found");
  }

  // Verify ownership
  const account = await prisma.payoutAccount.findFirst({
    where: {
      id: methodId,
      ownerType: "driver",
      ownerId: driverProfile.id,
    },
  });

  if (!account) {
    throw new Error("Payout method not found or access denied");
  }

  // Update in transaction to ensure atomicity
  await prisma.$transaction([
    // Unset current default
    prisma.payoutAccount.updateMany({
      where: {
        ownerType: "driver",
        ownerId: driverProfile.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    }),
    // Set new default
    prisma.payoutAccount.update({
      where: { id: methodId },
      data: { isDefault: true },
    }),
  ]);

  await logAuditEvent({
    actorId: userId,
    actorEmail: "",
    actorRole: "driver",
    ipAddress: "",
    actionType: ActionType.UPDATE,
    entityType: EntityType.PAYOUT_ACCOUNT,
    entityId: methodId,
    description: "Driver set payout method as default",
    success: true,
  });

  return { success: true };
}

/**
 * Delete a payout method (cannot delete default)
 */
export async function deletePayoutMethod(methodId: string, userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!driverProfile) {
    throw new Error("Driver profile not found");
  }

  const account = await prisma.payoutAccount.findFirst({
    where: {
      id: methodId,
      ownerType: "driver",
      ownerId: driverProfile.id,
    },
  });

  if (!account) {
    throw new Error("Payout method not found or access denied");
  }

  if (account.isDefault) {
    throw new Error("Cannot delete default payout method. Set another method as default first.");
  }

  await prisma.payoutAccount.delete({
    where: { id: methodId },
  });

  await logAuditEvent({
    actorId: userId,
    actorEmail: "",
    actorRole: "driver",
    ipAddress: "",
    actionType: ActionType.DELETE,
    entityType: EntityType.PAYOUT_ACCOUNT,
    entityId: methodId,
    description: "Driver deleted payout method",
    success: true,
  });

  return { success: true };
}
