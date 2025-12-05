import { prisma } from '../db';

// Types for SafePilot responses
interface SafePilotInsight {
  type: 'risk' | 'performance' | 'cost' | 'safety' | 'compliance' | 'fraud';
  title: string;
  detail: string;
  metrics?: Record<string, number | string>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SafePilotSuggestion {
  key: string;
  label: string;
  actionType: 'NAVIGATE' | 'FILTER' | 'OPEN_PANEL' | 'RUN_REPORT' | 'BULK_ACTION' | 'SUGGEST_POLICY';
  payload: Record<string, any>;
  permission?: string;
}

interface SafePilotContextResponse {
  pageKey: string;
  summary: {
    title: string;
    description: string;
  };
  metrics: Record<string, number | string>;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  quickActions: SafePilotSuggestion[];
}

interface SafePilotQueryResponse {
  answerText: string;
  insights: SafePilotInsight[];
  suggestions: SafePilotSuggestion[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Risk thresholds
const RISK_THRESHOLDS = {
  driver: {
    lowRating: 3.0,
    complaintThreshold: 5,
    complaintDays: 30,
    cancellationRate: 0.2,
  },
  customer: {
    refundThreshold: 3,
    refundDays: 30,
    cancellationRate: 0.3,
    noShowThreshold: 3,
  },
  restaurant: {
    lowRating: 3.5,
    lateOrderRate: 0.15,
    cancellationRate: 0.1,
  },
};

export const safePilotService = {
  /**
   * Get page-aware context and summary
   */
  async getContext(
    pageKey: string,
    countryCode?: string,
    entityContext?: {
      driverId?: string;
      customerId?: string;
      restaurantId?: string;
      rideId?: string;
      orderId?: string;
    }
  ): Promise<SafePilotContextResponse> {
    const startTime = Date.now();
    
    // Get context based on page
    switch (pageKey) {
      case 'admin.drivers.list':
      case 'admin.drivers':
        return this.getDriversContext(countryCode);
      
      case 'admin.customers.list':
      case 'admin.customers':
        return this.getCustomersContext(countryCode);
      
      case 'admin.restaurants.list':
      case 'admin.restaurants':
        return this.getRestaurantsContext(countryCode);
      
      case 'admin.rides.list':
      case 'admin.rides':
        return this.getRidesContext(countryCode);
      
      case 'admin.orders.list':
      case 'admin.food-orders':
        return this.getFoodOrdersContext(countryCode);
      
      case 'admin.payouts':
      case 'admin.payouts.list':
      case 'admin.wallets':
        return this.getPayoutsContext(countryCode);
      
      case 'admin.safety':
      case 'admin.safety.violations':
        return this.getSafetyContext(countryCode);
      
      case 'admin.ratings':
      case 'admin.reviews':
        return this.getRatingsContext(countryCode);
      
      case 'admin.refunds':
      case 'admin.disputes':
        return this.getRefundsContext(countryCode);
      
      case 'admin.kyc':
      case 'admin.people':
        return this.getKycContext(countryCode);
      
      case 'admin.fraud':
      case 'admin.fraud-detection':
        return this.getFraudContext(countryCode);
      
      case 'admin.safepilot':
      case 'admin.safepilot-intelligence':
        return this.getSafePilotContext(countryCode);
      
      case 'admin.analytics':
      case 'admin.observability':
        return this.getAnalyticsContext(countryCode);
      
      case 'admin.complaints':
        return this.getComplaintsContext(countryCode);
      
      case 'admin.dashboard':
      default:
        return this.getDashboardContext(countryCode);
    }
  },

  /**
   * Detect SafePilot operating mode from query
   * Vision 2030: ASK, WATCH, GUARD, OPTIMIZE
   */
  detectMode(question: string): 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' {
    const q = question.toLowerCase();
    
    // WATCH mode: monitoring, alerts, risks, warnings
    if (q.includes('monitor') || q.includes('alert') || q.includes('top 3 risk') || 
        q.includes('warning') || q.includes('what should i know') || q.includes('right now')) {
      return 'WATCH';
    }
    
    // GUARD mode: fraud, security, abuse, compliance
    if (q.includes('fraud') || q.includes('suspicious') || q.includes('abuse') ||
        q.includes('security') || q.includes('compliance') || q.includes('block') ||
        q.includes('ban') || q.includes('suspicious')) {
      return 'GUARD';
    }
    
    // OPTIMIZE mode: revenue, cost, save, improve, performance
    if (q.includes('optimiz') || q.includes('revenue') || q.includes('cost') ||
        q.includes('save') || q.includes('improve') || q.includes('increase') ||
        q.includes('reduce') || q.includes('efficiency')) {
      return 'OPTIMIZE';
    }
    
    // Default: ASK mode for questions
    return 'ASK';
  },

  /**
   * Format response in Vision 2030 structured format
   */
  formatVision2030Response(
    summary: string[],
    keySignals: string[],
    actions: Array<{ label: string; risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK'; permission?: string }>,
    monitoring: string[],
    mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE'
  ): string {
    let response = '';
    
    // Mode indicator
    response += `**[${mode} MODE]**\n\n`;
    
    // Summary section
    response += '**Summary:**\n';
    summary.forEach(s => response += `• ${s}\n`);
    response += '\n';
    
    // Key signals section
    if (keySignals.length > 0) {
      response += '**Key signals I used:**\n';
      keySignals.forEach(s => response += `• ${s}\n`);
      response += '\n';
    }
    
    // Recommended actions section
    if (actions.length > 0) {
      response += '**Recommended actions:**\n';
      actions.forEach(a => {
        const riskTag = a.risk === 'SAFE' ? '[SAFE]' : 
                       a.risk === 'CAUTION' ? '[CAUTION]' : 
                       '[HIGH RISK – REQUIRE SENIOR APPROVAL]';
        response += `• ${riskTag} ${a.label}\n`;
      });
      response += '\n';
    }
    
    // Monitoring section
    if (monitoring.length > 0) {
      response += '**What to monitor next:**\n';
      monitoring.forEach(m => response += `• ${m}\n`);
    }
    
    return response;
  },

  /**
   * Process natural language query from admin
   * Vision 2030: Enhanced with mode detection and structured responses
   */
  async processQuery(
    adminId: string,
    pageKey: string,
    question: string,
    countryCode?: string,
    entityContext?: Record<string, string>
  ): Promise<SafePilotQueryResponse> {
    const startTime = Date.now();
    const lowercaseQuestion = question.toLowerCase();
    const mode = this.detectMode(question);
    
    let response: SafePilotQueryResponse = {
      answerText: '',
      insights: [],
      suggestions: [],
      riskLevel: 'LOW',
    };

    // Pattern matching for common queries with Vision 2030 enhancements
    if (lowercaseQuestion.includes('high risk') || lowercaseQuestion.includes('risky')) {
      response = await this.handleRiskQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('fraud') || lowercaseQuestion.includes('suspicious')) {
      response = await this.handleFraudQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('refund') || lowercaseQuestion.includes('dispute')) {
      response = await this.handleRefundQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('payout') || lowercaseQuestion.includes('payment')) {
      response = await this.handlePayoutQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('driver')) {
      response = await this.handleDriverQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('customer')) {
      response = await this.handleCustomerQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('restaurant') || lowercaseQuestion.includes('partner')) {
      response = await this.handleRestaurantQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('kyc') || lowercaseQuestion.includes('verification')) {
      response = await this.handleKycQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('performance') || lowercaseQuestion.includes('metric')) {
      response = await this.handlePerformanceQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('cost') || lowercaseQuestion.includes('expense') || lowercaseQuestion.includes('save')) {
      response = await this.handleCostQuery(lowercaseQuestion, countryCode, mode);
    } else if (lowercaseQuestion.includes('top 3') || lowercaseQuestion.includes('top risks') || lowercaseQuestion.includes('right now')) {
      response = await this.handleWatchModeQuery(lowercaseQuestion, countryCode);
    } else {
      // General query handling
      response = await this.handleGeneralQuery(lowercaseQuestion, pageKey, countryCode, mode);
    }

    // Log interaction
    await this.logInteraction(adminId, pageKey, question, response, countryCode, Date.now() - startTime);

    return response;
  },

  /**
   * Handle WATCH mode: Top risks and monitoring
   */
  async handleWatchModeQuery(question: string, countryCode?: string): Promise<SafePilotQueryResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [
      pendingFraudAlerts,
      unresolvedSOS,
      failedPayouts,
      negativeBalances,
      lowRatingDrivers,
      pendingKyc,
    ] = await Promise.all([
      prisma.fraudAlert.count({ where: { status: 'PENDING' } }),
      prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }),
      prisma.payout.count({ where: { status: 'failed' } }),
      prisma.driverWallet.count({ where: { balance: { lt: 0 } } }),
      prisma.driverProfile.count({ where: { ...where, rating: { lt: 3.0 } } }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
    ]);

    // Build top risks
    const risks: Array<{ name: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; area: string; action: string }> = [];
    
    if (unresolvedSOS > 0) {
      risks.push({
        name: `${unresolvedSOS} Unresolved SOS Alerts`,
        severity: 'CRITICAL',
        area: 'Safety',
        action: 'Review and resolve immediately',
      });
    }
    
    if (pendingFraudAlerts > 0) {
      risks.push({
        name: `${pendingFraudAlerts} Pending Fraud Alerts`,
        severity: pendingFraudAlerts > 10 ? 'CRITICAL' : 'HIGH',
        area: 'Security',
        action: 'Investigate suspicious patterns',
      });
    }
    
    if (failedPayouts > 0) {
      risks.push({
        name: `${failedPayouts} Failed Payouts`,
        severity: failedPayouts > 10 ? 'HIGH' : 'MEDIUM',
        area: 'Finance',
        action: 'Review payment gateway issues',
      });
    }
    
    if (negativeBalances > 10) {
      risks.push({
        name: `${negativeBalances} Negative Balance Accounts`,
        severity: 'MEDIUM',
        area: 'Finance',
        action: 'Schedule balance recovery',
      });
    }
    
    if (lowRatingDrivers > 5) {
      risks.push({
        name: `${lowRatingDrivers} Low-Rating Drivers`,
        severity: 'MEDIUM',
        area: 'Quality',
        action: 'Review for training or suspension',
      });
    }

    // Sort by severity
    const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    const top3 = risks.slice(0, 3);
    
    const summary = top3.length > 0 
      ? top3.map(r => `**${r.severity}**: ${r.name} (${r.area})`)
      : ['No critical risks detected. Platform operating normally.'];

    const answerText = this.formatVision2030Response(
      summary,
      ['Real-time fraud alerts', 'SOS monitoring', 'Payment gateway status', 'Driver ratings'],
      top3.map(r => ({
        label: r.action,
        risk: r.severity === 'CRITICAL' ? 'HIGH_RISK' : r.severity === 'HIGH' ? 'CAUTION' : 'SAFE',
      })),
      ['SOS alert response times', 'Fraud pattern evolution', 'Payment success rates'],
      'WATCH'
    );

    return {
      answerText,
      insights: top3.map(r => ({
        type: 'risk' as const,
        title: r.name,
        detail: r.action,
        metrics: { area: r.area },
        severity: r.severity,
      })),
      suggestions: [
        {
          key: 'view_safety',
          label: 'Open Safety Center',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/safety' },
        },
        {
          key: 'view_fraud',
          label: 'View Fraud Alerts',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/fraud-detection' },
        },
      ],
      riskLevel: top3[0]?.severity || 'LOW',
    };
  },

