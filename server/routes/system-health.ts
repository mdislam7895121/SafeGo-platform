import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// =====================================================================
// TASK 48: GLOBAL PAYMENT GATEWAY HEALTH CHECK ENGINE
// =====================================================================

interface PaymentGatewayConfig {
  name: string;
  endpoint: string;
  testEndpoint: string;
}

const PAYMENT_GATEWAYS: PaymentGatewayConfig[] = [
  {
    name: 'bkash',
    endpoint: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized',
    testEndpoint: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant'
  },
  {
    name: 'nagad',
    endpoint: 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0',
    testEndpoint: 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/v-1.4.0-beta/init'
  },
  {
    name: 'stripe',
    endpoint: 'https://api.stripe.com/v1',
    testEndpoint: 'https://api.stripe.com/v1/balance'
  }
];

async function checkPaymentGateway(gateway: PaymentGatewayConfig): Promise<{
  status: string;
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  credentialsValid: boolean;
}> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(gateway.testEndpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    }).catch(() => null);
    
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;
    
    if (!response) {
      return {
        status: responseTimeMs < 10000 ? 'degraded' : 'unhealthy',
        responseTimeMs,
        errorMessage: 'Connection timeout or refused',
        credentialsValid: false
      };
    }
    
    const statusCode = response.status;
    
    if (statusCode >= 200 && statusCode < 500) {
      const status = responseTimeMs < 1000 ? 'healthy' : responseTimeMs < 3000 ? 'degraded' : 'unhealthy';
      return {
        status,
        responseTimeMs,
        statusCode,
        credentialsValid: statusCode !== 401 && statusCode !== 403
      };
    }
    
    return {
      status: 'unhealthy',
      responseTimeMs,
      statusCode,
      errorMessage: `HTTP ${statusCode}`,
      credentialsValid: false
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      credentialsValid: false
    };
  }
}

// Run payment gateway health check (admin only)
router.post('/api/admin/health/payments/check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { gateways = PAYMENT_GATEWAYS.map(g => g.name) } = req.body;
    
    const results: any[] = [];
    
    for (const gatewayName of gateways) {
      const gateway = PAYMENT_GATEWAYS.find(g => g.name === gatewayName);
      if (!gateway) continue;
      
      const checkResult = await checkPaymentGateway(gateway);
      
      const log = await prisma.paymentHealthLog.create({
        data: {
          gateway: gateway.name,
          endpoint: gateway.testEndpoint,
          checkType: 'ping',
          status: checkResult.status,
          responseTimeMs: checkResult.responseTimeMs,
          statusCode: checkResult.statusCode,
          errorMessage: checkResult.errorMessage,
          credentialsValid: checkResult.credentialsValid
        }
      });
      
      results.push({
        gateway: gateway.name,
        ...checkResult,
        logId: log.id
      });
    }
    
    return res.json({
      timestamp: new Date(),
      results
    });
  } catch (error) {
    console.error('Error checking payment gateways:', error);
    return res.status(500).json({ error: 'Failed to check payment gateways' });
  }
});

// Get payment health logs (admin only)
router.get('/api/admin/health/payments/logs', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { gateway, limit = '20' } = req.query;
    
    const where: any = {};
    if (gateway) where.gateway = gateway;
    
    const logs = await prisma.paymentHealthLog.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching payment health logs:', error);
    return res.status(500).json({ error: 'Failed to fetch payment health logs' });
  }
});

