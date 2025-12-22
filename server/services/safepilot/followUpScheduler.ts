import { prisma } from "../../lib/prisma";

export interface FollowUpCondition {
  id: string;
  type: "verification_pending" | "document_incomplete" | "ticket_open" | "order_unresolved";
  checkAfterMs: number;
  maxFollowUps: number;
}

export interface PendingFollowUp {
  userId: string;
  conversationId: string;
  conditionType: string;
  entityId?: string;
  followUpCount: number;
  nextFollowUpAt: Date;
  message: string;
}

const FOLLOW_UP_CONDITIONS: FollowUpCondition[] = [
  {
    id: "verification_pending",
    type: "verification_pending",
    checkAfterMs: 12 * 60 * 60 * 1000,
    maxFollowUps: 2,
  },
  {
    id: "document_incomplete",
    type: "document_incomplete",
    checkAfterMs: 24 * 60 * 60 * 1000,
    maxFollowUps: 2,
  },
  {
    id: "ticket_open",
    type: "ticket_open",
    checkAfterMs: 24 * 60 * 60 * 1000,
    maxFollowUps: 2,
  },
  {
    id: "order_unresolved",
    type: "order_unresolved",
    checkAfterMs: 4 * 60 * 60 * 1000,
    maxFollowUps: 2,
  },
];

export async function checkFollowUpConditions(userId: string): Promise<PendingFollowUp[]> {
  const pendingFollowUps: PendingFollowUp[] = [];

  try {
    const customerProfile = await prisma.customerProfile.findFirst({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        nidFrontImageUrl: true,
        nidBackImageUrl: true,
      },
    });

    if (customerProfile?.verificationStatus === "pending") {
      const lastSafePilotMessage = await prisma.safePilotMessage.findFirst({
        where: {
          conversation: { userId },
          content: { contains: "verification" },
        },
        orderBy: { createdAt: "desc" },
      });

      if (lastSafePilotMessage) {
        const hoursSince = (Date.now() - new Date(lastSafePilotMessage.createdAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursSince >= 12) {
          const followUpCount = await getFollowUpCount(userId, "verification_pending");
          
          if (followUpCount < 2) {
            pendingFollowUps.push({
              userId,
              conversationId: (lastSafePilotMessage as any).conversationId || "",
              conditionType: "verification_pending",
              followUpCount,
              nextFollowUpAt: new Date(),
              message: getVerificationReminderMessage(followUpCount),
            });
          }
        }
      }
    }

    if (customerProfile && (!customerProfile.nidFrontImageUrl || !customerProfile.nidBackImageUrl)) {
      const lastDocMessage = await prisma.safePilotMessage.findFirst({
        where: {
          conversation: { userId },
          content: { contains: "document" },
        },
        orderBy: { createdAt: "desc" },
      });

      if (lastDocMessage) {
        const hoursSince = (Date.now() - new Date(lastDocMessage.createdAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursSince >= 24) {
          const followUpCount = await getFollowUpCount(userId, "document_incomplete");
          
          if (followUpCount < 2) {
            pendingFollowUps.push({
              userId,
              conversationId: (lastDocMessage as any).conversationId || "",
              conditionType: "document_incomplete",
              followUpCount,
              nextFollowUpAt: new Date(),
              message: getDocumentReminderMessage(followUpCount),
            });
          }
        }
      }
    }

    const openTickets = await prisma.customerSupportTicket.findMany({
      where: {
        customerId: customerProfile?.id || userId,
        status: "open",
        channel: "safepilot",
        createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, ticketCode: true, createdAt: true },
    });

    for (const ticket of openTickets) {
      const followUpCount = await getFollowUpCount(userId, "ticket_open", ticket.id);
      
      if (followUpCount < 2) {
        pendingFollowUps.push({
          userId,
          conversationId: "",
          conditionType: "ticket_open",
          entityId: ticket.id,
          followUpCount,
          nextFollowUpAt: new Date(),
          message: getTicketReminderMessage(ticket.ticketCode, followUpCount),
        });
      }
    }

  } catch (error) {
    console.error("[SafePilot] Follow-up check error:", error);
  }

  return pendingFollowUps;
}

async function getFollowUpCount(
  userId: string,
  conditionType: string,
  entityId?: string
): Promise<number> {
  try {
    const count = await prisma.safePilotAuditLog.count({
      where: {
        actorUserId: userId,
        action: "ask",
        metadata: {
          path: ["type"],
          equals: "follow_up",
        },
      },
    });
    return count;
  } catch {
    return 0;
  }
}

function getVerificationReminderMessage(followUpCount: number): string {
  if (followUpCount === 0) {
    return `Hi! I noticed your account verification is still pending. Would you like me to explain what's needed to complete it?

**What's missing:**
- Your verification documents are being reviewed

**Next step:** You can check your verification status in your Profile settings.`;
  }
  
  return `Just checking in - your verification is still in progress. If you're having trouble with the process, I can connect you with our support team who can help directly.

Would you like me to escalate this to a support specialist?`;
}

function getDocumentReminderMessage(followUpCount: number): string {
  if (followUpCount === 0) {
    return `Hi! I noticed your document upload isn't complete yet. To finish verifying your account, you'll need to upload all required documents.

**What's missing:**
- Some documents still need to be uploaded

**Next step:** Go to Profile > Verification to complete your upload.`;
  }
  
  return `Your document upload is still incomplete. If you're having issues uploading, our support team can help you through the process.

Would you like me to connect you with support?`;
}

function getTicketReminderMessage(ticketCode: string, followUpCount: number): string {
  if (followUpCount === 0) {
    return `Hi! Your support ticket **${ticketCode}** is still open. Our team is working on it.

**Current status:** Under review

If you have any updates or additional information, please reply here and I'll add it to your ticket.`;
  }
  
  return `Your support ticket **${ticketCode}** is taking longer than expected. I apologize for the delay.

I can escalate this for priority review if you'd like. Would you like me to do that?`;
}

export async function logFollowUp(
  userId: string,
  conditionType: string,
  entityId?: string,
  followUpCount?: number
): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: userId,
        actorRole: "CUSTOMER",
        action: "ask",
        metadata: {
          type: "follow_up",
          conditionType,
          entityId,
          followUpCount: (followUpCount || 0) + 1,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[SafePilot] Failed to log follow-up:", error);
  }
}

