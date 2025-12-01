import { prisma } from '../db';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../utils/ip';

interface WebhookSignatureConfig {
  provider: string;
  secretKey: string;
  signatureHeader: string;
  timestampHeader?: string;
  algorithm: 'sha256' | 'sha512' | 'md5';
  maxAgeMs?: number;
}

const WEBHOOK_CONFIGS: Record<string, Partial<WebhookSignatureConfig>> = {
  stripe: {
    signatureHeader: 'stripe-signature',
    algorithm: 'sha256',
    maxAgeMs: 5 * 60 * 1000
  },
  bkash: {
    signatureHeader: 'x-bkash-signature',
    algorithm: 'sha256',
    maxAgeMs: 10 * 60 * 1000
  },
  nagad: {
    signatureHeader: 'x-nagad-signature',
    algorithm: 'sha256',
    maxAgeMs: 10 * 60 * 1000
  },
  paypal: {
    signatureHeader: 'paypal-transmission-sig',
    algorithm: 'sha256',
    maxAgeMs: 5 * 60 * 1000
  }
};

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export async function checkReplayAttack(
  provider: string,
  nonce: string,
  timestamp: Date
): Promise<{ isReplay: boolean; reason?: string }> {
  const existingNonce = await prisma.webhookNonce.findUnique({
    where: {
      provider_nonce: { provider, nonce }
    }
  });
  
  if (existingNonce) {
    return { isReplay: true, reason: 'Duplicate webhook nonce detected' };
  }
  
  const now = Date.now();
  const timestampMs = timestamp.getTime();
  
  if (Math.abs(now - timestampMs) > REPLAY_WINDOW_MS) {
    return { isReplay: true, reason: 'Webhook timestamp outside acceptable window' };
  }
  
  return { isReplay: false };
}

export async function recordWebhookNonce(
  provider: string,
  nonce: string,
  timestamp: Date,
  transactionId?: string,
  amount?: number
): Promise<void> {
  try {
    await prisma.webhookNonce.create({
      data: {
        provider,
        nonce,
        timestamp,
        transactionId,
        amount
      }
    });
  } catch (error: any) {
    if (error.code !== 'P2002') {
      console.error('[WebhookSecurity] Failed to record nonce:', error);
    }
  }
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secretKey: string,
  algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'
): boolean {
  const hmac = crypto.createHmac(algorithm, secretKey);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha\d+=/, '')),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function parseStripeSignature(
  signature: string
): { timestamp: number; signatures: string[] } | null {
  const parts = signature.split(',');
  let timestamp = 0;
  const signatures: string[] = [];
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }
  
  if (!timestamp || signatures.length === 0) {
    return null;
  }
  
  return { timestamp, signatures };
}

export async function logWebhookAttack(
  provider: string,
  sourceIp: string,
  path: string,
  reason: string,
  payload: any,
  transactionId?: string
): Promise<void> {
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload || {}))
    .digest('hex');
  
  try {
    await prisma.attackLog.create({
      data: {
        type: reason.includes('signature') ? 'signature_mismatch' : 
              reason.includes('replay') ? 'replay_attack' :
              reason.includes('amount') ? 'amount_mismatch' : 'suspicious_pattern',
        sourceIp,
        requestPath: path,
        requestMethod: 'POST',
        requestPayloadHash: payloadHash,
        detectionReason: reason,
        webhookProvider: provider,
        transactionId,
        blocked: true
      }
    });
  } catch (error) {
    console.error('[WebhookSecurity] Failed to log attack:', error);
  }
}

export function createWebhookSecurityMiddleware(provider: string, secretEnvVar: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = WEBHOOK_CONFIGS[provider];
    
    if (!config) {
      console.warn(`[WebhookSecurity] No config for provider: ${provider}`);
      next();
      return;
    }
    
    const secretKey = process.env[secretEnvVar];
    if (!secretKey) {
      console.warn(`[WebhookSecurity] Missing secret for ${provider}`);
      next();
      return;
    }
    
    const ip = getClientIp(req);
    const signature = req.headers[config.signatureHeader?.toLowerCase() || ''] as string;
    
    if (!signature) {
      await logWebhookAttack(provider, ip, req.path, 'Missing webhook signature', req.body);
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
    
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    if (provider === 'stripe') {
      const parsed = parseStripeSignature(signature);
      if (!parsed) {
        await logWebhookAttack(provider, ip, req.path, 'Invalid Stripe signature format', req.body);
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parsed.timestamp) > 300) {
        await logWebhookAttack(provider, ip, req.path, 'Webhook timestamp too old (replay attempt)', req.body);
        res.status(401).json({ error: 'Webhook timestamp expired' });
        return;
      }
      
      const signedPayload = `${parsed.timestamp}.${rawBody}`;
      const isValid = parsed.signatures.some(sig => 
        verifyWebhookSignature(signedPayload, sig, secretKey, 'sha256')
      );
      
      if (!isValid) {
        await logWebhookAttack(provider, ip, req.path, 'Invalid Stripe signature verification failed', req.body);
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      
      const nonce = `${parsed.timestamp}-${crypto.createHash('md5').update(rawBody).digest('hex')}`;
      const replayCheck = await checkReplayAttack(provider, nonce, new Date(parsed.timestamp * 1000));
      
      if (replayCheck.isReplay) {
        await logWebhookAttack(provider, ip, req.path, replayCheck.reason || 'Replay attack detected', req.body);
        res.status(409).json({ error: 'Duplicate webhook' });
        return;
      }
      
      await recordWebhookNonce(provider, nonce, new Date(parsed.timestamp * 1000));
      
    } else {
      const isValid = verifyWebhookSignature(rawBody, signature, secretKey, config.algorithm || 'sha256');
      
      if (!isValid) {
        await logWebhookAttack(provider, ip, req.path, `Invalid ${provider} signature`, req.body);
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      
      const nonce = crypto.createHash('md5').update(rawBody + Date.now()).digest('hex');
      await recordWebhookNonce(provider, nonce, new Date());
    }
    
    next();
  };
}

export async function validateWebhookAmount(
  transactionId: string,
  webhookAmount: number,
  expectedAmount: number,
  tolerance: number = 0.01
): Promise<{ valid: boolean; reason?: string }> {
  const diff = Math.abs(webhookAmount - expectedAmount);
  const percentDiff = diff / expectedAmount;
  
  if (percentDiff > tolerance) {
    return {
      valid: false,
      reason: `Amount mismatch: webhook=${webhookAmount}, expected=${expectedAmount}`
    };
  }
  
  return { valid: true };
}

export async function cleanupOldNonces(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  
  const result = await prisma.webhookNonce.deleteMany({
    where: { timestamp: { lt: cutoff } }
  });
  
  return result.count;
}

export const stripeWebhookSecurity = createWebhookSecurityMiddleware('stripe', 'STRIPE_WEBHOOK_SECRET');
export const bkashWebhookSecurity = createWebhookSecurityMiddleware('bkash', 'BKASH_WEBHOOK_SECRET');
export const nagadWebhookSecurity = createWebhookSecurityMiddleware('nagad', 'NAGAD_WEBHOOK_SECRET');
