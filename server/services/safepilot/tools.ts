import { prisma } from "../../lib/prisma";
import { Role, Country, getToolPermissions, getCountryRules } from "./rbac";

export interface ToolContext {
  userId: string;
  role: Role;
  country: Country;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  source: string;
}

export async function getRideStatus(
  ctx: ToolContext,
  rideId?: string
): Promise<ToolResult> {
  const permissions = getToolPermissions(ctx.role);
  
  if (!permissions.allowedTools.includes("read_ride_status")) {
    return {
      success: false,
      error: "You don't have permission to access ride status.",
      source: "rbac_check",
    };
  }

  try {
    const whereClause: any = {};
    
    if (ctx.role === "CUSTOMER") {
      whereClause.customerId = ctx.userId;
    } else if (ctx.role === "DRIVER") {
      whereClause.driverId = ctx.userId;
    }
    
    if (rideId) {
      whereClause.id = rideId;
    }

    const rides = await prisma.ride.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: rideId ? 1 : 5,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        serviceFare: true,
        driverPayout: true,
        createdAt: true,
        ...(ctx.role === "ADMIN" && {
          customerId: true,
          driverId: true,
        }),
      },
    });

    if (rides.length === 0) {
      return {
        success: true,
        data: { message: "No rides found.", rides: [] },
        source: "rides_table",
      };
    }

    return {
      success: true,
      data: {
        rides: rides.map((r) => ({
          id: r.id,
          status: r.status,
          pickup: r.pickupAddress,
          dropoff: r.dropoffAddress,
          fare: r.serviceFare?.toString(),
          driverPayout: r.driverPayout?.toString(),
          createdAt: r.createdAt,
        })),
      },
      source: "rides_table",
    };
  } catch (error) {
    console.error("[SafePilot Tools] getRideStatus error:", error);
    return {
      success: false,
      error: "Failed to retrieve ride status.",
      source: "database_error",
    };
  }
}

export async function getOrderStatus(
  ctx: ToolContext,
  orderId?: string
): Promise<ToolResult> {
  const permissions = getToolPermissions(ctx.role);
  
  if (!permissions.allowedTools.includes("read_order_status")) {
    return {
      success: false,
      error: "You don't have permission to access order status.",
      source: "rbac_check",
    };
  }

  try {
    const whereClause: any = {};
    
    if (ctx.role === "CUSTOMER") {
      whereClause.customerId = ctx.userId;
    } else if (ctx.role === "RESTAURANT") {
      whereClause.restaurantId = ctx.userId;
    } else if (ctx.role === "DRIVER") {
      whereClause.driverId = ctx.userId;
    }
    
    if (orderId) {
      whereClause.id = orderId;
    }

    const orders = await prisma.foodOrder.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: orderId ? 1 : 5,
      select: {
        id: true,
        status: true,
        subtotal: true,
        deliveryFee: true,
        serviceFare: true,
        createdAt: true,
        ...(ctx.role === "ADMIN" && {
          customerId: true,
          restaurantId: true,
          driverId: true,
        }),
      },
    });

    if (orders.length === 0) {
      return {
        success: true,
        data: { message: "No orders found.", orders: [] },
        source: "food_orders_table",
      };
    }

    return {
      success: true,
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          status: o.status,
          subtotal: o.subtotal?.toString(),
          deliveryFee: o.deliveryFee?.toString(),
          total: o.serviceFare?.toString(),
          createdAt: o.createdAt,
        })),
      },
      source: "food_orders_table",
    };
  } catch (error) {
    console.error("[SafePilot Tools] getOrderStatus error:", error);
    return {
      success: false,
      error: "Failed to retrieve order status.",
      source: "database_error",
    };
  }
}

export async function getDeliveryStatus(
  ctx: ToolContext,
  deliveryId?: string
): Promise<ToolResult> {
  const permissions = getToolPermissions(ctx.role);
  
  if (!permissions.allowedTools.includes("read_delivery_status")) {
    return {
      success: false,
      error: "You don't have permission to access delivery status.",
      source: "rbac_check",
    };
  }

  try {
    const whereClause: any = {};
    
    if (ctx.role === "CUSTOMER") {
      whereClause.customerId = ctx.userId;
    } else if (ctx.role === "DRIVER") {
      whereClause.driverId = ctx.userId;
    }
    
    if (deliveryId) {
      whereClause.id = deliveryId;
    }

    const deliveries = await prisma.delivery.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: deliveryId ? 1 : 5,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        serviceFare: true,
        driverPayout: true,
        createdAt: true,
        ...(ctx.role === "ADMIN" && {
          customerId: true,
          driverId: true,
        }),
      },
    });

    if (deliveries.length === 0) {
      return {
        success: true,
        data: { message: "No deliveries found.", deliveries: [] },
        source: "deliveries_table",
      };
    }

    return {
      success: true,
      data: {
        deliveries: deliveries.map((d) => ({
          id: d.id,
          status: d.status,
          pickup: d.pickupAddress,
          dropoff: d.dropoffAddress,
          fare: d.serviceFare?.toString(),
          driverPayout: d.driverPayout?.toString(),
          createdAt: d.createdAt,
        })),
      },
      source: "deliveries_table",
    };
  } catch (error) {
    console.error("[SafePilot Tools] getDeliveryStatus error:", error);
    return {
      success: false,
      error: "Failed to retrieve delivery status.",
      source: "database_error",
    };
  }
}

