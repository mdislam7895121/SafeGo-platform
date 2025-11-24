import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { logAuditEvent, EntityType, ActionType, getClientIp } from "../utils/audit";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to check if customer can review order
async function canReviewOrder(customerId: string, orderId: string): Promise<{ canReview: boolean; reason?: string }> {
  const order = await prisma.foodOrder.findUnique({
    where: { id: orderId },
    select: {
      customerId: true,
      status: true,
    },
  });

  if (!order) {
    return { canReview: false, reason: "Order not found" };
  }

  if (order.customerId !== customerId) {
    return { canReview: false, reason: "You can only review your own orders" };
  }

  if (order.status !== "delivered") {
    return { canReview: false, reason: "Order must be delivered before reviewing" };
  }

  // Check if review already exists
  const existingReview = await prisma.review.findUnique({
    where: { orderId },
  });

  if (existingReview) {
    return { canReview: false, reason: "You have already reviewed this order" };
  }

  return { canReview: true };
}

// Helper function to check if review can be edited/deleted (within 24 hours)
function canModifyReview(createdAt: Date): boolean {
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation <= 24;
}

// POST /api/reviews - Create a review (customer only)
router.post("/", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { orderId, rating, reviewText, images = [] } = req.body;

    // Validation
    if (!orderId || !rating) {
      return res.status(400).json({ error: "Order ID and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Check if customer can review this order
    const reviewCheck = await canReviewOrder(customerProfile.id, orderId);
    if (!reviewCheck.canReview) {
      return res.status(403).json({ error: reviewCheck.reason });
    }

    // Get order details to find restaurant
    const order = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      select: { restaurantId: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        orderId,
        customerId: customerProfile.id,
        restaurantId: order.restaurantId,
        rating,
        reviewText: reviewText || null,
        images: images || [],
      },
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: { email: true },
            },
          },
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
          },
        },
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    await logAuditEvent({
      actorId: customerProfile.id,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || "customer",
      entityType: EntityType.CUSTOMER,
      entityId: customerProfile.id,
      actionType: ActionType.CREATE,
      description: `Created review for order ${orderId}, rating: ${rating}/5`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ review });
  } catch (error: any) {
    console.error("Create review error:", error);
    res.status(500).json({ error: error.message || "Failed to create review" });
  }
});

// GET /api/reviews/:id - Get single review
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: { email: true },
            },
          },
        },
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
          },
        },
        order: {
          select: {
            id: true,
            subtotal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({ review });
  } catch (error: any) {
    console.error("Get review error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review" });
  }
});

// GET /api/reviews/restaurant/:restaurantId - Get all reviews for a restaurant
router.get("/restaurant/:restaurantId", async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit = 20, offset = 0, rating, hiddenFilter = "visible" } = req.query;

    // Build where clause
    const where: any = {
      restaurantId,
    };

    // Filter by rating if provided
    if (rating && typeof rating === "string") {
      where.rating = parseInt(rating);
    }

    // Filter by hidden status (only show non-hidden by default for public view)
    if (hiddenFilter === "visible") {
      where.isHidden = false;
    } else if (hiddenFilter === "hidden") {
      where.isHidden = true;
    }
    // If hiddenFilter === "all", don't add isHidden filter

    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.review.count({ where });

    res.json({
      reviews,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("Get restaurant reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reviews" });
  }
});

// GET /api/reviews/stats/:restaurantId - Get rating statistics
router.get("/stats/:restaurantId", async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;

    // Get all visible reviews for this restaurant
    const reviews = await prisma.review.findMany({
      where: {
        restaurantId,
        isHidden: false,
      },
      select: {
        rating: true,
      },
    });

    if (reviews.length === 0) {
      return res.json({
        averageRating: 0,
        totalReviews: 0,
        ratingBreakdown: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      });
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Calculate rating breakdown
    const ratingBreakdown = {
      1: reviews.filter((r) => r.rating === 1).length,
      2: reviews.filter((r) => r.rating === 2).length,
      3: reviews.filter((r) => r.rating === 3).length,
      4: reviews.filter((r) => r.rating === 4).length,
      5: reviews.filter((r) => r.rating === 5).length,
    };

    res.json({
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews: reviews.length,
      ratingBreakdown,
    });
  } catch (error: any) {
    console.error("Get review stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review statistics" });
  }
});

// PATCH /api/reviews/:id - Edit review (customer only, within 24 hours)
router.patch("/:id", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { rating, reviewText, images } = req.body;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.customerId !== customerProfile.id) {
      return res.status(403).json({ error: "You can only edit your own reviews" });
    }

    if (!canModifyReview(review.createdAt)) {
      return res.status(403).json({ error: "Reviews can only be edited within 24 hours of creation" });
    }

    // Update review
    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating: rating !== undefined ? rating : review.rating,
        reviewText: reviewText !== undefined ? reviewText : review.reviewText,
        images: images !== undefined ? images : review.images,
      },
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    await logAuditEvent({
      actorId: customerProfile.id,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || "customer",
      entityType: EntityType.CUSTOMER,
      entityId: customerProfile.id,
      actionType: ActionType.UPDATE,
      description: `Updated review ${id}`,
      ipAddress: getClientIp(req),
    });

    res.json({ review: updatedReview });
  } catch (error: any) {
    console.error("Update review error:", error);
    res.status(500).json({ error: error.message || "Failed to update review" });
  }
});

