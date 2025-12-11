import { prisma } from "../db";

/**
 * Check if a user is a restaurant OWNER
 */
export async function isRestaurantOwner(userId: string): Promise<boolean> {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: { ownerRole: true },
  });

  return profile?.ownerRole === "OWNER" || !profile?.ownerRole; // Default to OWNER for backward compatibility
}

/**
 * Check if a user is a restaurant STAFF member
 */
export async function isRestaurantStaff(userId: string): Promise<boolean> {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: { ownerRole: true },
  });

  return profile?.ownerRole === "STAFF";
}

/**
 * Get restaurant ID for the given user (works for both OWNER and STAFF)
 */
export async function getRestaurantIdForUser(userId: string): Promise<string | null> {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: { id: true, ownerRole: true, managedByOwnerId: true },
  });

  if (!profile) return null;

  // If OWNER, return their own restaurant ID
  if (profile.ownerRole === "OWNER" || !profile.ownerRole) {
    return profile.id;
  }

  // If STAFF, return the owner's restaurant ID
  return profile.managedByOwnerId || null;
}

/**
 * Get all staff members for a restaurant OWNER
 */
export async function getStaffForOwner(ownerId: string) {
  return await prisma.restaurantProfile.findMany({
    where: {
      managedByOwnerId: ownerId,
      ownerRole: "STAFF",
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          isDemo: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Check if a staff member has a specific permission
 */
export async function hasStaffPermission(
  userId: string,
  permission: keyof Pick<
    {
      canEditCategories: boolean;
      canEditItems: boolean;
      canToggleAvailability: boolean;
      canUseBulkTools: boolean;
      canViewAnalytics: boolean;
      canViewPayouts: boolean;
      canManageOrders: boolean;
    },
    | "canEditCategories"
    | "canEditItems"
    | "canToggleAvailability"
    | "canUseBulkTools"
    | "canViewAnalytics"
    | "canViewPayouts"
    | "canManageOrders"
  >
): Promise<boolean> {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: {
      ownerRole: true,
      staffActive: true,
      canEditCategories: true,
      canEditItems: true,
      canToggleAvailability: true,
      canUseBulkTools: true,
      canViewAnalytics: true,
      canViewPayouts: true,
      canManageOrders: true,
    },
  });

  if (!profile) return false;

  // OWNERs have all permissions
  if (profile.ownerRole === "OWNER" || !profile.ownerRole) {
    return true;
  }

  // STAFF must be active and have the specific permission
  if (profile.ownerRole === "STAFF") {
    return profile.staffActive && (profile[permission] || false);
  }

  return false;
}

/**
 * Validate that a user can manage a specific staff member
 * (OWNER can only manage their own staff)
 */
export async function canManageStaff(ownerUserId: string, staffId: string): Promise<boolean> {
  const ownerProfile = await prisma.restaurantProfile.findUnique({
    where: { userId: ownerUserId },
    select: { id: true, ownerRole: true },
  });

  if (!ownerProfile || ownerProfile.ownerRole !== "OWNER") {
    return false;
  }

  const staffProfile = await prisma.restaurantProfile.findUnique({
    where: { id: staffId },
    select: { managedByOwnerId: true, ownerRole: true },
  });

  if (!staffProfile || staffProfile.ownerRole !== "STAFF") {
    return false;
  }

  // Check if the staff member belongs to this owner
  return staffProfile.managedByOwnerId === ownerProfile.id;
}

/**
 * Create a new staff member with temporary password
 */
export async function createStaffMember(
  ownerRestaurantId: string,
  staffData: {
    name: string;
    email: string;
    phone: string;
    temporaryPassword: string;
    permissions?: {
      canEditCategories?: boolean;
      canEditItems?: boolean;
      canToggleAvailability?: boolean;
      canUseBulkTools?: boolean;
      canViewAnalytics?: boolean;
      canViewPayouts?: boolean;
      canManageOrders?: boolean;
    };
  }
) {
  const bcrypt = await import("bcrypt");
  const hashedPassword = await bcrypt.hash(staffData.temporaryPassword, 10);

  // Get the owner's country code for KYC consistency
  const ownerProfile = await prisma.restaurantProfile.findUnique({
    where: { id: ownerRestaurantId },
    select: { countryCode: true, user: { select: { countryCode: true } } },
  });

  const countryCode = ownerProfile?.countryCode || ownerProfile?.user.countryCode || "US";

  // Create user and restaurant profile in a transaction
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: staffData.email,
        password: hashedPassword,
        role: "restaurant",
        name: staffData.name,
        phone: staffData.phone,
        countryCode,
        isDemo: false,
      },
    });

    const restaurantProfile = await tx.restaurantProfile.create({
      data: {
        userId: user.id,
        restaurantName: staffData.name, // Staff name as restaurant name
        address: "", // Will be populated from owner's restaurant
        ownerRole: "STAFF",
        managedByOwnerId: ownerRestaurantId,
        staffActive: true,
        countryCode,
        // Set permissions
        canEditCategories: staffData.permissions?.canEditCategories || false,
        canEditItems: staffData.permissions?.canEditItems || false,
        canToggleAvailability: staffData.permissions?.canToggleAvailability || false,
        canUseBulkTools: staffData.permissions?.canUseBulkTools || false,
        canViewAnalytics: staffData.permissions?.canViewAnalytics || false,
        canViewPayouts: staffData.permissions?.canViewPayouts || false,
        canManageOrders: staffData.permissions?.canManageOrders || false,
      },
    });

    // Create notification for staff to set permanent password
    await tx.notification.create({
      data: {
        userId: user.id,
        type: "alert",
        title: "Welcome to the Team",
        body: `You have been added as a staff member. Please change your temporary password after logging in.`,
      },
    });

    return { user, restaurantProfile };
  });
}

/**
 * Update staff member's last login time
 */
export async function updateStaffLastLogin(userId: string) {
  await prisma.restaurantProfile.update({
    where: { userId },
    data: { lastLoginAt: new Date() },
  });
}