export async function markIssueResolved(
  userId: string,
  conditionType: string,
  entityId?: string
): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: userId,
        actorRole: "CUSTOMER",
        action: "ask",
        metadata: {
          type: "issue_resolved",
          conditionType,
          entityId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[SafePilot] Failed to mark issue resolved:", error);
  }
}

export async function shouldSendFollowUp(
  userId: string,
  conditionType: string,
  entityId?: string
): Promise<boolean> {
  try {
    const resolved = await prisma.safePilotAuditLog.findFirst({
      where: {
        actorUserId: userId,
        action: "ask",
        metadata: {
          path: ["type"],
          equals: "issue_resolved",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (resolved) {
      const resolvedMeta = resolved.metadata as any;
      if (resolvedMeta?.conditionType === conditionType) {
        if (!entityId || resolvedMeta?.entityId === entityId) {
          return false;
        }
      }
    }

    const dismissed = await prisma.safePilotAuditLog.findFirst({
      where: {
        actorUserId: userId,
        action: "ask",
        metadata: {
          path: ["type"],
          equals: "help_dismissed",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (dismissed) {
      const dismissedAt = new Date(dismissed.createdAt);
      if (Date.now() - dismissedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[SafePilot] Follow-up check error:", error);
    return false;
  }
}

export async function dismissHelp(userId: string): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: userId,
        actorRole: "CUSTOMER",
        action: "ask",
        metadata: {
          type: "help_dismissed",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[SafePilot] Failed to dismiss help:", error);
  }
}
