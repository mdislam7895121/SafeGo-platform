import { prisma } from "../db";

/**
 * Shared Support Helpers
 * Common utility functions for support center across all roles
 */

interface SupportContext {
  profileId: string;
  displayName: string;
  senderRole: string;
  isVerified: boolean;
  isSuspended: boolean;
}

/**
 * Get support context for driver
 */
export async function getDriverSupportContext(userId: string): Promise<SupportContext> {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      isVerified: true,
      verificationStatus: true,
      isSuspended: true
    }
  });

  if (!profile) {
    throw new Error("Driver profile not found");
  }

  if (!profile.isVerified || profile.verificationStatus !== "APPROVED") {
    throw new Error("Driver verification required to access support system");
  }

  if (profile.isSuspended) {
    throw new Error("Account suspended. Please contact support.");
  }

  return {
    profileId: profile.id,
    displayName: profile.fullName || "Driver",
    senderRole: "driver",
    isVerified: profile.isVerified,
    isSuspended: profile.isSuspended
  };
}

/**
 * Get support context for customer
 */
export async function getCustomerSupportContext(userId: string): Promise<SupportContext> {
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      isVerified: true,
      verificationStatus: true,
      isSuspended: true
    }
  });

  if (!profile) {
    throw new Error("Customer profile not found");
  }

  if (!profile.isVerified || profile.verificationStatus !== "APPROVED") {
    throw new Error("Customer verification required to access support system");
  }

  if (profile.isSuspended) {
    throw new Error("Account suspended. Please contact support.");
  }

  return {
    profileId: profile.id,
    displayName: profile.fullName || "Customer",
    senderRole: "customer",
    isVerified: profile.isVerified,
    isSuspended: profile.isSuspended
  };
}

/**
 * Get support context for admin
 */
export async function getAdminSupportContext(userId: string): Promise<SupportContext> {
  const [profile, user] = await Promise.all([
    prisma.adminProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        isActive: true,
        adminRole: true
      }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    })
  ]);

  if (!profile) {
    throw new Error("Admin profile not found");
  }

  if (!user) {
    throw new Error("User not found");
  }

  if (!profile.isActive) {
    throw new Error("Admin account inactive. Please contact system administrator.");
  }

  return {
    profileId: profile.id,
    displayName: user.email.split("@")[0] || "Admin", // Use email prefix as display name
    senderRole: "admin",
    isVerified: true, // Admins are always verified
    isSuspended: !profile.isActive
  };
}

/**
 * Get support context for restaurant (existing pattern)
 */
export async function getRestaurantSupportContext(
  userId: string, 
  requireOwner: boolean = false
): Promise<SupportContext & { ownerRole?: string }> {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      restaurantName: true,
      isVerified: true,
      verificationStatus: true,
      isSuspended: true,
      ownerRole: true,
      canReplySupport: true,
      staffActive: true
    }
  });

  if (!profile) {
    throw new Error("Restaurant profile not found");
  }

  if (!profile.isVerified || profile.verificationStatus !== "APPROVED") {
    throw new Error("Restaurant verification required to access support system");
  }

  // Check support access (OWNER or STAFF with permissions)
  const isOwner = !profile.ownerRole || profile.ownerRole === "OWNER";
  const hasStaffAccess = profile.ownerRole === "STAFF" && 
                         profile.canReplySupport && 
                         profile.staffActive && 
                         !profile.isSuspended;

  if (!isOwner && !hasStaffAccess) {
    throw new Error("You do not have permission to access support tickets");
  }

  if (requireOwner && !isOwner) {
    throw new Error("Only restaurant owners can perform this action");
  }

  if (profile.isSuspended) {
    throw new Error("Account suspended. Please contact support.");
  }

  return {
    profileId: profile.id,
    displayName: profile.restaurantName,
    senderRole: isOwner ? "restaurant_owner" : "restaurant_staff",
    isVerified: profile.isVerified,
    isSuspended: profile.isSuspended,
    ownerRole: profile.ownerRole || "OWNER"
  };
}