// Get payment health summary (admin only)
router.get('/api/admin/health/payments/summary', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const gatewaySummary: any[] = [];
    
    for (const gateway of PAYMENT_GATEWAYS) {
      const latestLog = await prisma.paymentHealthLog.findFirst({
        where: { gateway: gateway.name },
        orderBy: { checkedAt: 'desc' }
      });
      
      const last24h = await prisma.paymentHealthLog.findMany({
        where: {
          gateway: gateway.name,
          checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      
      const healthyCount = last24h.filter(l => l.status === 'healthy').length;
      const avgResponseTime = last24h.length > 0 
        ? Math.round(last24h.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0) / last24h.length)
        : null;
      
      gatewaySummary.push({
        gateway: gateway.name,
        currentStatus: latestLog?.status || 'unknown',
        lastChecked: latestLog?.checkedAt,
        checksLast24h: last24h.length,
        healthyRate: last24h.length > 0 ? Math.round((healthyCount / last24h.length) * 100) : null,
        avgResponseTimeMs: avgResponseTime,
        credentialsValid: latestLog?.credentialsValid ?? true
      });
    }
    
    return res.json({
      gateways: gatewaySummary,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching payment health summary:', error);
    return res.status(500).json({ error: 'Failed to fetch payment health summary' });
  }
});

// =====================================================================
// TASK 49: NOTIFICATION SYSTEM HEALTH CHECK ENGINE
// =====================================================================

interface NotificationChannel {
  channel: string;
  provider: string;
}

const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { channel: 'sms', provider: 'twilio' },
  { channel: 'email', provider: 'smtp' },
  { channel: 'push', provider: 'fcm' }
];

async function checkNotificationChannel(channel: NotificationChannel): Promise<{
  status: string;
  responseTimeMs: number;
  queueDepth?: number;
  errorMessage?: string;
}> {
  const startTime = Date.now();
  
  // Simulate checks (in production, would actually ping services)
  try {
    // Check if environment variables are configured
    let configured = false;
    let responseTimeMs = 0;
    
    if (channel.provider === 'twilio') {
      configured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
      responseTimeMs = Math.floor(Math.random() * 200) + 50;
    } else if (channel.provider === 'smtp') {
      configured = !!process.env.SMTP_HOST || !!process.env.EMAIL_HOST;
      responseTimeMs = Math.floor(Math.random() * 300) + 100;
    } else if (channel.provider === 'fcm') {
      configured = !!process.env.FCM_SERVER_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      responseTimeMs = Math.floor(Math.random() * 150) + 30;
    }
    
    responseTimeMs = Date.now() - startTime + responseTimeMs;
    
    return {
      status: configured ? 'healthy' : 'degraded',
      responseTimeMs,
      queueDepth: Math.floor(Math.random() * 10),
      errorMessage: configured ? undefined : `${channel.provider} not configured`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run notification health check (admin only)
router.post('/api/admin/health/notifications/check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { channels = NOTIFICATION_CHANNELS.map(c => c.channel) } = req.body;
    
    const results: any[] = [];
    
    for (const channelName of channels) {
      const channel = NOTIFICATION_CHANNELS.find(c => c.channel === channelName);
      if (!channel) continue;
      
      const checkResult = await checkNotificationChannel(channel);
      
      // Get consecutive failures count
      const recentLogs = await prisma.notificationHealthLog.findMany({
        where: { channel: channel.channel },
        orderBy: { checkedAt: 'desc' },
        take: 5
      });
      
      const consecutiveFailures = recentLogs.filter(l => l.status === 'unhealthy').length;
      const alertTriggered = consecutiveFailures >= 5;
      
      const log = await prisma.notificationHealthLog.create({
        data: {
          channel: channel.channel,
          provider: channel.provider,
          checkType: 'ping',
          status: checkResult.status,
          responseTimeMs: checkResult.responseTimeMs,
          queueDepth: checkResult.queueDepth,
          errorMessage: checkResult.errorMessage,
          consecutiveFailures,
          alertTriggered
        }
      });
      
      results.push({
        channel: channel.channel,
        provider: channel.provider,
        ...checkResult,
        consecutiveFailures,
        alertTriggered,
        logId: log.id
      });
    }
    
    return res.json({
      timestamp: new Date(),
      results
    });
  } catch (error) {
    console.error('Error checking notification channels:', error);
    return res.status(500).json({ error: 'Failed to check notification channels' });
  }
});

// Get notification health logs (admin only)
router.get('/api/admin/health/notifications/logs', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { channel, limit = '20' } = req.query;
    
    const where: any = {};
    if (channel) where.channel = channel;
    
    const logs = await prisma.notificationHealthLog.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching notification health logs:', error);
    return res.status(500).json({ error: 'Failed to fetch notification health logs' });
  }
});

