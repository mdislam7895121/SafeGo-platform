import { prisma } from '../db';

/**
 * Partner Email Notification Service
 * 
 * Handles email notifications for partner onboarding status changes.
 * Supports Bangladesh partners primarily, with extensibility for US/Global.
 * 
 * Environment Variables Required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASSWORD: SMTP password
 * - EMAIL_FROM_ADDRESS: From address (default: no-reply@safego.com)
 * - EMAIL_FROM_NAME: From name (default: SafeGo)
 */

export type PartnerType = 'DRIVER' | 'RESTAURANT' | 'SHOP' | 'TICKET';
export type OnboardingStatus = 'new' | 'in_review' | 'approved' | 'rejected' | 'need_more_info';

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody: string;
}

interface SendEmailParams {
  to: EmailRecipient;
  partnerType: PartnerType;
  partnerApplicationId: string;
  statusTrigger: string;
  previousStatus?: string;
  region: string;
  country: string;
  templateName: string;
  adminId?: string;
  metadata?: Record<string, any>;
}

interface NotificationConfig {
  enabled: boolean;
  templateBuilder: (params: TemplateParams) => EmailContent;
}

interface TemplateParams {
  recipientName: string;
  partnerType: PartnerType;
  applicationId: string;
  region: string;
  country: string;
  dashboardUrl: string;
  supportEmail: string;
  additionalData?: Record<string, any>;
}