  /**
   * Get suggested actions for a specific entity
   */
  async getSuggestedActions(
    entityType: string,
    entityId: string,
    countryCode?: string
  ): Promise<SafePilotSuggestion[]> {
    const suggestions: SafePilotSuggestion[] = [];

    switch (entityType) {
      case 'driver':
        suggestions.push(...await this.getDriverActions(entityId, countryCode));
        break;
      case 'customer':
        suggestions.push(...await this.getCustomerActions(entityId, countryCode));
        break;
      case 'restaurant':
        suggestions.push(...await this.getRestaurantActions(entityId, countryCode));
        break;
      case 'ride':
        suggestions.push(...await this.getRideActions(entityId));
        break;
      case 'order':
        suggestions.push(...await this.getOrderActions(entityId));
        break;
      case 'payout':
        suggestions.push(...await this.getPayoutActions(entityId));
        break;
    }

    return suggestions;
  },

  // ============================================
  // Context Handlers for Different Pages
  // ============================================

  async getDashboardContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [
      totalDrivers,
      activeDrivers,
      pendingKyc,
      totalCustomers,
      todayRides,
      todayOrders,
    ] = await Promise.all([
      prisma.driverProfile.count({ where }),
      prisma.driverProfile.count({ where: { ...where, isOnline: true } }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.customerProfile.count({ where: countryCode ? { user: { countryCode } } : {} }),
      prisma.ride.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
      }),
      prisma.foodOrder.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...(countryCode ? { customer: { user: { countryCode } } } : {}),
        },
      }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (pendingKyc > 10) {
      alerts.push({
        type: 'kyc',
        message: `${pendingKyc} drivers pending KYC verification`,
        severity: pendingKyc > 50 ? 'HIGH' : 'MEDIUM',
      });
    }