export async function getVerificationStatus(
  ctx: ToolContext
): Promise<ToolResult> {
  const permissions = getToolPermissions(ctx.role);
  
  if (!permissions.allowedTools.includes("read_verification_status")) {
    return {
      success: false,
      error: "You don't have permission to access verification status.",
      source: "rbac_check",
    };
  }

  try {
    if (ctx.role === "DRIVER") {
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId: ctx.userId },
        select: {
          verificationStatus: true,
          rejectionReason: true,
        },
      });

      if (!driverProfile) {
        return {
          success: true,
          data: { message: "Driver profile not found." },
          source: "driver_profiles",
        };
      }

      return {
        success: true,
        data: {
          verificationStatus: driverProfile.verificationStatus,
          rejectionReason: driverProfile.rejectionReason,
        },
        source: "driver_profiles",
      };
    }

    if (ctx.role === "RESTAURANT") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({
        where: { userId: ctx.userId },
        select: {
          verificationStatus: true,
          rejectionReason: true,
        },
      });

      if (!restaurantProfile) {
        return {
          success: true,
          data: { message: "Restaurant profile not found." },
          source: "restaurant_profiles",
        };
      }

      return {
        success: true,
        data: {
          verificationStatus: restaurantProfile.verificationStatus,
          rejectionReason: restaurantProfile.rejectionReason,
        },
        source: "restaurant_profiles",
      };
    }

    if (ctx.role === "CUSTOMER") {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: ctx.userId },
        select: {
          isVerified: true,
        },
      });

      return {
        success: true,
        data: {
          isVerified: customerProfile?.isVerified ?? false,
        },
        source: "customer_profiles",
      };
    }

    if (ctx.role === "ADMIN") {
      return {
        success: true,
        data: {
          message: "Admin users have full access.",
          isAdmin: true,
        },
        source: "admin_context",
      };
    }

    return {
      success: false,
      error: "Unknown role.",
      source: "rbac_check",
    };
  } catch (error) {
    console.error("[SafePilot Tools] getVerificationStatus error:", error);
    return {
      success: false,
      error: "Failed to retrieve verification status.",
      source: "database_error",
    };
  }
}

export async function getWalletBalance(
  ctx: ToolContext
): Promise<ToolResult> {
  const permissions = getToolPermissions(ctx.role);
  
  if (!permissions.allowedTools.includes("read_wallet")) {
    return {
      success: false,
      error: "You don't have permission to access wallet information.",
      source: "rbac_check",
    };
  }

  try {
    const countryRules = getCountryRules(ctx.country);
    
    if (ctx.role === "DRIVER") {
      const wallet = await prisma.driverWallet.findUnique({
        where: { driverId: ctx.userId },
        select: {
          balance: true,
          negativeBalance: true,
        },
      });

      if (!wallet) {
        return {
          success: true,
          data: { message: "No wallet found.", currency: countryRules.currency },
          source: "driver_wallets",
        };
      }

      return {
        success: true,
        data: {
          balance: wallet.balance?.toString(),
          negativeBalance: wallet.negativeBalance?.toString(),
          currency: countryRules.currency,
          paymentMethods: countryRules.paymentMethods,
        },
        source: "driver_wallets",
      };
    }
    
    if (ctx.role === "RESTAURANT") {
      const wallet = await prisma.restaurantWallet.findUnique({
        where: { restaurantId: ctx.userId },
        select: {
          balance: true,
          negativeBalance: true,
        },
      });

      if (!wallet) {
        return {
          success: true,
          data: { message: "No wallet found.", currency: countryRules.currency },
          source: "restaurant_wallets",
        };
      }

      return {
        success: true,
        data: {
          balance: wallet.balance?.toString(),
          negativeBalance: wallet.negativeBalance?.toString(),
          currency: countryRules.currency,
          paymentMethods: countryRules.paymentMethods,
        },
        source: "restaurant_wallets",
      };
    }

    return {
      success: false,
      error: "Wallet access is only available for drivers and restaurants.",
      source: "rbac_check",
    };
  } catch (error) {
    console.error("[SafePilot Tools] getWalletBalance error:", error);
    return {
      success: false,
      error: "Failed to retrieve wallet balance.",
      source: "database_error",
    };
  }
}

export type ToolName = 
  | "get_ride_status"
  | "get_order_status"
  | "get_delivery_status"
  | "get_verification_status"
  | "get_wallet_balance";

export async function executeTool(
  toolName: ToolName,
  ctx: ToolContext,
  params?: Record<string, string>
): Promise<ToolResult> {
  switch (toolName) {
    case "get_ride_status":
      return getRideStatus(ctx, params?.rideId);
    case "get_order_status":
      return getOrderStatus(ctx, params?.orderId);
    case "get_delivery_status":
      return getDeliveryStatus(ctx, params?.deliveryId);
    case "get_verification_status":
      return getVerificationStatus(ctx);
    case "get_wallet_balance":
      return getWalletBalance(ctx);
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        source: "tool_dispatcher",
      };
  }
}
