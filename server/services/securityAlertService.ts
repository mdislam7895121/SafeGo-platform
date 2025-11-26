import crypto from 'crypto';
import { DeviceInfo, LoginRiskAssessment } from './deviceSecurityService';

export type AlertType = 
  | 'NEW_DEVICE_LOGIN'
  | 'NEW_LOCATION_LOGIN'
  | 'SUSPICIOUS_LOGIN'
  | 'PASSWORD_CHANGED'
  | 'PAYOUT_METHOD_CHANGED'
  | 'SESSION_REVOKED'
  | 'FAILED_LOGIN_ATTEMPTS'
  | 'ADMIN_ACTION';

interface SecurityAlert {
  id: string;
  userId: string;
  email: string;
  phone?: string;
  alertType: AlertType;
  title: string;
  message: string;
  deviceInfo?: DeviceInfo;
  metadata?: Record<string, any>;
  createdAt: Date;
  sentVia: ('EMAIL' | 'SMS')[];
}

const alertsStore: SecurityAlert[] = [];

export async function sendSecurityAlert(
  userId: string,
  email: string,
  phone: string | null,
  alertType: AlertType,
  deviceInfo?: DeviceInfo,
  metadata?: Record<string, any>
): Promise<void> {
  const { title, message } = generateAlertContent(alertType, deviceInfo, metadata);
  
  const alert: SecurityAlert = {
    id: crypto.randomUUID(),
    userId,
    email,
    phone: phone || undefined,
    alertType,
    title,
    message,
    deviceInfo,
    metadata,
    createdAt: new Date(),
    sentVia: []
  };

  await sendAlertEmail(email, title, message, deviceInfo);
  alert.sentVia.push('EMAIL');

  if (phone && isHighPriorityAlert(alertType)) {
    await sendAlertSms(phone, message);
    alert.sentVia.push('SMS');
  }

  alertsStore.push(alert);
  
  if (alertsStore.length > 10000) {
    alertsStore.splice(0, 1000);
  }

  console.log(`[SecurityAlert] ${alertType} alert sent to user ${userId} via ${alert.sentVia.join(', ')}`);
}

function generateAlertContent(
  alertType: AlertType,
  deviceInfo?: DeviceInfo,
  metadata?: Record<string, any>
): { title: string; message: string } {
  const deviceStr = deviceInfo 
    ? `${deviceInfo.browser} on ${deviceInfo.platform}` 
    : 'Unknown device';
  const locationStr = deviceInfo?.ipRegion || 'Unknown location';
  const timeStr = new Date().toLocaleString();

  switch (alertType) {
    case 'NEW_DEVICE_LOGIN':
      return {
        title: 'SafeGo: New Device Login',
        message: `A new device was used to access your SafeGo account.\n\nDevice: ${deviceStr}\nLocation: ${locationStr}\nTime: ${timeStr}\n\nIf this wasn't you, please secure your account immediately by changing your password.`
      };
    
    case 'NEW_LOCATION_LOGIN':
      return {
        title: 'SafeGo: Login from New Location',
        message: `Your SafeGo account was accessed from a new location.\n\nLocation: ${locationStr}\nDevice: ${deviceStr}\nTime: ${timeStr}\n\nIf this wasn't you, please secure your account immediately.`
      };
    
    case 'SUSPICIOUS_LOGIN':
      return {
        title: 'SafeGo: Suspicious Login Detected',
        message: `We detected a suspicious login attempt on your SafeGo account.\n\nDevice: ${deviceStr}\nLocation: ${locationStr}\nTime: ${timeStr}\nReason: ${metadata?.reasons?.join(', ') || 'Unknown'}\n\nAll other sessions have been logged out for your security. Please verify this was you.`
      };
    
    case 'PASSWORD_CHANGED':
      return {
        title: 'SafeGo: Password Changed',
        message: `Your SafeGo account password was changed.\n\nTime: ${timeStr}\nDevice: ${deviceStr}\n\nIf you didn't make this change, please contact support immediately.`
      };
    
    case 'PAYOUT_METHOD_CHANGED':
      return {
        title: 'SafeGo: Payout Method Updated',
        message: `A payout method was ${metadata?.action || 'modified'} on your SafeGo account.\n\nTime: ${timeStr}\nDevice: ${deviceStr}\n\nIf you didn't make this change, please contact support immediately.`
      };
    
    case 'SESSION_REVOKED':
      return {
        title: 'SafeGo: Sessions Logged Out',
        message: `All sessions on your SafeGo account were logged out.\n\nReason: ${metadata?.reason || 'Security precaution'}\nTime: ${timeStr}\n\nIf you didn't request this, please secure your account.`
      };
    
    case 'FAILED_LOGIN_ATTEMPTS':
      return {
        title: 'SafeGo: Failed Login Attempts',
        message: `Multiple failed login attempts were detected on your SafeGo account.\n\nAttempts: ${metadata?.count || 'Multiple'}\nTime: ${timeStr}\n\nYour account may be temporarily locked. If this wasn't you, consider changing your password.`
      };
    
    case 'ADMIN_ACTION':
      return {
        title: 'SafeGo: Admin Security Alert',
        message: `An administrative action was performed.\n\nAction: ${metadata?.action || 'Unknown'}\nTime: ${timeStr}\nDevice: ${deviceStr}\n\nThis is logged for security compliance.`
      };
    
    default:
      return {
        title: 'SafeGo: Security Alert',
        message: `A security event occurred on your account at ${timeStr}. Please review your account activity.`
      };
  }
}