const SAFEGO_SUPPORT_EMAIL = 'support@safego.com';
const SAFEGO_DASHBOARD_BASE = {
  BD: 'https://safego.com/bd/partner',
  US: 'https://safego.com/us/partner',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRegionName(region: string): string {
  switch (region) {
    case 'BD': return 'Bangladesh';
    case 'US': return 'United States';
    default: return region;
  }
}

function getPartnerTypeName(partnerType: PartnerType): string {
  switch (partnerType) {
    case 'DRIVER': return 'Driver/Courier';
    case 'RESTAURANT': return 'Restaurant';
    case 'SHOP': return 'Shop';
    case 'TICKET': return 'Ticket Partner';
    default: return 'Partner';
  }
}

function buildEmailHeader(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeGo Partner Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px; }
    .content { padding: 30px 20px; }
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 10px 0; }
    .status-approved { background-color: #d1fae5; color: #065f46; }
    .status-rejected { background-color: #fee2e2; color: #991b1b; }
    .status-review { background-color: #fef3c7; color: #92400e; }
    .status-info { background-color: #dbeafe; color: #1e40af; }
    .cta-button { display: inline-block; padding: 14px 28px; background-color: #10b981; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #10b981; text-decoration: none; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">`;
}

function buildEmailFooter(supportEmail: string): string {
  return `
    <div class="footer">
      <p>This message was sent by SafeGo Global.</p>
      <p>If you did not apply, please contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      <p>&copy; ${new Date().getFullYear()} SafeGo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

const NOTIFICATION_CONFIG: Record<PartnerType, Record<string, NotificationConfig>> = {
  DRIVER: {
    approved: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Your SafeGo ${getRegionName(params.region)} ${params.additionalData?.serviceType === 'delivery_courier' ? 'Courier' : 'Driver'} Application Has Been Approved!`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo</h1>
      <p>Partner Onboarding</p>
    </div>
    <div class="content">
      <h2>Congratulations, ${escapeHtml(params.recipientName)}!</h2>
      <span class="status-badge status-approved">Application Approved</span>
      <p>We are thrilled to inform you that your application to become a SafeGo ${params.additionalData?.serviceType === 'delivery_courier' ? 'delivery courier' : 'driver'} in ${getRegionName(params.region)} has been <strong>approved</strong>.</p>
      
      <h3>Next Steps:</h3>
      <ul>
        <li>Download the SafeGo Partner app from your app store</li>
        <li>Complete your profile setup and KYC verification</li>
        <li>Upload your vehicle documents</li>
        <li>Complete the safety training</li>
        <li>Start accepting rides and earning!</li>
      </ul>
      
      <a href="${params.dashboardUrl}" class="cta-button">Access Partner Dashboard</a>
      
      <p>If you have any questions, our support team is here to help at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Congratulations, ${params.recipientName}!\n\nYour application to become a SafeGo ${params.additionalData?.serviceType === 'delivery_courier' ? 'delivery courier' : 'driver'} in ${getRegionName(params.region)} has been APPROVED.\n\nNext Steps:\n- Download the SafeGo Partner app\n- Complete your profile setup and KYC verification\n- Upload your vehicle documents\n- Complete the safety training\n- Start accepting rides and earning!\n\nAccess your dashboard: ${params.dashboardUrl}\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    rejected: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Update on Your SafeGo ${getRegionName(params.region)} Application`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo</h1>
      <p>Partner Onboarding</p>
    </div>
    <div class="content">
      <h2>Dear ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-rejected">Application Not Approved</span>
      <p>Thank you for your interest in becoming a SafeGo partner in ${getRegionName(params.region)}.</p>
      <p>After careful review, we regret to inform you that we are unable to approve your application at this time.</p>
      
      <p>This decision may be due to one or more of the following reasons:</p>
      <ul>
        <li>Incomplete documentation</li>
        <li>Eligibility requirements not met</li>
        <li>Service capacity in your area</li>
      </ul>
      
      <p>You are welcome to reapply after 30 days if your circumstances change.</p>
      
      <p>If you believe this decision was made in error or have questions, please contact our support team at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Dear ${params.recipientName},\n\nThank you for your interest in becoming a SafeGo partner in ${getRegionName(params.region)}.\n\nAfter careful review, we regret to inform you that we are unable to approve your application at this time.\n\nYou are welcome to reapply after 30 days if your circumstances change.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    in_review: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Your SafeGo ${getRegionName(params.region)} Application Is Under Review`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo</h1>
      <p>Partner Onboarding</p>
    </div>
    <div class="content">
      <h2>Hello ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-review">Application In Review</span>
      <p>Good news! Your application to become a SafeGo partner in ${getRegionName(params.region)} is now being reviewed by our team.</p>
      
      <p>This process typically takes 1-3 business days. We will notify you by email once a decision has been made.</p>
      
      <p>In the meantime, please ensure your phone is accessible as we may need to verify some information.</p>
      
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Hello ${params.recipientName},\n\nGood news! Your application to become a SafeGo partner in ${getRegionName(params.region)} is now being reviewed by our team.\n\nThis process typically takes 1-3 business days.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    }
  },
  RESTAURANT: {
    approved: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Welcome to SafeGo Eats, ${escapeHtml(params.additionalData?.restaurantName || params.recipientName)}!`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Eats</h1>
      <p>Restaurant Partner Program</p>
    </div>
    <div class="content">
      <h2>Congratulations, ${escapeHtml(params.recipientName)}!</h2>
      <span class="status-badge status-approved">Restaurant Approved</span>
      <p>We are excited to welcome <strong>${escapeHtml(params.additionalData?.restaurantName || 'your restaurant')}</strong> to the SafeGo Eats family in ${getRegionName(params.region)}!</p>
      
      <h3>Next Steps to Go Live:</h3>
      <ul>
        <li>Log in to your Restaurant Partner Dashboard</li>
        <li>Set up your menu with photos and pricing</li>
        <li>Configure your operating hours</li>
        <li>Set up your kitchen preparation times</li>
        <li>Complete payment setup</li>
        <li>Your restaurant will be live once all steps are complete!</li>
      </ul>
      
      <a href="${params.dashboardUrl}" class="cta-button">Access Restaurant Dashboard</a>
      
      <p>Our restaurant success team will reach out within 24-48 hours to help you get started.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Congratulations, ${params.recipientName}!\n\nWe are excited to welcome ${params.additionalData?.restaurantName || 'your restaurant'} to the SafeGo Eats family in ${getRegionName(params.region)}!\n\nNext Steps:\n- Log in to your Restaurant Partner Dashboard\n- Set up your menu with photos and pricing\n- Configure your operating hours\n- Complete payment setup\n\nAccess your dashboard: ${params.dashboardUrl}\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    rejected: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Update on Your SafeGo Eats Restaurant Application`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Eats</h1>
      <p>Restaurant Partner Program</p>
    </div>
    <div class="content">
      <h2>Dear ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-rejected">Application Not Approved</span>
      <p>Thank you for your interest in joining SafeGo Eats in ${getRegionName(params.region)}.</p>
      <p>After reviewing your application for <strong>${escapeHtml(params.additionalData?.restaurantName || 'your restaurant')}</strong>, we are unable to approve it at this time.</p>
      
      <p>Common reasons include:</p>
      <ul>
        <li>Business documentation requirements not met</li>
        <li>Food safety certification pending</li>
        <li>Location outside current service area</li>
      </ul>
      
      <p>You are welcome to reapply once you have addressed any outstanding requirements.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Dear ${params.recipientName},\n\nThank you for your interest in joining SafeGo Eats in ${getRegionName(params.region)}.\n\nAfter reviewing your application, we are unable to approve it at this time.\n\nYou are welcome to reapply once you have addressed any outstanding requirements.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    in_review: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Your SafeGo Eats Restaurant Application Is Under Review`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Eats</h1>
      <p>Restaurant Partner Program</p>
    </div>
    <div class="content">
      <h2>Hello ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-review">Application In Review</span>
      <p>Your application to join SafeGo Eats with <strong>${escapeHtml(params.additionalData?.restaurantName || 'your restaurant')}</strong> is now under review.</p>
      
      <p>Our team is reviewing your business details and will make a decision within 3-5 business days.</p>
      
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Hello ${params.recipientName},\n\nYour application to join SafeGo Eats is now under review.\n\nOur team will make a decision within 3-5 business days.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    }
  },
  SHOP: {
    approved: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Welcome to SafeGo Shops, ${escapeHtml(params.additionalData?.shopName || params.recipientName)}!`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Shops</h1>
      <p>Shop Partner Program</p>
    </div>
    <div class="content">
      <h2>Congratulations, ${escapeHtml(params.recipientName)}!</h2>
      <span class="status-badge status-approved">Shop Approved</span>
      <p>We are delighted to welcome <strong>${escapeHtml(params.additionalData?.shopName || 'your shop')}</strong> to SafeGo Shops in ${getRegionName(params.region)}!</p>
      
      <h3>Next Steps:</h3>
      <ul>
        <li>Log in to your Shop Partner Dashboard</li>
        <li>Upload your product catalog</li>
        <li>Set up pricing and inventory</li>
        <li>Configure delivery options</li>
        <li>Complete payment setup</li>
      </ul>
      
      <a href="${params.dashboardUrl}" class="cta-button">Access Shop Dashboard</a>
      
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Congratulations, ${params.recipientName}!\n\nWe are delighted to welcome ${params.additionalData?.shopName || 'your shop'} to SafeGo Shops!\n\nAccess your dashboard: ${params.dashboardUrl}\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    rejected: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Update on Your SafeGo Shops Application`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Shops</h1>
      <p>Shop Partner Program</p>
    </div>
    <div class="content">
      <h2>Dear ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-rejected">Application Not Approved</span>
      <p>Thank you for your interest in joining SafeGo Shops.</p>
      <p>We are unable to approve your application for <strong>${escapeHtml(params.additionalData?.shopName || 'your shop')}</strong> at this time.</p>
      
      <p>You are welcome to reapply once requirements are addressed.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Dear ${params.recipientName},\n\nWe are unable to approve your shop application at this time.\n\nYou are welcome to reapply once requirements are addressed.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    in_review: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Your SafeGo Shops Application Is Under Review`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Shops</h1>
      <p>Shop Partner Program</p>
    </div>
    <div class="content">
      <h2>Hello ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-review">Application In Review</span>
      <p>Your application to join SafeGo Shops is now under review.</p>
      <p>We will notify you within 3-5 business days.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Hello ${params.recipientName},\n\nYour shop application is under review. We will notify you within 3-5 business days.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    }
  },
  TICKET: {
    approved: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Welcome to SafeGo Tickets, ${escapeHtml(params.additionalData?.businessName || params.recipientName)}!`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Tickets</h1>
      <p>Ticket Partner Program</p>
    </div>
    <div class="content">
      <h2>Congratulations, ${escapeHtml(params.recipientName)}!</h2>
      <span class="status-badge status-approved">Partner Approved</span>
      <p>We are excited to welcome <strong>${escapeHtml(params.additionalData?.businessName || 'your business')}</strong> as a SafeGo Tickets partner in ${getRegionName(params.region)}!</p>
      
      <h3>Next Steps:</h3>
      <ul>
        <li>Access your Ticket Partner Dashboard</li>
        <li>Set up your routes and schedules</li>
        <li>Configure pricing and seat inventory</li>
        <li>Complete payment integration</li>
        <li>Start selling tickets!</li>
      </ul>
      
      <a href="${params.dashboardUrl}" class="cta-button">Access Partner Dashboard</a>
      
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Congratulations, ${params.recipientName}!\n\nWe are excited to welcome ${params.additionalData?.businessName || 'your business'} as a SafeGo Tickets partner!\n\nAccess your dashboard: ${params.dashboardUrl}\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    rejected: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Update on Your SafeGo Tickets Application`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Tickets</h1>
      <p>Ticket Partner Program</p>
    </div>
    <div class="content">
      <h2>Dear ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-rejected">Application Not Approved</span>
      <p>Thank you for your interest in joining SafeGo Tickets.</p>
      <p>We are unable to approve your application for <strong>${escapeHtml(params.additionalData?.businessName || 'your business')}</strong> at this time.</p>
      <p>You are welcome to reapply once requirements are addressed.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Dear ${params.recipientName},\n\nWe are unable to approve your ticket partner application at this time.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    },
    in_review: {
      enabled: true,
      templateBuilder: (params) => ({
        subject: `Your SafeGo Tickets Application Is Under Review`,
        htmlBody: buildEmailHeader() + `
    <div class="header">
      <h1>SafeGo Tickets</h1>
      <p>Ticket Partner Program</p>
    </div>
    <div class="content">
      <h2>Hello ${escapeHtml(params.recipientName)},</h2>
      <span class="status-badge status-review">Application In Review</span>
      <p>Your application to join SafeGo Tickets is now under review.</p>
      <p>We will notify you within 3-5 business days.</p>
      <p>Questions? Contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a></p>
    </div>` + buildEmailFooter(params.supportEmail),
        textBody: `Hello ${params.recipientName},\n\nYour ticket partner application is under review. We will notify you within 3-5 business days.\n\nQuestions? Contact us at ${params.supportEmail}\n\n---\nThis message was sent by SafeGo Global.`
      })
    }
  }
};

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'no-reply@safego.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'SafeGo';

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.log('[PartnerEmail] SMTP not configured, logging email instead');
    console.log(`[PartnerEmail] Would send to: ${to}`);
    console.log(`[PartnerEmail] Subject: ${subject}`);
    console.log(`[PartnerEmail] Text body preview: ${textBody.substring(0, 200)}...`);
    return { success: true };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[PartnerEmail] Email sent successfully to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[PartnerEmail] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPartnerStatusEmail(params: SendEmailParams & { content: EmailContent }): Promise<void> {
  const { to, partnerType, partnerApplicationId, statusTrigger, previousStatus, region, country, templateName, adminId, content, metadata } = params;

  if (!isValidEmail(to.email)) {
    console.error(`[PartnerEmail] Invalid email address: ${to.email}`);
    await logNotification({
      partnerType,
      partnerApplicationId,
      toEmail: to.email,
      subject: content.subject,
      templateName,
      statusTrigger,
      previousStatus,
      success: false,
      errorMessage: 'Invalid email address',
      region,
      country,
      adminId,
      metadata
    });
    return;
  }

  const result = await sendEmailViaSMTP(to.email, content.subject, content.htmlBody, content.textBody);

  await logNotification({
    partnerType,
    partnerApplicationId,
    toEmail: to.email,
    subject: content.subject,
    templateName,
    statusTrigger,
    previousStatus,
    success: result.success,
    errorMessage: result.error,
    region,
    country,
    adminId,
    metadata
  });
}