    if (activeDrivers < totalDrivers * 0.1) {
      alerts.push({
        type: 'driver_availability',
        message: 'Low driver availability - less than 10% online',
        severity: 'HIGH',
      });
    }

    return {
      pageKey: 'admin.dashboard',
      summary: {
        title: 'Platform Overview',
        description: `Managing ${totalDrivers} drivers and ${totalCustomers} customers${countryCode ? ` in ${countryCode}` : ''}`,
      },
      metrics: {
        totalDrivers,
        activeDrivers,
        pendingKyc,
        totalCustomers,
        todayRides,
        todayOrders,
        driverOnlineRate: totalDrivers > 0 ? ((activeDrivers / totalDrivers) * 100).toFixed(1) + '%' : '0%',
      },
      alerts,
      quickActions: [
        {
          key: 'view_pending_kyc',
          label: 'Review Pending KYC',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/kyc?status=pending' },
        },
        {
          key: 'view_high_risk',
          label: 'View High-Risk Entities',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/risk-center' },
        },
        {
          key: 'daily_report',
          label: 'Generate Daily Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'daily_summary' },
        },
      ],
    };
  },

  async getDriversContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [
      totalDrivers,
      pendingKyc,
      rejectedKyc,
      blockedDrivers,
      lowRatingDrivers,
    ] = await Promise.all([
      prisma.driverProfile.count({ where }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'rejected' } }),
      prisma.driverProfile.count({ where: { ...where, user: { ...where.user, isBlocked: true } } }),
      prisma.driverProfile.count({ where: { ...where, rating: { lt: RISK_THRESHOLDS.driver.lowRating } } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (lowRatingDrivers > 0) {
      alerts.push({
        type: 'driver_quality',
        message: `${lowRatingDrivers} drivers with rating below ${RISK_THRESHOLDS.driver.lowRating}`,
        severity: lowRatingDrivers > 10 ? 'HIGH' : 'MEDIUM',
      });
    }

    if (pendingKyc > 0) {
      alerts.push({
        type: 'kyc_backlog',
        message: `${pendingKyc} drivers awaiting KYC review`,
        severity: pendingKyc > 20 ? 'HIGH' : 'LOW',
      });
    }

    return {
      pageKey: 'admin.drivers',
      summary: {
        title: 'Driver Management',
        description: `${totalDrivers} total drivers${countryCode ? ` in ${countryCode}` : ''}`,
      },
      metrics: {
        totalDrivers,
        pendingKyc,
        rejectedKyc,
        blockedDrivers,
        lowRatingDrivers,
      },
      alerts,
      quickActions: [
        {
          key: 'review_low_rating',
          label: 'Review Low-Rating Drivers',
          actionType: 'FILTER',
          payload: { filter: 'rating_below_3' },
        },
        {
          key: 'bulk_kyc_review',
          label: 'Bulk KYC Review',
          actionType: 'OPEN_PANEL',
          payload: { panel: 'bulk_kyc' },
        },
        {
          key: 'driver_performance_report',
          label: 'Driver Performance Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'driver_performance' },
        },
      ],
    };
  },

  async getCustomersContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [totalCustomers, blockedCustomers] = await Promise.all([
      prisma.customerProfile.count({ where }),
      prisma.customerProfile.count({ where: { ...where, user: { ...where.user, isBlocked: true } } }),
    ]);

    return {
      pageKey: 'admin.customers',
      summary: {
        title: 'Customer Management',
        description: `${totalCustomers} total customers${countryCode ? ` in ${countryCode}` : ''}`,
      },
      metrics: {
        totalCustomers,
        blockedCustomers,
      },
      alerts: [],
      quickActions: [
        {
          key: 'view_frequent_refunders',
          label: 'View Frequent Refunders',
          actionType: 'FILTER',
          payload: { filter: 'high_refund_rate' },
        },
        {
          key: 'customer_analysis',
          label: 'Customer Behavior Analysis',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'customer_behavior' },
        },
      ],
    };
  },

  async getRestaurantsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [
      totalRestaurants,
      pendingKyc,
      lowRatingRestaurants,
    ] = await Promise.all([
      prisma.restaurantProfile.count({ where }),
      prisma.restaurantProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.restaurantProfile.count({ where: { ...where, rating: { lt: RISK_THRESHOLDS.restaurant.lowRating } } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (lowRatingRestaurants > 0) {
      alerts.push({
        type: 'restaurant_quality',
        message: `${lowRatingRestaurants} restaurants with low ratings`,
        severity: lowRatingRestaurants > 5 ? 'MEDIUM' : 'LOW',
      });
    }

    return {
      pageKey: 'admin.restaurants',
      summary: {
        title: 'Restaurant Management',
        description: `${totalRestaurants} total restaurants${countryCode ? ` in ${countryCode}` : ''}`,
      },
      metrics: {
        totalRestaurants,
        pendingKyc,
        lowRatingRestaurants,
      },
      alerts,
      quickActions: [
        {
          key: 'review_low_rating',
          label: 'Review Low-Rating Restaurants',
          actionType: 'FILTER',
          payload: { filter: 'low_rating' },
        },
        {
          key: 'partner_compliance',
          label: 'Check Partner Compliance',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/partner-compliance' },
        },
      ],
    };
  },

  async getRidesContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      totalRides,
      completedRides,
      cancelledRides,
      inProgressRides,
    ] = await Promise.all([
      prisma.ride.count({ where: { createdAt: { gte: last24h } } }),
      prisma.ride.count({ where: { createdAt: { gte: last24h }, status: 'completed' } }),
      prisma.ride.count({ where: { createdAt: { gte: last24h }, status: { contains: 'cancelled' } } }),
      prisma.ride.count({ where: { status: 'in_progress' } }),
    ]);

    const cancellationRate = totalRides > 0 ? (cancelledRides / totalRides) : 0;

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (cancellationRate > 0.15) {
      alerts.push({
        type: 'high_cancellation',
        message: `High cancellation rate: ${(cancellationRate * 100).toFixed(1)}% in last 24h`,
        severity: cancellationRate > 0.25 ? 'HIGH' : 'MEDIUM',
      });
    }

    return {
      pageKey: 'admin.rides',
      summary: {
        title: 'Ride Operations',
        description: `${totalRides} rides in last 24 hours`,
      },
      metrics: {
        totalRides,
        completedRides,
        cancelledRides,
        inProgressRides,
        cancellationRate: (cancellationRate * 100).toFixed(1) + '%',
      },
      alerts,
      quickActions: [
        {
          key: 'view_in_progress',
          label: 'View In-Progress Rides',
          actionType: 'FILTER',
          payload: { filter: 'in_progress' },
        },
        {
          key: 'cancellation_analysis',
          label: 'Analyze Cancellations',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'cancellation_analysis' },
        },
      ],
    };
  },

  async getFoodOrdersContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      preparingOrders,
    ] = await Promise.all([
      prisma.foodOrder.count({ where: { createdAt: { gte: last24h } } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: last24h }, status: 'delivered' } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: last24h }, status: { contains: 'cancelled' } } }),
      prisma.foodOrder.count({ where: { status: { in: ['placed', 'accepted', 'preparing'] } } }),
    ]);

    return {
      pageKey: 'admin.food-orders',
      summary: {
        title: 'Food Delivery Operations',
        description: `${totalOrders} orders in last 24 hours`,
      },
      metrics: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        preparingOrders,
      },
      alerts: [],
      quickActions: [
        {
          key: 'view_pending',
          label: 'View Pending Orders',
          actionType: 'FILTER',
          payload: { filter: 'pending' },
        },
        {
          key: 'order_analysis',
          label: 'Order Performance Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'order_performance' },
        },
      ],
    };
  },

  async getPayoutsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      pendingPayouts,
      failedPayouts,
      negativeBalanceDrivers,
    ] = await Promise.all([
      prisma.payout.count({ where: { status: 'pending' } }),
      prisma.payout.count({ where: { status: 'failed' } }),
      prisma.driverWallet.count({ where: { balance: { lt: 0 } } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (failedPayouts > 0) {
      alerts.push({
        type: 'failed_payouts',
        message: `${failedPayouts} failed payouts require attention`,
        severity: failedPayouts > 10 ? 'HIGH' : 'MEDIUM',
      });
    }

    if (negativeBalanceDrivers > 0) {
      alerts.push({
        type: 'negative_balance',
        message: `${negativeBalanceDrivers} drivers have negative wallet balance`,
        severity: 'MEDIUM',
      });
    }

    return {
      pageKey: 'admin.payouts',
      summary: {
        title: 'Payout Management',
        description: `${pendingPayouts} pending payouts`,
      },
      metrics: {
        pendingPayouts,
        failedPayouts,
        negativeBalanceDrivers,
      },
      alerts,
      quickActions: [
        {
          key: 'process_pending',
          label: 'Process Pending Payouts',
          actionType: 'BULK_ACTION',
          payload: { action: 'process_payouts' },
          permission: 'PROCESS_PAYOUTS',
        },
        {
          key: 'review_failed',
          label: 'Review Failed Payouts',
          actionType: 'FILTER',
          payload: { filter: 'failed' },
        },
        {
          key: 'negative_balance_report',
          label: 'Negative Balance Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'negative_balances' },
        },
      ],
    };
  },

  async getSafetyContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [
      recentSosAlerts,
      unresolvedIncidents,
    ] = await Promise.all([
      prisma.sOSAlert.count({ where: { triggeredAt: { gte: last7d } } }),
      prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (unresolvedIncidents > 0) {
      alerts.push({
        type: 'unresolved_safety',
        message: `${unresolvedIncidents} unresolved safety incidents`,
        severity: unresolvedIncidents > 5 ? 'CRITICAL' : 'HIGH',
      });
    }

    return {
      pageKey: 'admin.safety',
      summary: {
        title: 'Safety Center',
        description: `${recentSosAlerts} SOS alerts in last 7 days`,
      },
      metrics: {
        recentSosAlerts,
        unresolvedIncidents,
      },
      alerts,
      quickActions: [
        {
          key: 'view_active_sos',
          label: 'View Active SOS Alerts',
          actionType: 'FILTER',
          payload: { filter: 'active_sos' },
        },
        {
          key: 'safety_report',
          label: 'Weekly Safety Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'safety_weekly' },
        },
      ],
    };
  },

  async getRatingsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      recentRatings,
      lowRatings,
    ] = await Promise.all([
      prisma.rideRating.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.rideRating.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          rating: { lte: 2 },
        },
      }),
    ]);

    return {
      pageKey: 'admin.ratings',
      summary: {
        title: 'Ratings & Reviews',
        description: `${recentRatings} ratings in last 24 hours`,
      },
      metrics: {
        recentRatings,
        lowRatings,
      },
      alerts: [],
      quickActions: [
        {
          key: 'review_low_ratings',
          label: 'Review Low Ratings',
          actionType: 'FILTER',
          payload: { filter: 'low_ratings' },
        },
        {
          key: 'detect_fake_reviews',
          label: 'Detect Suspicious Reviews',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'fake_review_detection' },
        },
      ],
    };
  },

  async getRefundsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      pendingRefunds,
      totalRefunds,
    ] = await Promise.all([
      prisma.refundRequest.count({ where: { status: 'pending' } }),
      prisma.refundRequest.count({ where: { createdAt: { gte: last30d } } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (pendingRefunds > 20) {
      alerts.push({
        type: 'refund_backlog',
        message: `${pendingRefunds} pending refunds need attention`,
        severity: pendingRefunds > 50 ? 'HIGH' : 'MEDIUM',
      });
    }

    return {
      pageKey: 'admin.refunds',
      summary: {
        title: 'Refund Center',
        description: `${totalRefunds} refund requests in last 30 days`,
      },
      metrics: {
        pendingRefunds,
        totalRefunds,
      },
      alerts,
      quickActions: [
        {
          key: 'process_pending',
          label: 'Process Pending Refunds',
          actionType: 'BULK_ACTION',
          payload: { action: 'process_refunds' },
          permission: 'PROCESS_REFUNDS',
        },
        {
          key: 'refund_analysis',
          label: 'Refund Pattern Analysis',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'refund_patterns' },
        },
      ],
    };
  },

  async getKycContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [
      pendingDriverKyc,
      pendingRestaurantKyc,
      rejectedKyc,
    ] = await Promise.all([
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.restaurantProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'rejected' } }),
    ]);

    const totalPending = pendingDriverKyc + pendingRestaurantKyc;

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (totalPending > 30) {
      alerts.push({
        type: 'kyc_backlog',
        message: `${totalPending} pending KYC reviews - backlog building`,
        severity: totalPending > 100 ? 'HIGH' : 'MEDIUM',
      });
    }

    return {
      pageKey: 'admin.kyc',
      summary: {
        title: 'KYC & Verification Center',
        description: `${totalPending} total pending verifications`,
      },
      metrics: {
        pendingDriverKyc,
        pendingRestaurantKyc,
        rejectedKyc,
        totalPending,
      },
      alerts,
      quickActions: [
        {
          key: 'bulk_review',
          label: 'Bulk KYC Review',
          actionType: 'OPEN_PANEL',
          payload: { panel: 'bulk_kyc_review' },
        },
        {
          key: 'kyc_report',
          label: 'KYC Processing Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'kyc_processing' },
        },
      ],
    };
  },

  async getFraudContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      totalAlerts,
      criticalAlerts,
      highAlerts,
      pendingAlerts,
    ] = await Promise.all([
      prisma.fraudAlert.count(),
      prisma.fraudAlert.count({ where: { severity: 'CRITICAL', status: 'PENDING' } }),
      prisma.fraudAlert.count({ where: { severity: 'HIGH', status: 'PENDING' } }),
      prisma.fraudAlert.count({ where: { status: 'PENDING' } }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (criticalAlerts > 0) {
      alerts.push({
        type: 'critical_fraud',
        message: `${criticalAlerts} CRITICAL fraud alerts require immediate attention`,
        severity: 'CRITICAL',
      });
    }

    if (highAlerts > 0) {
      alerts.push({
        type: 'high_fraud',
        message: `${highAlerts} HIGH severity fraud patterns detected`,
        severity: 'HIGH',
      });
    }

    return {
      pageKey: 'admin.fraud',
      summary: {
        title: 'Fraud Detection Center',
        description: `${pendingAlerts} pending fraud alerts for review`,
      },
      metrics: {
        totalAlerts,
        criticalAlerts,
        highAlerts,
        pendingAlerts,
        estimatedLoss: '$0',
      },
      alerts,
      quickActions: [
        {
          key: 'review_critical',
          label: 'Review Critical Alerts',
          actionType: 'FILTER',
          payload: { filter: 'critical' },
        },
        {
          key: 'detect_patterns',
          label: 'Detect Fraud Patterns',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'fraud_patterns' },
        },
        {
          key: 'block_suspicious',
          label: 'Block Suspicious Accounts',
          actionType: 'BULK_ACTION',
          payload: { action: 'block_suspicious' },
          permission: 'BLOCK_ACCOUNTS',
        },
      ],
    };
  },

  async getSafePilotContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      totalQueries,
      todayQueries,
    ] = await Promise.all([
      prisma.safePilotInteraction.count(),
      prisma.safePilotInteraction.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return {
      pageKey: 'admin.safepilot',
      summary: {
        title: 'SafePilot Intelligence',
        description: 'AI-powered business automation and analytics',
      },
      metrics: {
        totalQueries,
        todayQueries,
        activeModules: 8,
        aiHealth: 'Operational',
      },
      alerts: [],
      quickActions: [
        {
          key: 'view_growth',
          label: 'Growth Engine',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/safepilot-intelligence?tab=growth' },
        },
        {
          key: 'view_cost',
          label: 'Cost Reduction',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/safepilot-intelligence?tab=operations' },
        },
        {
          key: 'view_fraud',
          label: 'Fraud Shield',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/safepilot-intelligence?tab=security' },
        },
      ],
    };
  },

  async getAnalyticsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      todayRides,
      todayOrders,
      activeDrivers,
    ] = await Promise.all([
      prisma.ride.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.foodOrder.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.driverProfile.count({ where: { isOnline: true } }),
    ]);

    return {
      pageKey: 'admin.analytics',
      summary: {
        title: 'Platform Analytics',
        description: 'Real-time performance metrics and insights',
      },
      metrics: {
        todayRides,
        todayOrders,
        activeDrivers,
        systemHealth: 'Good',
      },
      alerts: [],
      quickActions: [
        {
          key: 'generate_report',
          label: 'Generate Daily Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'daily_analytics' },
        },
        {
          key: 'export_data',
          label: 'Export Analytics Data',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'export_analytics' },
        },
      ],
    };
  },

  async getComplaintsContext(countryCode?: string): Promise<SafePilotContextResponse> {
    const [
      openComplaints,
      criticalComplaints,
      resolvedToday,
    ] = await Promise.all([
      prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.complaint.count({ where: { status: 'OPEN', priority: 'CRITICAL' } }),
      prisma.complaint.count({
        where: {
          status: 'RESOLVED',
          resolvedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const alerts: Array<{ type: string; message: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = [];

    if (criticalComplaints > 0) {
      alerts.push({
        type: 'critical_complaints',
        message: `${criticalComplaints} critical complaints require immediate attention`,
        severity: 'CRITICAL',
      });
    }

    if (openComplaints > 50) {
      alerts.push({
        type: 'complaint_backlog',
        message: `${openComplaints} open complaints - backlog growing`,
        severity: 'HIGH',
      });
    }

    return {
      pageKey: 'admin.complaints',
      summary: {
        title: 'Complaint Resolution Center',
        description: `${openComplaints} open complaints pending resolution`,
      },
      metrics: {
        openComplaints,
        criticalComplaints,
        resolvedToday,
      },
      alerts,
      quickActions: [
        {
          key: 'prioritize_critical',
          label: 'View Critical Complaints',
          actionType: 'FILTER',
          payload: { filter: 'critical' },
        },
        {
          key: 'assign_agents',
          label: 'Auto-Assign to Agents',
          actionType: 'BULK_ACTION',
          payload: { action: 'auto_assign' },
        },
      ],
    };
  },

  // ============================================
  // Query Handlers
  // ============================================

  async handleRiskQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [highRiskDrivers, lowRatingCustomers, blockedAccounts] = await Promise.all([
      prisma.driverProfile.count({
        where: {
          ...where,
          OR: [
            { rating: { lt: RISK_THRESHOLDS.driver.lowRating } },
            { user: { isBlocked: true } },
          ],
        },
      }),
      prisma.customerProfile.count({
        where: {
          ...where,
          user: { isBlocked: true },
        },
      }),
      prisma.user.count({ where: { isBlocked: true } }),
    ]);

    const answerText = this.formatVision2030Response(
      [
        `${highRiskDrivers} high-risk drivers identified (low rating or blocked)`,
        `${lowRatingCustomers} flagged customers currently blocked`,
        `${blockedAccounts} total blocked accounts across platform`,
      ],
      [
        'Driver rating thresholds (<3.0 stars)',
        'Account block status',
        'Recent complaint patterns',
        'Cancellation rate analysis',
      ],
      [
        { label: 'Review high-risk drivers for suspension', risk: highRiskDrivers > 20 ? 'CAUTION' : 'SAFE' },
        { label: 'Audit blocked customer accounts', risk: 'SAFE' },
        { label: 'Generate comprehensive risk report', risk: 'SAFE' },
      ],
      [
        'New drivers falling below rating threshold',
        'Repeat offenders returning after unblock',
        'Geographic concentration of risk',
      ],
      mode
    );

    return {
      answerText,
      insights: [
        {
          type: 'risk',
          title: 'High-Risk Drivers',
          detail: `${highRiskDrivers} drivers meet high-risk criteria (low rating or blocked)`,
          metrics: { count: highRiskDrivers },
          severity: highRiskDrivers > 10 ? 'HIGH' : 'MEDIUM',
        },
        {
          type: 'risk',
          title: 'Flagged Customers',
          detail: `${lowRatingCustomers} customers are currently blocked`,
          metrics: { count: lowRatingCustomers },
          severity: lowRatingCustomers > 5 ? 'MEDIUM' : 'LOW',
        },
      ],
      suggestions: [
        {
          key: 'view_high_risk_drivers',
          label: 'View High-Risk Drivers',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/drivers?filter=high_risk' },
        },
        {
          key: 'risk_report',
          label: 'Generate Risk Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'risk_assessment' },
        },
      ],
      riskLevel: highRiskDrivers > 20 ? 'HIGH' : highRiskDrivers > 5 ? 'MEDIUM' : 'LOW',
    };
  },

  async handleFraudQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'GUARD'): Promise<SafePilotQueryResponse> {
    const [pendingFraudAlerts, resolvedFraudAlerts, highSeverityAlerts] = await Promise.all([
      prisma.fraudAlert.count({ where: { status: 'PENDING' } }),
      prisma.fraudAlert.count({
        where: {
          status: 'RESOLVED',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.fraudAlert.count({ where: { status: 'PENDING', severity: { in: ['HIGH', 'CRITICAL'] } } }),
    ]);

    const answerText = this.formatVision2030Response(
      [
        `${pendingFraudAlerts} pending fraud alerts requiring investigation`,
        `${highSeverityAlerts} high/critical severity alerts need immediate attention`,
        `${resolvedFraudAlerts} alerts resolved in the last 7 days`,
      ],
      [
        'Device fingerprint anomalies',
        'Payment method correlation',
        'Route and location patterns',
        'Promo usage and abuse signals',
        'Dispute and refund patterns',
      ],
      [
        { label: 'Investigate high-severity alerts immediately', risk: highSeverityAlerts > 0 ? 'HIGH_RISK' : 'CAUTION' },
        { label: 'Review suspicious account clusters', risk: 'CAUTION' },
        { label: 'Generate fraud pattern analysis', risk: 'SAFE' },
      ],
      [
        'New fraud patterns emerging',
        'Coordinated fraud ring activity',
        'Payment gateway anomalies',
        'Promo abuse spikes',
      ],
      'GUARD'
    );

    return {
      answerText,
      insights: [
        {
          type: 'fraud',
          title: 'Pending Fraud Alerts',
          detail: `${pendingFraudAlerts} alerts need investigation`,
          metrics: { pending: pendingFraudAlerts, resolved_last_week: resolvedFraudAlerts, high_severity: highSeverityAlerts },
          severity: pendingFraudAlerts > 10 ? 'CRITICAL' : pendingFraudAlerts > 5 ? 'HIGH' : 'MEDIUM',
        },
      ],
      suggestions: [
        {
          key: 'view_fraud_alerts',
          label: 'View Fraud Alerts',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/fraud-detection' },
        },
        {
          key: 'fraud_patterns',
          label: 'Analyze Fraud Patterns',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'fraud_patterns' },
        },
      ],
      riskLevel: pendingFraudAlerts > 10 ? 'CRITICAL' : pendingFraudAlerts > 5 ? 'HIGH' : 'MEDIUM',
    };
  },

  async handleRefundQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [pendingRefunds, approvedRefunds, rejectedRefunds] = await Promise.all([
      prisma.refundRequest.count({ where: { status: 'pending' } }),
      prisma.refundRequest.count({ where: { status: 'approved', createdAt: { gte: last30d } } }),
      prisma.refundRequest.count({ where: { status: 'rejected', createdAt: { gte: last30d } } }),
    ]);

    const totalProcessed = approvedRefunds + rejectedRefunds;
    const approvalRate = totalProcessed > 0 ? ((approvedRefunds / totalProcessed) * 100).toFixed(1) : 0;

    return {
      answerText: `${pendingRefunds} refunds pending. Approval rate: ${approvalRate}% over last 30 days.`,
      insights: [
        {
          type: 'cost',
          title: 'Refund Volume',
          detail: `${totalProcessed} refunds processed in last 30 days (${approvalRate}% approved)`,
          metrics: { pending: pendingRefunds, approved: approvedRefunds, rejected: rejectedRefunds },
          severity: pendingRefunds > 30 ? 'HIGH' : 'MEDIUM',
        },
      ],
      suggestions: [
        {
          key: 'process_refunds',
          label: 'Process Pending Refunds',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/refunds?status=pending' },
        },
        {
          key: 'refund_analysis',
          label: 'Refund Trend Analysis',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'refund_trends' },
        },
      ],
      riskLevel: pendingRefunds > 50 ? 'HIGH' : 'MEDIUM',
    };
  },

  async handlePayoutQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const [pendingPayouts, failedPayouts, negativeBalances] = await Promise.all([
      prisma.payout.count({ where: { status: 'pending' } }),
      prisma.payout.count({ where: { status: 'failed' } }),
      prisma.driverWallet.count({ where: { balance: { lt: 0 } } }),
    ]);

    return {
      answerText: `${pendingPayouts} payouts pending, ${failedPayouts} failed. ${negativeBalances} drivers have negative balance.`,
      insights: [
        {
          type: 'cost',
          title: 'Payout Status',
          detail: `${failedPayouts} failed payouts need attention`,
          metrics: { pending: pendingPayouts, failed: failedPayouts },
          severity: failedPayouts > 5 ? 'HIGH' : 'MEDIUM',
        },
        {
          type: 'cost',
          title: 'Negative Balances',
          detail: `${negativeBalances} drivers have negative wallet balance (commission owed)`,
          metrics: { count: negativeBalances },
          severity: negativeBalances > 20 ? 'HIGH' : 'MEDIUM',
        },
      ],
      suggestions: [
        {
          key: 'view_failed',
          label: 'Review Failed Payouts',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/payouts?status=failed' },
        },
        {
          key: 'settle_negatives',
          label: 'Settle Negative Balances',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/wallets?filter=negative' },
        },
      ],
      riskLevel: failedPayouts > 10 ? 'HIGH' : 'MEDIUM',
    };
  },

  async handleDriverQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [totalDrivers, onlineDrivers, lowRatingDrivers, pendingKyc] = await Promise.all([
      prisma.driverProfile.count({ where }),
      prisma.driverProfile.count({ where: { ...where, isOnline: true } }),
      prisma.driverProfile.count({ where: { ...where, rating: { lt: RISK_THRESHOLDS.driver.lowRating } } }),
      prisma.driverProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
    ]);

    return {
      answerText: `${totalDrivers} total drivers. ${onlineDrivers} currently online. ${lowRatingDrivers} have low ratings. ${pendingKyc} pending KYC.`,
      insights: [
        {
          type: 'performance',
          title: 'Driver Fleet Status',
          detail: `${((onlineDrivers / totalDrivers) * 100).toFixed(1)}% of drivers currently online`,
          metrics: { total: totalDrivers, online: onlineDrivers, lowRating: lowRatingDrivers },
          severity: lowRatingDrivers > 10 ? 'MEDIUM' : 'LOW',
        },
      ],
      suggestions: [
        {
          key: 'view_low_rating',
          label: 'View Low-Rating Drivers',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/drivers?filter=low_rating' },
        },
        {
          key: 'driver_report',
          label: 'Driver Performance Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'driver_performance' },
        },
      ],
      riskLevel: lowRatingDrivers > 20 ? 'HIGH' : 'LOW',
    };
  },

  async handleCustomerQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [totalCustomers, blockedCustomers] = await Promise.all([
      prisma.customerProfile.count({ where }),
      prisma.customerProfile.count({ where: { ...where, user: { ...where.user, isBlocked: true } } }),
    ]);

    return {
      answerText: `${totalCustomers} total customers. ${blockedCustomers} are currently blocked.`,
      insights: [
        {
          type: 'performance',
          title: 'Customer Base',
          detail: `${totalCustomers} registered customers`,
          metrics: { total: totalCustomers, blocked: blockedCustomers },
          severity: 'LOW',
        },
      ],
      suggestions: [
        {
          key: 'view_blocked',
          label: 'View Blocked Customers',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/customers?filter=blocked' },
        },
        {
          key: 'customer_report',
          label: 'Customer Behavior Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'customer_behavior' },
        },
      ],
      riskLevel: 'LOW',
    };
  },

  async handleRestaurantQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const where = countryCode ? { user: { countryCode } } : {};
    
    const [totalRestaurants, pendingKyc, lowRating] = await Promise.all([
      prisma.restaurantProfile.count({ where }),
      prisma.restaurantProfile.count({ where: { ...where, verificationStatus: 'pending' } }),
      prisma.restaurantProfile.count({ where: { ...where, rating: { lt: RISK_THRESHOLDS.restaurant.lowRating } } }),
    ]);

    return {
      answerText: `${totalRestaurants} restaurants. ${pendingKyc} pending verification. ${lowRating} with low ratings.`,
      insights: [
        {
          type: 'performance',
          title: 'Restaurant Partners',
          detail: `${totalRestaurants} active restaurant partners`,
          metrics: { total: totalRestaurants, pendingKyc, lowRating },
          severity: lowRating > 5 ? 'MEDIUM' : 'LOW',
        },
      ],
      suggestions: [
        {
          key: 'view_low_rating',
          label: 'Review Low-Rating Restaurants',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/restaurants?filter=low_rating' },
        },
      ],
      riskLevel: 'LOW',
    };
  },

  async handleKycQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const context = await this.getKycContext(countryCode);
    
    return {
      answerText: `${context.metrics.totalPending} total pending KYC verifications (${context.metrics.pendingDriverKyc} drivers, ${context.metrics.pendingRestaurantKyc} restaurants).`,
      insights: [
        {
          type: 'compliance',
          title: 'KYC Backlog',
          detail: `Verification queue needs attention`,
          metrics: context.metrics as Record<string, number>,
          severity: (context.metrics.totalPending as number) > 50 ? 'HIGH' : 'MEDIUM',
        },
      ],
      suggestions: context.quickActions,
      riskLevel: (context.metrics.totalPending as number) > 100 ? 'HIGH' : 'MEDIUM',
    };
  },

  async handlePerformanceQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [completedRides, completedOrders] = await Promise.all([
      prisma.ride.count({ where: { status: 'completed', completedAt: { gte: last24h } } }),
      prisma.foodOrder.count({ where: { status: 'delivered', deliveredAt: { gte: last24h } } }),
    ]);

    return {
      answerText: `Last 24 hours: ${completedRides} rides completed, ${completedOrders} orders delivered.`,
      insights: [
        {
          type: 'performance',
          title: 'Daily Performance',
          detail: `Platform served ${completedRides + completedOrders} total trips/orders`,
          metrics: { rides: completedRides, orders: completedOrders },
          severity: 'LOW',
        },
      ],
      suggestions: [
        {
          key: 'performance_dashboard',
          label: 'View Performance Dashboard',
          actionType: 'NAVIGATE',
          payload: { route: '/admin/analytics' },
        },
      ],
      riskLevel: 'LOW',
    };
  },

  async handleCostQuery(question: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'OPTIMIZE'): Promise<SafePilotQueryResponse> {
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [refundCount, negativeBalances] = await Promise.all([
      prisma.refundRequest.count({ where: { status: 'approved', createdAt: { gte: last30d } } }),
      prisma.driverWallet.count({ where: { balance: { lt: 0 } } }),
    ]);

    return {
      answerText: `Cost reduction opportunities: ${refundCount} refunds approved last 30 days. ${negativeBalances} drivers owe commission.`,
      insights: [
        {
          type: 'cost',
          title: 'Cost Analysis',
          detail: 'Review refund patterns and commission collection',
          metrics: { refunds: refundCount, negativeBalances },
          severity: refundCount > 100 ? 'HIGH' : 'MEDIUM',
        },
      ],
      suggestions: [
        {
          key: 'cost_report',
          label: 'Generate Cost Report',
          actionType: 'RUN_REPORT',
          payload: { reportType: 'cost_analysis' },
        },
        {
          key: 'refund_policy',
          label: 'Review Refund Policy',
          actionType: 'SUGGEST_POLICY',
          payload: { policyType: 'refund_reduction' },
        },
      ],
      riskLevel: 'MEDIUM',
    };
  },

  async handleGeneralQuery(question: string, pageKey: string, countryCode?: string, mode: 'ASK' | 'WATCH' | 'GUARD' | 'OPTIMIZE' = 'ASK'): Promise<SafePilotQueryResponse> {
    const context = await this.getContext(pageKey, countryCode);
    
    const answerText = this.formatVision2030Response(
      [
        context.summary.description,
        ...context.alerts.slice(0, 2).map(a => a.message),
      ],
      Object.entries(context.metrics).slice(0, 4).map(([k, v]) => `${k}: ${v}`),
      context.quickActions.slice(0, 3).map(a => ({
        label: a.label,
        risk: 'SAFE' as const,
      })),
      ['Monitor for changes in key metrics', 'Watch for new alerts'],
      mode
    );

    return {
      answerText,
      insights: context.alerts.map(alert => ({
        type: 'performance' as const,
        title: alert.message,
        detail: `Alert type: ${alert.type}`,
        severity: alert.severity,
      })),
      suggestions: context.quickActions,
      riskLevel: context.alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL' :
                 context.alerts.some(a => a.severity === 'HIGH') ? 'HIGH' :
                 context.alerts.some(a => a.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW',
    };
  },

  // ============================================
  // Entity Action Handlers
  // ============================================

  async getDriverActions(driverId: string, countryCode?: string): Promise<SafePilotSuggestion[]> {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      include: { user: true },
    });

    if (!driver) return [];

    const suggestions: SafePilotSuggestion[] = [];

    if (driver.verificationStatus === 'pending') {
      suggestions.push({
        key: 'approve_kyc',
        label: 'Approve KYC',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/kyc/driver/${driverId}`, action: 'approve' },
        permission: 'MANAGE_DRIVER_KYC',
      });
    }

    if (driver.rating && driver.rating.toNumber() < RISK_THRESHOLDS.driver.lowRating) {
      suggestions.push({
        key: 'review_performance',
        label: 'Review Performance History',
        actionType: 'OPEN_PANEL',
        payload: { panel: 'driver_performance', driverId },
      });
      suggestions.push({
        key: 'schedule_training',
        label: 'Schedule Training',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/drivers/${driverId}/training` },
      });
    }

    if (!driver.user.isBlocked) {
      suggestions.push({
        key: 'view_trips',
        label: 'View Trip History',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/drivers/${driverId}/trips` },
      });
    }

    return suggestions;
  },

  async getCustomerActions(customerId: string, countryCode?: string): Promise<SafePilotSuggestion[]> {
    return [
      {
        key: 'view_orders',
        label: 'View Order History',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/customers/${customerId}/orders` },
      },
      {
        key: 'view_refunds',
        label: 'View Refund History',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/customers/${customerId}/refunds` },
      },
    ];
  },

  async getRestaurantActions(restaurantId: string, countryCode?: string): Promise<SafePilotSuggestion[]> {
    return [
      {
        key: 'view_orders',
        label: 'View Order History',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/restaurants/${restaurantId}/orders` },
      },
      {
        key: 'view_menu',
        label: 'Review Menu',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/restaurants/${restaurantId}/menu` },
      },
    ];
  },

  async getRideActions(rideId: string): Promise<SafePilotSuggestion[]> {
    return [
      {
        key: 'view_timeline',
        label: 'View Ride Timeline',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/rides/${rideId}/timeline` },
      },
      {
        key: 'view_payment',
        label: 'View Payment Details',
        actionType: 'OPEN_PANEL',
        payload: { panel: 'ride_payment', rideId },
      },
    ];
  },

  async getOrderActions(orderId: string): Promise<SafePilotSuggestion[]> {
    return [
      {
        key: 'view_timeline',
        label: 'View Order Timeline',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/orders/${orderId}/timeline` },
      },
    ];
  },

  async getPayoutActions(payoutId: string): Promise<SafePilotSuggestion[]> {
    return [
      {
        key: 'view_details',
        label: 'View Payout Details',
        actionType: 'NAVIGATE',
        payload: { route: `/admin/payouts/${payoutId}` },
      },
    ];
  },

  // ============================================
  // Logging & Analytics
  // ============================================

  async logInteraction(
    adminId: string,
    pageKey: string,
    question: string,
    response: SafePilotQueryResponse,
    countryCode?: string,
    responseTimeMs?: number
  ): Promise<void> {
    try {
      await prisma.safePilotInteraction.create({
        data: {
          adminId,
          pageKey,
          question,
          responseSummary: response.answerText,
          suggestionsJson: response.suggestions,
          countryCode: countryCode || null,
          riskLevel: response.riskLevel,
          responseTimeMs: responseTimeMs || null,
          insightsCount: response.insights.length,
          suggestionsCount: response.suggestions.length,
        },
      });
    } catch (error) {
      console.error('[SafePilot] Failed to log interaction:', error);
    }
  },

  async recordActionSelection(interactionId: string, actionKey: string): Promise<void> {
    try {
      await prisma.safePilotInteraction.update({
        where: { id: interactionId },
        data: { selectedActionKey: actionKey },
      });
    } catch (error) {
      console.error('[SafePilot] Failed to record action selection:', error);
    }
  },

  /**
   * Check if SafePilot feature is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const config = await prisma.safePilotConfig.findUnique({
        where: { key: 'feature.safepilot.enabled' },
      });
      return config?.isEnabled ?? true;
    } catch {
      return true;
    }
  },

  /**
   * Get SafePilot analytics
   */
  async getAnalytics(adminId?: string, days: number = 30): Promise<{
    totalInteractions: number;
    byPageKey: Record<string, number>;
    byRiskLevel: Record<string, number>;
    avgResponseTime: number;
    topQuestions: Array<{ question: string; count: number }>;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = {
      timestamp: { gte: since },
      ...(adminId ? { adminId } : {}),
    };

    const [interactions, avgTime] = await Promise.all([
      prisma.safePilotInteraction.findMany({ where, select: { pageKey: true, riskLevel: true, question: true, responseTimeMs: true } }),
      prisma.safePilotInteraction.aggregate({ where, _avg: { responseTimeMs: true } }),
    ]);

    const byPageKey: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    const questionCount: Record<string, number> = {};

    for (const i of interactions) {
      byPageKey[i.pageKey] = (byPageKey[i.pageKey] || 0) + 1;
      byRiskLevel[i.riskLevel] = (byRiskLevel[i.riskLevel] || 0) + 1;
      if (i.question) {
        questionCount[i.question] = (questionCount[i.question] || 0) + 1;
      }
    }

    const topQuestions = Object.entries(questionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

    return {
      totalInteractions: interactions.length,
      byPageKey,
      byRiskLevel,
      avgResponseTime: avgTime._avg.responseTimeMs || 0,
      topQuestions,
    };
  },
};
