export interface SafePilotContextDefinition {
  pageKey: string;
  pageName: string;
  description: string;
  category: 'dashboard' | 'operations' | 'finance' | 'security' | 'compliance' | 'marketing' | 'support';
  metrics: string[];
  actions: string[];
  risks: string[];
}

export const FALLBACK_CONTEXT: SafePilotContextDefinition = {
  pageKey: 'admin.unknown',
  pageName: 'Unknown',
  description: 'No specific context available',
  category: 'dashboard',
  metrics: [],
  actions: [],
  risks: [],
};

export const CONTEXT_REGISTRY: Record<string, SafePilotContextDefinition> = {
  'admin.dashboard': {
    pageKey: 'admin.dashboard',
    pageName: 'Dashboard',
    description: 'Platform overview and key performance indicators',
    category: 'dashboard',
    metrics: ['activeUsers', 'totalRides', 'totalOrders', 'cancellationRate', 'failureRate', 'revenue'],
    actions: ['viewAlerts', 'generateReport', 'exportData'],
    risks: ['highCancellations', 'lowDriverAvailability', 'paymentFailures'],
  },
  'admin.safepilot': {
    pageKey: 'admin.safepilot',
    pageName: 'SafePilot',
    description: 'AI-powered business automation and intelligence',
    category: 'operations',
    metrics: ['queriesProcessed', 'actionsExecuted', 'alertsGenerated'],
    actions: ['askQuestion', 'runAnalysis', 'viewHistory'],
    risks: ['systemLoad', 'responseLatency'],
  },
  'admin.safepilot-intelligence': {
    pageKey: 'admin.safepilot-intelligence',
    pageName: 'SafePilot Analytics',
    description: 'Advanced analytics and intelligence modules',
    category: 'operations',
    metrics: ['growthScore', 'costSavings', 'fraudAlerts', 'retentionRate'],
    actions: ['viewGrowth', 'viewCost', 'viewFraud', 'viewRetention'],
    risks: ['growthStagnation', 'costOverruns', 'fraudPatterns'],
  },
  'admin.drivers': {
    pageKey: 'admin.drivers',
    pageName: 'Drivers',
    description: 'Driver management and performance tracking',
    category: 'operations',
    metrics: ['totalDrivers', 'onlineDrivers', 'avgRating', 'pendingKyc', 'lowRatingCount'],
    actions: ['reviewLowRating', 'processKyc', 'suspendDriver', 'viewViolations'],
    risks: ['lowRatingDrivers', 'kycBacklog', 'behaviorViolations', 'safetyIncidents'],
  },
  'admin.customers': {
    pageKey: 'admin.customers',
    pageName: 'Customers',
    description: 'Customer management and engagement',
    category: 'operations',
    metrics: ['totalCustomers', 'activeCustomers', 'blockedCustomers', 'churnRisk'],
    actions: ['viewBlocked', 'reviewComplaints', 'sendNotification'],
    risks: ['highChurn', 'fraudulentAccounts', 'complaintBacklog'],
  },
  'admin.restaurants': {
    pageKey: 'admin.restaurants',
    pageName: 'Restaurants',
    description: 'Restaurant partner management',
    category: 'operations',
    metrics: ['totalRestaurants', 'activeRestaurants', 'pendingKyc', 'avgRating'],
    actions: ['reviewKyc', 'viewLowRating', 'manageMenu'],
    risks: ['kycBacklog', 'lowRatingPartners', 'orderIssues'],
  },
  'admin.rides': {
    pageKey: 'admin.rides',
    pageName: 'Rides',
    description: 'Ride management and monitoring',
    category: 'operations',
    metrics: ['totalRides', 'activeRides', 'completedToday', 'cancelledToday'],
    actions: ['viewActive', 'reviewCancelled', 'resolveDisputes'],
    risks: ['highCancellations', 'routeDeviations', 'safetyAlerts'],
  },
  'admin.food-orders': {
    pageKey: 'admin.food-orders',
    pageName: 'Food Orders',
    description: 'Food delivery order management',
    category: 'operations',
    metrics: ['totalOrders', 'activeOrders', 'deliveredToday', 'cancelledToday'],
    actions: ['viewActive', 'trackDelivery', 'resolveIssues'],
    risks: ['delayedOrders', 'qualityComplaints', 'refundRequests'],
  },
  'admin.payouts': {
    pageKey: 'admin.payouts',
    pageName: 'Payouts',
    description: 'Driver and partner payout management',
    category: 'finance',
    metrics: ['pendingPayouts', 'failedPayouts', 'processedToday', 'negativeBalances'],
    actions: ['processPending', 'retryFailed', 'viewNegativeBalances'],
    risks: ['payoutBacklog', 'failedTransactions', 'negativeWallets', 'disputedPayouts'],
  },
  'admin.wallets': {
    pageKey: 'admin.wallets',
    pageName: 'Wallets',
    description: 'Wallet and balance management',
    category: 'finance',
    metrics: ['totalWallets', 'negativeBalances', 'pendingSettlements'],
    actions: ['settleBalances', 'reviewNegative', 'adjustWallet'],
    risks: ['negativeBalances', 'settlementDelays', 'anomalies'],
  },
  'admin.refunds': {
    pageKey: 'admin.refunds',
    pageName: 'Refunds',
    description: 'Refund request management',
    category: 'finance',
    metrics: ['pendingRefunds', 'approvedToday', 'rejectedToday', 'approvalRate'],
    actions: ['processPending', 'reviewPatterns', 'detectAbuse'],
    risks: ['refundAbuse', 'highApprovalRate', 'backlog'],
  },
  'admin.fraud': {
    pageKey: 'admin.fraud',
    pageName: 'Fraud Detection',
    description: 'Fraud alerts and pattern detection',
    category: 'security',
    metrics: ['totalAlerts', 'criticalAlerts', 'highAlerts', 'estimatedLoss'],
    actions: ['reviewAlerts', 'blockAccount', 'investigatePattern'],
    risks: ['criticalFraud', 'coordinatedRings', 'ghostTrips', 'couponAbuse'],
  },
  'admin.fraud-detection': {
    pageKey: 'admin.fraud-detection',
    pageName: 'Fraud Center',
    description: 'Comprehensive fraud detection and prevention',
    category: 'security',
    metrics: ['totalAlerts', 'criticalAlerts', 'highAlerts', 'estimatedLoss'],
    actions: ['reviewAlerts', 'blockAccount', 'investigatePattern'],
    risks: ['criticalFraud', 'coordinatedRings', 'ghostTrips', 'couponAbuse'],
  },
  'admin.safety': {
    pageKey: 'admin.safety',
    pageName: 'Safety',
    description: 'Safety incidents and violations',
    category: 'security',
    metrics: ['totalIncidents', 'openCases', 'resolvedToday', 'sosAlerts'],
    actions: ['reviewIncidents', 'contactEmergency', 'suspendDriver'],
    risks: ['openSosAlerts', 'unresolvedIncidents', 'repeatOffenders'],
  },
  'admin.kyc': {
    pageKey: 'admin.kyc',
    pageName: 'KYC Verification',
    description: 'Know Your Customer verification management',
    category: 'compliance',
    metrics: ['pendingDriverKyc', 'pendingRestaurantKyc', 'rejectedKyc', 'riskyApplicants'],
    actions: ['bulkReview', 'prioritizeRisky', 'generateReport'],
    risks: ['kycBacklog', 'documentFraud', 'expiringDocuments'],
  },
  'admin.people': {
    pageKey: 'admin.people',
    pageName: 'People Management',
    description: 'User and partner verification',
    category: 'compliance',
    metrics: ['pendingVerifications', 'activeUsers', 'blockedUsers'],
    actions: ['reviewVerifications', 'manageBlocked'],
    risks: ['verificationBacklog', 'identityFraud'],
  },
  'admin.ratings': {
    pageKey: 'admin.ratings',
    pageName: 'Ratings & Reviews',
    description: 'Rating and review management',
    category: 'support',
    metrics: ['recentRatings', 'lowRatings', 'suspiciousReviews'],
    actions: ['reviewLowRatings', 'detectFakeReviews', 'respondToReviews'],
    risks: ['fakeReviews', 'ratingManipulation', 'negativePatterns'],
  },
  'admin.complaints': {
    pageKey: 'admin.complaints',
    pageName: 'Complaints',
    description: 'Customer complaint resolution',
    category: 'support',
    metrics: ['openComplaints', 'resolvedToday', 'avgResolutionTime', 'slaBreaches'],
    actions: ['prioritizeCritical', 'assignAgent', 'escalate'],
    risks: ['slaBreaches', 'repeatComplaints', 'escalations'],
  },
  'admin.analytics': {
    pageKey: 'admin.analytics',
    pageName: 'Analytics',
    description: 'Platform analytics and insights',
    category: 'dashboard',
    metrics: ['dailyActiveUsers', 'weeklyGrowth', 'revenueToday'],
    actions: ['generateReport', 'exportData', 'viewTrends'],
    risks: ['decliningMetrics', 'anomalies'],
  },
  'admin.settings': {
    pageKey: 'admin.settings',
    pageName: 'Settings',
    description: 'Platform configuration and settings',
    category: 'operations',
    metrics: ['configuredFeatures', 'pendingChanges'],
    actions: ['saveChanges', 'revertChanges'],
    risks: ['unsavedChanges', 'configurationErrors'],
  },
  'admin.parcels': {
    pageKey: 'admin.parcels',
    pageName: 'Parcels',
    description: 'Parcel delivery management',
    category: 'operations',
    metrics: ['activeParcels', 'deliveredToday', 'pendingPickup'],
    actions: ['trackParcels', 'resolveIssues'],
    risks: ['delayedDeliveries', 'lostParcels'],
  },
  'admin.observability': {
    pageKey: 'admin.observability',
    pageName: 'Observability',
    description: 'System health and monitoring',
    category: 'operations',
    metrics: ['systemHealth', 'errorRate', 'latency', 'uptime'],
    actions: ['viewLogs', 'checkServices', 'restartService'],
    risks: ['serviceDown', 'highErrorRate', 'performanceDegradation'],
  },
};

export function getContextDefinition(pageKey: string): SafePilotContextDefinition {
  return CONTEXT_REGISTRY[pageKey] || FALLBACK_CONTEXT;
}

export function getPageKeyFromPath(pathname: string): string {
  const path = pathname.replace(/^\/+/, '');
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0 || segments[0] !== 'admin') {
    return 'admin.dashboard';
  }
  
  if (segments.length === 1) {
    return 'admin.dashboard';
  }
  
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const isNumericId = (s: string) => /^\d+$/.test(s);
  
  const filteredSegments = segments.filter(s => !isUuid(s) && !isNumericId(s));
  
  if (filteredSegments.length > 1) {
    const primaryRoute = filteredSegments[1];
    const pageKey = `admin.${primaryRoute}`;
    
    if (CONTEXT_REGISTRY[pageKey]) {
      return pageKey;
    }
    
    return pageKey;
  }
  
  return 'admin.dashboard';
}

export function getAllRegisteredRoutes(): string[] {
  return Object.keys(CONTEXT_REGISTRY);
}