async function logNotification(data: {
  partnerType: string;
  partnerApplicationId: string;
  toEmail: string;
  subject: string;
  templateName: string;
  statusTrigger: string;
  previousStatus?: string;
  success: boolean;
  errorMessage?: string;
  region: string;
  country: string;
  adminId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.emailNotificationLog.create({
      data: {
        partnerType: data.partnerType,
        partnerApplicationId: data.partnerApplicationId,
        toEmail: data.toEmail,
        subject: data.subject,
        templateName: data.templateName,
        statusTrigger: data.statusTrigger,
        previousStatus: data.previousStatus,
        success: data.success,
        errorMessage: data.errorMessage,
        region: data.region,
        country: data.country,
        sentByAdminId: data.adminId,
        metadata: data.metadata || {}
      }
    });
    console.log(`[PartnerEmail] Notification logged for ${data.partnerType} ${data.partnerApplicationId}`);
  } catch (error) {
    console.error('[PartnerEmail] Failed to log notification:', error);
  }
}

export async function triggerPartnerNotification(params: {
  partnerType: PartnerType;
  applicationId: string;
  newStatus: string;
  previousStatus: string;
  recipientEmail: string;
  recipientName: string;
  region: string;
  country: string;
  adminId?: string;
  additionalData?: Record<string, any>;
}): Promise<{ sent: boolean; reason?: string }> {
  const { partnerType, applicationId, newStatus, previousStatus, recipientEmail, recipientName, region, country, adminId, additionalData } = params;

  if (newStatus === previousStatus) {
    console.log(`[PartnerEmail] Status unchanged (${newStatus}), skipping notification`);
    return { sent: false, reason: 'Status unchanged' };
  }

  if (!recipientEmail) {
    console.log(`[PartnerEmail] No email address for ${partnerType} ${applicationId}`);
    return { sent: false, reason: 'No email address' };
  }

  const config = NOTIFICATION_CONFIG[partnerType]?.[newStatus];
  if (!config || !config.enabled) {
    console.log(`[PartnerEmail] No notification configured for ${partnerType} status ${newStatus}`);
    return { sent: false, reason: 'Notification not configured for this status' };
  }

  const dashboardUrl = SAFEGO_DASHBOARD_BASE[region as keyof typeof SAFEGO_DASHBOARD_BASE] || SAFEGO_DASHBOARD_BASE.BD;
  
  const templateParams: TemplateParams = {
    recipientName,
    partnerType,
    applicationId,
    region,
    country,
    dashboardUrl,
    supportEmail: SAFEGO_SUPPORT_EMAIL,
    additionalData
  };

  const content = config.templateBuilder(templateParams);
  const templateName = `${partnerType.toLowerCase()}_${newStatus}`;

  await sendPartnerStatusEmail({
    to: { email: recipientEmail, name: recipientName },
    partnerType,
    partnerApplicationId: applicationId,
    statusTrigger: newStatus,
    previousStatus,
    region,
    country,
    templateName,
    adminId,
    content,
    metadata: additionalData
  });

  return { sent: true };
}

export async function getNotificationLogs(params: {
  partnerType?: string;
  partnerApplicationId?: string;
  success?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ logs: any[]; total: number; pagination: { page: number; limit: number; totalPages: number } }> {
  const { partnerType, partnerApplicationId, success, page = 1, limit = 20 } = params;

  const where: any = {};
  if (partnerType) where.partnerType = partnerType;
  if (partnerApplicationId) where.partnerApplicationId = partnerApplicationId;
  if (success !== undefined) where.success = success;

  const [logs, total] = await Promise.all([
    prisma.emailNotificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.emailNotificationLog.count({ where })
  ]);

  return {
    logs,
    total,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