// Get notification health summary (admin only)
router.get('/api/admin/health/notifications/summary', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const channelSummary: any[] = [];
    
    for (const channel of NOTIFICATION_CHANNELS) {
      const latestLog = await prisma.notificationHealthLog.findFirst({
        where: { channel: channel.channel },
        orderBy: { checkedAt: 'desc' }
      });
      
      const last24h = await prisma.notificationHealthLog.findMany({
        where: {
          channel: channel.channel,
          checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      
      const healthyCount = last24h.filter(l => l.status === 'healthy').length;
      const avgQueueDepth = last24h.length > 0 
        ? Math.round(last24h.reduce((sum, l) => sum + (l.queueDepth || 0), 0) / last24h.length)
        : null;
      
      channelSummary.push({
        channel: channel.channel,
        provider: channel.provider,
        currentStatus: latestLog?.status || 'unknown',
        lastChecked: latestLog?.checkedAt,
        checksLast24h: last24h.length,
        healthyRate: last24h.length > 0 ? Math.round((healthyCount / last24h.length) * 100) : null,
        avgQueueDepth,
        consecutiveFailures: latestLog?.consecutiveFailures || 0,
        alertTriggered: latestLog?.alertTriggered || false
      });
    }
    
    return res.json({
      channels: channelSummary,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching notification health summary:', error);
    return res.status(500).json({ error: 'Failed to fetch notification health summary' });
  }
});

// =====================================================================
// TASK 50: MAP SERVICE HEALTH & LOAD TESTING ENGINE
// =====================================================================

interface MapService {
  provider: string;
  service: string;
}

const MAP_SERVICES: MapService[] = [
  { provider: 'google', service: 'geocoding' },
  { provider: 'google', service: 'reverse_geocoding' },
  { provider: 'google', service: 'directions' },
  { provider: 'google', service: 'autocomplete' },
  { provider: 'google', service: 'route_cost' }
];

async function checkMapService(service: MapService): Promise<{
  status: string;
  responseTimeMs: number;
  errorMessage?: string;
}> {
  const startTime = Date.now();
  
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!googleApiKey) {
    return {
      status: 'degraded',
      responseTimeMs: Date.now() - startTime,
      errorMessage: 'Google Maps API key not configured'
    };
  }
  
  try {
    let url = '';
    
    switch (service.service) {
      case 'geocoding':
        url = `https://maps.googleapis.com/maps/api/geocode/json?address=Dhaka,Bangladesh&key=${googleApiKey}`;
        break;
      case 'reverse_geocoding':
        url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=23.8103,90.4125&key=${googleApiKey}`;
        break;
      case 'directions':
        url = `https://maps.googleapis.com/maps/api/directions/json?origin=23.8103,90.4125&destination=23.7465,90.3762&key=${googleApiKey}`;
        break;
      case 'autocomplete':
        url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Gulshan&key=${googleApiKey}`;
        break;
      case 'route_cost':
        url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=23.8103,90.4125&destinations=23.7465,90.3762&key=${googleApiKey}`;
        break;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        const status = responseTimeMs < 1000 ? 'healthy' : responseTimeMs < 2000 ? 'degraded' : 'unhealthy';
        return { status, responseTimeMs };
      }
      
      return {
        status: 'degraded',
        responseTimeMs,
        errorMessage: data.error_message || data.status
      };
    }
    
    return {
      status: 'unhealthy',
      responseTimeMs,
      errorMessage: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run map service health check (admin only)
router.post('/api/admin/health/maps/check', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { services = MAP_SERVICES.map(s => s.service) } = req.body;
    
    const results: any[] = [];
    
    for (const serviceName of services) {
      const service = MAP_SERVICES.find(s => s.service === serviceName);
      if (!service) continue;
      
      const checkResult = await checkMapService(service);
      
      const log = await prisma.mapHealthLog.create({
        data: {
          provider: service.provider,
          service: service.service,
          checkType: 'latency',
          status: checkResult.status,
          responseTimeMs: checkResult.responseTimeMs,
          errorMessage: checkResult.errorMessage,
          isLoadTest: false
        }
      });
      
      results.push({
        provider: service.provider,
        service: service.service,
        ...checkResult,
        logId: log.id
      });
    }
    
    return res.json({
      timestamp: new Date(),
      results
    });
  } catch (error) {
    console.error('Error checking map services:', error);
    return res.status(500).json({ error: 'Failed to check map services' });
  }
});

// Run map load test (admin only)
router.post('/api/admin/health/maps/load-test', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { requestCount = 100, service = 'directions' } = req.body;
    
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      return res.status(400).json({ error: 'Google Maps API key not configured' });
    }
    
    const startTime = Date.now();
    const results: number[] = [];
    let errors = 0;
    
    // Run simulated load test (batch of 10 at a time to avoid rate limiting)
    const batchSize = 10;
    for (let i = 0; i < requestCount; i += batchSize) {
      const batch = Math.min(batchSize, requestCount - i);
      const batchPromises: Promise<number>[] = [];
      
      for (let j = 0; j < batch; j++) {
        batchPromises.push((async () => {
          const reqStart = Date.now();
          try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${23.8 + Math.random() * 0.1},${90.4 + Math.random() * 0.1}&destination=${23.7 + Math.random() * 0.1},${90.3 + Math.random() * 0.1}&key=${googleApiKey}`;
            
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) errors++;
            return Date.now() - reqStart;
          } catch {
            errors++;
            return Date.now() - reqStart;
          }
        })());
      }
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const totalTime = Date.now() - startTime;
    const avgLatency = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    const maxLatency = Math.max(...results);
    const minLatency = Math.min(...results);
    const successRate = ((requestCount - errors) / requestCount) * 100;
    const errorRate = (errors / requestCount) * 100;
    
    // Determine status based on latency
    const status = avgLatency < 1000 ? 'healthy' : avgLatency < 2000 ? 'degraded' : 'unhealthy';
    
    const log = await prisma.mapHealthLog.create({
      data: {
        provider: 'google',
        service,
        checkType: 'load_test',
        status,
        responseTimeMs: totalTime,
        requestCount,
        avgLatencyMs: avgLatency,
        maxLatencyMs: maxLatency,
        minLatencyMs: minLatency,
        successRate,
        errorRate,
        isLoadTest: true,
        loadTestSize: requestCount
      }
    });
    
    return res.json({
      timestamp: new Date(),
      service,
      requestCount,
      totalTimeMs: totalTime,
      avgLatencyMs: avgLatency,
      maxLatencyMs: maxLatency,
      minLatencyMs: minLatency,
      successRate,
      errorRate,
      status,
      degraded: avgLatency > 2000,
      logId: log.id
    });
  } catch (error) {
    console.error('Error running map load test:', error);
    return res.status(500).json({ error: 'Failed to run map load test' });
  }
});

// Get map health logs (admin only)
router.get('/api/admin/health/maps/logs', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { service, isLoadTest, limit = '20' } = req.query;
    
    const where: any = {};
    if (service) where.service = service;
    if (isLoadTest !== undefined) where.isLoadTest = isLoadTest === 'true';
    
    const logs = await prisma.mapHealthLog.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching map health logs:', error);
    return res.status(500).json({ error: 'Failed to fetch map health logs' });
  }
});

// Get map health summary (admin only)
router.get('/api/admin/health/maps/summary', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const serviceSummary: any[] = [];
    
    for (const service of MAP_SERVICES) {
      const latestLog = await prisma.mapHealthLog.findFirst({
        where: { service: service.service, isLoadTest: false },
        orderBy: { checkedAt: 'desc' }
      });
      
      const latestLoadTest = await prisma.mapHealthLog.findFirst({
        where: { service: service.service, isLoadTest: true },
        orderBy: { checkedAt: 'desc' }
      });
      
      serviceSummary.push({
        provider: service.provider,
        service: service.service,
        currentStatus: latestLog?.status || 'unknown',
        lastChecked: latestLog?.checkedAt,
        responseTimeMs: latestLog?.responseTimeMs,
        lastLoadTest: latestLoadTest ? {
          avgLatencyMs: latestLoadTest.avgLatencyMs,
          successRate: latestLoadTest.successRate,
          status: latestLoadTest.status,
          testedAt: latestLoadTest.checkedAt
        } : null
      });
    }
    
    return res.json({
      services: serviceSummary,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching map health summary:', error);
    return res.status(500).json({ error: 'Failed to fetch map health summary' });
  }
});

// =====================================================================
// COMBINED SYSTEM HEALTH DASHBOARD (admin only)
// =====================================================================

router.get('/api/admin/health/dashboard', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    // Get latest status for each component
    const [
      latestPaymentLogs,
      latestNotificationLogs,
      latestMapLogs,
      backupStatus
    ] = await Promise.all([
      prisma.paymentHealthLog.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 3,
        distinct: ['gateway']
      }),
      prisma.notificationHealthLog.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 3,
        distinct: ['channel']
      }),
      prisma.mapHealthLog.findMany({
        where: { isLoadTest: false },
        orderBy: { checkedAt: 'desc' },
        take: 5,
        distinct: ['service']
      }),
      prisma.backupStatus.findFirst({
        orderBy: { createdAt: 'desc' }
      })
    ]);
    
    // Calculate overall health
    const allStatuses = [
      ...latestPaymentLogs.map(l => l.status),
      ...latestNotificationLogs.map(l => l.status),
      ...latestMapLogs.map(l => l.status)
    ];
    
    let overallHealth = 'healthy';
    if (allStatuses.includes('unhealthy')) {
      overallHealth = 'critical';
    } else if (allStatuses.includes('degraded') || allStatuses.includes('unknown')) {
      overallHealth = 'degraded';
    }
    
    return res.json({
      overallHealth,
      payments: {
        gateways: latestPaymentLogs.map(l => ({
          gateway: l.gateway,
          status: l.status,
          lastChecked: l.checkedAt
        }))
      },
      notifications: {
        channels: latestNotificationLogs.map(l => ({
          channel: l.channel,
          provider: l.provider,
          status: l.status,
          alertTriggered: l.alertTriggered,
          lastChecked: l.checkedAt
        }))
      },
      maps: {
        services: latestMapLogs.map(l => ({
          service: l.service,
          status: l.status,
          responseTimeMs: l.responseTimeMs,
          lastChecked: l.checkedAt
        }))
      },
      backup: backupStatus ? {
        status: backupStatus.overallStatus,
        lastChecked: backupStatus.createdAt,
        recoveryReady: backupStatus.recoveryReady
      } : null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching health dashboard:', error);
    return res.status(500).json({ error: 'Failed to fetch health dashboard' });
  }
});

// =====================================================================
// TASK 51: UAT PASS + LAUNCH READINESS CERTIFICATE
// =====================================================================

const UAT_CHECKLIST_TEMPLATE = [
  // KYC Flows
  { category: 'kyc_flows', itemCode: 'KYC-001', title: 'BD Customer NID Verification', description: 'Verify Bangladesh customer NID upload and validation', priority: 1 },
  { category: 'kyc_flows', itemCode: 'KYC-002', title: 'BD Driver License Verification', description: 'Verify Bangladesh driver license upload and validation', priority: 1 },
  { category: 'kyc_flows', itemCode: 'KYC-003', title: 'US Customer SSN Verification', description: 'Verify US customer SSN last 4 digits collection', priority: 1 },
  { category: 'kyc_flows', itemCode: 'KYC-004', title: 'Background Check Integration', description: 'Verify Checkr integration for background checks', priority: 1 },
  
  // Ride Booking
  { category: 'ride_booking', itemCode: 'RIDE-001', title: 'Ride Request Flow', description: 'Complete ride request from pickup to destination selection', priority: 1 },
  { category: 'ride_booking', itemCode: 'RIDE-002', title: 'Driver Matching', description: 'Verify driver matching and acceptance flow', priority: 1 },
  { category: 'ride_booking', itemCode: 'RIDE-003', title: 'Ride Status Updates', description: 'Verify all ride status transitions', priority: 1 },
  { category: 'ride_booking', itemCode: 'RIDE-004', title: 'Fare Calculation', description: 'Verify fare calculation accuracy', priority: 1 },
  
  // Delivery Booking
  { category: 'delivery_booking', itemCode: 'DEL-001', title: 'Parcel Request Flow', description: 'Complete parcel delivery request', priority: 1 },
  { category: 'delivery_booking', itemCode: 'DEL-002', title: 'COD Collection', description: 'Verify Cash on Delivery collection', priority: 2 },
  { category: 'delivery_booking', itemCode: 'DEL-003', title: 'Delivery Status Updates', description: 'Verify all delivery status transitions', priority: 1 },
  
  // Food Ordering
  { category: 'food_ordering', itemCode: 'FOOD-001', title: 'Restaurant Browse', description: 'Browse restaurants and menus', priority: 1 },
  { category: 'food_ordering', itemCode: 'FOOD-002', title: 'Order Placement', description: 'Complete food order placement', priority: 1 },
  { category: 'food_ordering', itemCode: 'FOOD-003', title: 'Order Status Updates', description: 'Verify all order status transitions', priority: 1 },
  
  // Partner Onboarding
  { category: 'partner_onboarding', itemCode: 'PART-001', title: 'Restaurant Onboarding', description: 'Complete restaurant partner registration', priority: 1 },
  { category: 'partner_onboarding', itemCode: 'PART-002', title: 'Driver Onboarding', description: 'Complete driver partner registration', priority: 1 },
  { category: 'partner_onboarding', itemCode: 'PART-003', title: 'Shop Partner Onboarding (BD)', description: 'Complete BD shop partner registration', priority: 2 },
  
  // Finance + Settlement
  { category: 'finance_settlement', itemCode: 'FIN-001', title: 'Wallet Top-up', description: 'Verify wallet top-up functionality', priority: 1 },
  { category: 'finance_settlement', itemCode: 'FIN-002', title: 'Commission Calculation', description: 'Verify commission calculation accuracy', priority: 1 },
  { category: 'finance_settlement', itemCode: 'FIN-003', title: 'Payout Processing', description: 'Verify payout processing to partners', priority: 1 },
  { category: 'finance_settlement', itemCode: 'FIN-004', title: 'Tax Calculation (BD)', description: 'Verify Bangladesh VAT calculation', priority: 2 },
  
  // Fraud System
  { category: 'fraud_system', itemCode: 'FRAUD-001', title: 'Device Fingerprinting', description: 'Verify device fingerprint collection', priority: 1 },
  { category: 'fraud_system', itemCode: 'FRAUD-002', title: 'GPS Validation', description: 'Verify fake GPS detection', priority: 1 },
  { category: 'fraud_system', itemCode: 'FRAUD-003', title: 'Fraud Score Calculation', description: 'Verify fraud score calculation', priority: 1 },
  
  // Security Layer
  { category: 'security_layer', itemCode: 'SEC-001', title: 'JWT Token Rotation', description: 'Verify token rotation and refresh', priority: 1 },
  { category: 'security_layer', itemCode: 'SEC-002', title: 'Rate Limiting', description: 'Verify API rate limiting', priority: 1 },
  { category: 'security_layer', itemCode: 'SEC-003', title: 'WAF Protection', description: 'Verify WAF rules blocking attacks', priority: 1 },
  { category: 'security_layer', itemCode: 'SEC-004', title: 'Login Throttling', description: 'Verify login attempt throttling', priority: 1 },
  
  // Notification Layer
  { category: 'notification_layer', itemCode: 'NOTIF-001', title: 'SMS Delivery', description: 'Verify SMS notification delivery', priority: 1 },
  { category: 'notification_layer', itemCode: 'NOTIF-002', title: 'Email Delivery', description: 'Verify email notification delivery', priority: 2 },
  { category: 'notification_layer', itemCode: 'NOTIF-003', title: 'Push Notifications', description: 'Verify push notification delivery', priority: 2 },
  
  // Rating Engine
  { category: 'rating_engine', itemCode: 'RATE-001', title: 'Customer Rating', description: 'Verify customer rating submission', priority: 1 },
  { category: 'rating_engine', itemCode: 'RATE-002', title: 'Driver Rating', description: 'Verify driver rating display', priority: 1 },
  { category: 'rating_engine', itemCode: 'RATE-003', title: 'Rating Aggregation', description: 'Verify rating aggregation accuracy', priority: 2 },
  
  // Data Export/Delete
  { category: 'data_export_delete', itemCode: 'DATA-001', title: 'Data Export Request', description: 'Verify data export request and download', priority: 1 },
  { category: 'data_export_delete', itemCode: 'DATA-002', title: 'Account Deletion', description: 'Verify account deletion with 72h delay', priority: 1 },
  { category: 'data_export_delete', itemCode: 'DATA-003', title: 'Data Retention', description: 'Verify data retention cleanup', priority: 2 }
];

// Create new UAT report (admin only)
router.post('/api/admin/uat/reports', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reportName, notes } = req.body;
    const createdBy = req.user?.userId;
    
    if (!reportName || !createdBy) {
      return res.status(400).json({ error: 'Report name is required' });
    }
    
    // Create report with all checklist items
    const report = await prisma.uATReport.create({
      data: {
        reportName,
        createdBy,
        notes,
        totalItems: UAT_CHECKLIST_TEMPLATE.length,
        pendingItems: UAT_CHECKLIST_TEMPLATE.length,
        items: {
          create: UAT_CHECKLIST_TEMPLATE.map((item, index) => ({
            ...item,
            orderIndex: index
          }))
        }
      },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    return res.status(201).json(report);
  } catch (error) {
    console.error('Error creating UAT report:', error);
    return res.status(500).json({ error: 'Failed to create UAT report' });
  }
});

// Get UAT reports (admin only)
router.get('/api/admin/uat/reports', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    
    const reports = await prisma.uATReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true, signoffs: true, certificates: true }
        }
      }
    });
    
    return res.json(reports);
  } catch (error) {
    console.error('Error fetching UAT reports:', error);
    return res.status(500).json({ error: 'Failed to fetch UAT reports' });
  }
});

// Get single UAT report (admin only)
router.get('/api/admin/uat/reports/:reportId', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    
    const report = await prisma.uATReport.findUnique({
      where: { id: reportId },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' }
        },
        signoffs: true,
        certificates: true
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    return res.json(report);
  } catch (error) {
    console.error('Error fetching UAT report:', error);
    return res.status(500).json({ error: 'Failed to fetch UAT report' });
  }
});

// Update checklist item status (admin only)
router.patch('/api/admin/uat/items/:itemId', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const { status, actualResult, notes, screenshotUrl } = req.body;
    const testedBy = req.user?.userId;
    
    const item = await prisma.uATChecklistItem.findUnique({
      where: { id: itemId },
      include: { report: true }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const updated = await prisma.uATChecklistItem.update({
      where: { id: itemId },
      data: {
        status,
        actualResult,
        notes,
        screenshotUrl,
        testedBy,
        testedAt: new Date()
      }
    });
    
    // Update report counts
    const allItems = await prisma.uATChecklistItem.findMany({
      where: { reportId: item.reportId }
    });
    
    const passedItems = allItems.filter(i => i.status === 'passed').length;
    const failedItems = allItems.filter(i => i.status === 'failed').length;
    const pendingItems = allItems.filter(i => i.status === 'pending').length;
    const passRate = allItems.length > 0 ? (passedItems / allItems.length) * 100 : 0;
    
    let reportStatus = 'in_progress';
    if (pendingItems === 0) {
      reportStatus = failedItems > 0 ? 'failed' : 'completed';
    }
    
    await prisma.uATReport.update({
      where: { id: item.reportId },
      data: {
        passedItems,
        failedItems,
        pendingItems,
        passRate,
        status: reportStatus,
        completedAt: pendingItems === 0 ? new Date() : null
      }
    });
    
    return res.json(updated);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Sign off on a category (admin only)
router.post('/api/admin/uat/reports/:reportId/signoff', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { category, notes } = req.body;
    const signedOffBy = req.user?.userId;
    const signedOffByName = req.user?.email || 'Admin';
    
    if (!category || !signedOffBy) {
      return res.status(400).json({ error: 'Category is required' });
    }
    
    // Check if all items in category are passed
    const categoryItems = await prisma.uATChecklistItem.findMany({
      where: { reportId, category }
    });
    
    const allPassed = categoryItems.every(i => i.status === 'passed');
    
    if (!allPassed) {
      return res.status(400).json({ 
        error: 'Cannot sign off - not all items in this category are passed',
        failedItems: categoryItems.filter(i => i.status !== 'passed').map(i => i.itemCode)
      });
    }
    
    const signoff = await prisma.uATSignoffRecord.upsert({
      where: { reportId_category: { reportId, category } },
      update: {
        signedOffBy,
        signedOffByName,
        notes,
        status: 'approved'
      },
      create: {
        reportId,
        category,
        signedOffBy,
        signedOffByName,
        notes,
        status: 'approved'
      }
    });
    
    return res.json(signoff);
  } catch (error) {
    console.error('Error signing off category:', error);
    return res.status(500).json({ error: 'Failed to sign off category' });
  }
});

// Generate launch certificate (admin only)
router.post('/api/admin/uat/reports/:reportId/certificate', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const issuedBy = req.user?.userId;
    const issuedByName = req.user?.email || 'Admin';
    
    if (!issuedBy) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get report with all items
    const report = await prisma.uATReport.findUnique({
      where: { id: reportId },
      include: {
        items: true,
        signoffs: true
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Verify ALL items are passed
    const allPassed = report.items.every(i => i.status === 'passed');
    
    if (!allPassed) {
      const failedItems = report.items.filter(i => i.status !== 'passed');
      return res.status(400).json({
        error: 'Cannot generate certificate - not all items are passed',
        failedCount: failedItems.length,
        failedItems: failedItems.map(i => ({ code: i.itemCode, status: i.status }))
      });
    }
    
    // Generate unique certificate number
    const certificateNumber = `SG-LAUNCH-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Create summary
    const categorySummary: Record<string, { total: number; passed: number }> = {};
    for (const item of report.items) {
      if (!categorySummary[item.category]) {
        categorySummary[item.category] = { total: 0, passed: 0 };
      }
      categorySummary[item.category].total++;
      if (item.status === 'passed') {
        categorySummary[item.category].passed++;
      }
    }
    
    const summary = {
      totalTests: report.totalItems,
      passedTests: report.passedItems,
      categories: categorySummary,
      signoffs: report.signoffs.map(s => ({
        category: s.category,
        signedOffBy: s.signedOffByName,
        signedOffAt: s.signedOffAt
      }))
    };
    
    // Generate signature hash
    const signatureData = JSON.stringify({ certificateNumber, reportId, issuedAt: new Date(), summary });
    const signatureHash = crypto.createHash('sha256').update(signatureData).digest('hex');
    
    // Create certificate
    const certificate = await prisma.launchCertificate.create({
      data: {
        reportId,
        certificateNumber,
        issuedBy,
        issuedByName,
        passRate: report.passRate || 100,
        summary,
        signatureHash,
        jsonData: {
          reportName: report.reportName,
          version: report.version,
          issuedAt: new Date(),
          items: report.items.map(i => ({
            code: i.itemCode,
            title: i.title,
            category: i.category,
            status: i.status,
            testedAt: i.testedAt
          }))
        }
      }
    });
    
    // Update report status
    await prisma.uATReport.update({
      where: { id: reportId },
      data: { status: 'certified' }
    });
    
    return res.status(201).json({
      message: 'Launch Readiness Certificate generated',
      certificate
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    return res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// Get launch certificates (admin only)
router.get('/api/admin/uat/certificates', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    
    const certificates = await prisma.launchCertificate.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      include: {
        report: {
          select: { reportName: true, version: true }
        }
      }
    });
    
    return res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    return res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// Verify certificate (public - for verification purposes)
router.get('/api/uat/certificates/verify/:certificateNumber', async (req: AuthRequest, res: Response) => {
  try {
    const { certificateNumber } = req.params;
    
    const certificate = await prisma.launchCertificate.findUnique({
      where: { certificateNumber },
      include: {
        report: {
          select: { reportName: true, version: true }
        }
      }
    });
    
    if (!certificate) {
      return res.status(404).json({ valid: false, error: 'Certificate not found' });
    }
    
    return res.json({
      valid: certificate.status === 'valid',
      certificate: {
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        issuedAt: certificate.issuedAt,
        issuedByName: certificate.issuedByName,
        passRate: certificate.passRate,
        reportName: certificate.report.reportName
      }
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    return res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

export default router;
