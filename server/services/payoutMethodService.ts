import { db } from "../db";
import { encryptSensitive, decryptSensitive, maskSensitive } from "../utils/crypto";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";

const prisma = db;

export interface CreatePayoutMethodInput {
  userId: string;
  countryCode: string;
  payoutType: "mobile_wallet" | "bank_account";
  provider?: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber?: string;
  bankName?: string;
}

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
  const accountNumberEncrypted = encryptSensitive(input.accountNumber);
  const routingNumberEncrypted = input.routingNumber
    ? encryptSensitive(input.routingNumber)
    : null;

  // Create masked account number for display
  const maskedAccount = maskSensitive(input.accountNumber, 4);

  // Generate display name
  let displayName = "";
  if (input.payoutType === "mobile_wallet" && input.provider) {
    displayName = `${input.provider.charAt(0).toUpperCase() + input.provider.slice(1)} ${maskedAccount}`;
  } else if (input.payoutType === "bank_account") {
    const bankName = input.bankName || "Bank Account";
    displayName = `${bankName} ${maskedAccount}`;
  }

  // Create encrypted details JSON
  const encryptedDetails = JSON.stringify({
    accountNumber: accountNumberEncrypted,
    routingNumber: routingNumberEncrypted,
    bankName: input.bankName,
  });

  const payoutAccount = await prisma.payoutAccount.create({
    data: {
      ownerType: "driver",
      ownerId: driverProfile.id,
      countryCode: input.countryCode,
      payoutType: input.payoutType,
      provider: input.provider,
      displayName,
      accountHolderName: input.accountHolderName,
      maskedAccount,
      encryptedDetails,
      accountNumber_encrypted: accountNumberEncrypted,
      routingNumber_encrypted: routingNumberEncrypted,
      isDefault: isFirstMethod,
      status: "active",
    },
  });

  await logAuditEvent({
    actorId: input.userId,
    actorEmail: null,
    actorRole: "driver",
    ipAddress: null,
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
    actorEmail: null,
    actorRole: "driver",
    ipAddress: null,
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
    actorEmail: null,
    actorRole: "driver",
    ipAddress: null,
    actionType: ActionType.DELETE,
    entityType: EntityType.PAYOUT_ACCOUNT,
    entityId: methodId,
    description: "Driver deleted payout method",
    success: true,
  });

  return { success: true };
}