// DELETE /api/reviews/:id - Delete review (customer only, within 24 hours)
router.delete("/:id", requireRole(["customer"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.customerId !== customerProfile.id) {
      return res.status(403).json({ error: "You can only delete your own reviews" });
    }

    if (!canModifyReview(review.createdAt)) {
      return res.status(403).json({ error: "Reviews can only be deleted within 24 hours of creation" });
    }

    await prisma.review.delete({
      where: { id },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    await logAuditEvent({
      actorId: customerProfile.id,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || "customer",
      entityType: EntityType.CUSTOMER,
      entityId: customerProfile.id,
      actionType: ActionType.DELETE,
      description: `Deleted review ${id}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error: any) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: error.message || "Failed to delete review" });
  }
});

// POST /api/reviews/:id/reply - Restaurant reply to review
router.post("/:id/reply", requireRole(["restaurant"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { replyText } = req.body;

    if (!replyText) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "You can only reply to reviews of your own restaurant" });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        restaurantReplyText: replyText,
        restaurantRepliedAt: new Date(),
        restaurantRepliedById: restaurantProfile.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    await logAuditEvent({
      actorId: restaurantProfile.id,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || "restaurant",
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      actionType: ActionType.CREATE,
      description: `Replied to review ${id}`,
      ipAddress: getClientIp(req),
    });

    res.json({ review: updatedReview });
  } catch (error: any) {
    console.error("Reply to review error:", error);
    res.status(500).json({ error: error.message || "Failed to reply to review" });
  }
});

// PATCH /api/reviews/:id/hide - Hide/unhide review (restaurant or admin)
router.patch("/:id/hide", requireRole(["restaurant", "admin"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { id } = req.params;
    const { hide, reason } = req.body;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // If restaurant, check ownership
    if (userRole === "restaurant") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({
        where: { userId },
      });

      if (!restaurantProfile || review.restaurantId !== restaurantProfile.id) {
        return res.status(403).json({ error: "You can only hide reviews of your own restaurant" });
      }
    }

    // Get admin profile if admin
    let adminId = null;
    if (userRole === "admin") {
      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId },
      });
      adminId = adminProfile?.id;
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        isHidden: hide,
        hiddenByAdminId: hide ? (adminId || review.restaurantId) : null,
        hiddenAt: hide ? new Date() : null,
        hideReason: hide ? reason : null,
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    const entityType = userRole === "admin" ? EntityType.RESTAURANT : EntityType.RESTAURANT;
    const entityId = userRole === "admin" ? (adminId || "") : review.restaurantId;

    await logAuditEvent({
      actorId: entityId,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || userRole,
      entityType,
      entityId,
      actionType: ActionType.UPDATE,
      description: `${hide ? "Hid" : "Unhid"} review ${id}${reason ? `: ${reason}` : ""}`,
      ipAddress: getClientIp(req),
    });

    res.json({ review: updatedReview });
  } catch (error: any) {
    console.error("Hide review error:", error);
    res.status(500).json({ error: error.message || "Failed to hide review" });
  }
});

// PATCH /api/reviews/:id/flag - Flag/unflag review (customer or admin)
router.patch("/:id/flag", requireRole(["customer", "admin"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { id } = req.params;
    const { flag, reason } = req.body;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Get admin profile if admin
    let adminId = null;
    if (userRole === "admin") {
      const adminProfile = await prisma.adminProfile.findUnique({
        where: { userId },
      });
      adminId = adminProfile?.id;
    }

    // Get customer profile if customer
    let customerId = null;
    if (userRole === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      });
      customerId = customerProfile?.id;
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        isFlagged: flag,
        flaggedByAdminId: flag ? (adminId || customerId || review.customerId) : null,
        flaggedAt: flag ? new Date() : null,
        flagReason: flag ? reason : null,
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Audit log
    const entityType = userRole === "admin" ? EntityType.RESTAURANT : EntityType.CUSTOMER;
    const entityId = userRole === "admin" ? (adminId || "") : (customerId || "");

    await logAuditEvent({
      actorId: entityId,
      actorEmail: user?.email || "unknown",
      actorRole: user?.role || userRole,
      entityType,
      entityId,
      actionType: ActionType.UPDATE,
      description: `${flag ? "Flagged" : "Unflagged"} review ${id}${reason ? `: ${reason}` : ""}`,
      ipAddress: getClientIp(req),
    });

    res.json({ review: updatedReview });
  } catch (error: any) {
    console.error("Flag review error:", error);
    res.status(500).json({ error: error.message || "Failed to flag review" });
  }
});

export default router;
