// Stripe Initialization Service
// Initializes Stripe schema, managed webhooks, and data sync on startup
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, isStripeConfigured } from './stripeClient';

let stripeInitialized = false;
let webhookUuid: string | null = null;

export async function initStripe(): Promise<{ success: boolean; webhookUuid?: string; error?: string }> {
  if (stripeInitialized) {
    return { success: true, webhookUuid: webhookUuid || undefined };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[StripeInit] DATABASE_URL not set, skipping Stripe initialization');
    return { success: false, error: 'DATABASE_URL required' };
  }

  const configured = await isStripeConfigured();
  if (!configured) {
    console.log('[StripeInit] Stripe connection not configured, skipping initialization');
    return { success: false, error: 'Stripe connection not configured' };
  }

  try {
    console.log('[StripeInit] Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl
    });
    console.log('[StripeInit] Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('[StripeInit] Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'SafeGo managed webhook for Stripe sync',
      }
    );
    webhookUuid = uuid;
    console.log(`[StripeInit] Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    // Skip heavy backfill in development to reduce memory usage
    if (process.env.SKIP_STRIPE_SYNC === 'true' || (process.env.NODE_ENV === 'development' && process.env.FORCE_STRIPE_SYNC !== 'true')) {
      console.log('[StripeInit] Skipping Stripe backfill in development mode (set FORCE_STRIPE_SYNC=true to enable)');
    } else {
      console.log('[StripeInit] Starting Stripe data backfill...');
      stripeSync.syncBackfill()
        .then(() => {
          console.log('[StripeInit] Stripe data synced successfully');
        })
        .catch((err: any) => {
          console.error('[StripeInit] Error syncing Stripe data:', err);
        });
    }

    stripeInitialized = true;
    return { success: true, webhookUuid: uuid };
  } catch (error: any) {
    console.error('[StripeInit] Failed to initialize Stripe:', error);
    return { success: false, error: error.message };
  }
}

export function getWebhookUuid(): string | null {
  return webhookUuid;
}

export function isStripeInitialized(): boolean {
  return stripeInitialized;
}