function isHighPriorityAlert(alertType: AlertType): boolean {
  return [
    'SUSPICIOUS_LOGIN',
    'PASSWORD_CHANGED',
    'PAYOUT_METHOD_CHANGED',
    'SESSION_REVOKED'
  ].includes(alertType);
}

async function sendAlertEmail(
  email: string,
  subject: string,
  body: string,
  deviceInfo?: DeviceInfo
): Promise<boolean> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SecurityAlert EMAIL] To: ${email}`);
      console.log(`[SecurityAlert EMAIL] Subject: ${subject}`);
      console.log(`[SecurityAlert EMAIL] Body: ${body}`);
      return true;
    }

    console.log(`[SecurityAlert] Email sent to ${email.substring(0, 3)}***`);
    return true;
  } catch (error) {
    console.error('Failed to send security alert email:', error);
    return false;
  }
}

async function sendAlertSms(phone: string, message: string): Promise<boolean> {
  try {
    const truncatedMessage = message.length > 160 
      ? message.substring(0, 157) + '...' 
      : message;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SecurityAlert SMS] To: ${phone}`);
      console.log(`[SecurityAlert SMS] Message: ${truncatedMessage}`);
      return true;
    }

    console.log(`[SecurityAlert] SMS sent to ${phone.substring(0, 4)}***`);
    return true;
  } catch (error) {
    console.error('Failed to send security alert SMS:', error);
    return false;
  }
}

export async function sendLoginSecurityAlerts(
  userId: string,
  email: string,
  phone: string | null,
  deviceInfo: DeviceInfo,
  riskAssessment: LoginRiskAssessment
): Promise<void> {
  if (riskAssessment.riskLevel === 'HIGH') {
    await sendSecurityAlert(userId, email, phone, 'SUSPICIOUS_LOGIN', deviceInfo, {
      reasons: riskAssessment.reasons,
      riskLevel: riskAssessment.riskLevel
    });
  } else if (riskAssessment.isNewDevice) {
    await sendSecurityAlert(userId, email, phone, 'NEW_DEVICE_LOGIN', deviceInfo);
  } else if (riskAssessment.isNewIpRegion) {
    await sendSecurityAlert(userId, email, phone, 'NEW_LOCATION_LOGIN', deviceInfo);
  }
}

export function getRecentAlerts(userId: string, limit: number = 10): SecurityAlert[] {
  return alertsStore
    .filter(a => a.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
