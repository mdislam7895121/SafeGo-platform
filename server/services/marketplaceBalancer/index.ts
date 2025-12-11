/**
 * SafeGo AI Marketplace Balancer - Main Orchestrator
 * 
 * The "brain" of SafeGo marketplace optimization:
 * - Runs 60-second control loops
 * - Collects real-time telemetry
 * - Generates demand/supply predictions
 * - Adjusts surge, commission, incentives
 * - Optimizes driver dispatch
 * - Generates heatmaps for admin dashboards
 * - Enforces safety guards
 */

import {
  MarketplaceSnapshot,
  BalancerDecisionPayload,
  MarketplaceBalancerConfig,
  MarketplaceStatus,
  MarketplaceMetricsSummary,
  MarketplaceHeatmaps,
  ForecastWindow,
  SafetyGuardViolation,
  SurgeDecision,
  CommissionDecision,
  IncentiveDecision,
  DEFAULT_BALANCER_CONFIG,
} from '@shared/marketplace';

import { marketplaceState } from './stateStore';
import { telemetryCollector } from './telemetryCollector';
import { generateForecastWindow } from './predictiveModels';
import { safetyGuards } from './safetyGuards';
import { surgeController } from './actuators/surgeController';
import { commissionController } from './actuators/commissionController';
import { incentiveController } from './actuators/incentiveController';
import { heatmapGenerator } from './heatmapGenerator';

// ========================================
// MARKETPLACE BALANCER CLASS
// ========================================

export class MarketplaceBalancer {
  private config: MarketplaceBalancerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private lastCycleStart: number = 0;

  constructor(config: MarketplaceBalancerConfig = DEFAULT_BALANCER_CONFIG) {
    this.config = config;
  }

  // ========================================
  // LIFECYCLE MANAGEMENT
  // ========================================

  start(): void {
    if (this.intervalId) {
      console.log('[MarketplaceBalancer] Already running');
      return;
    }

    console.log('[MarketplaceBalancer] Starting AI loop...');
    marketplaceState.setRunning(true);

    // Run immediately, then on interval
    this.runCycle();

    this.intervalId = setInterval(() => {
      this.runCycle();
    }, this.config.cycleDurationMs);

    console.log(`[MarketplaceBalancer] Running every ${this.config.cycleDurationMs / 1000}s`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    marketplaceState.setRunning(false);
    console.log('[MarketplaceBalancer] Stopped');
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  // ========================================
  // MAIN CONTROL LOOP
  // ========================================

  async runCycle(): Promise<BalancerDecisionPayload | null> {
    if (this.isProcessing) {
      console.log('[MarketplaceBalancer] Skipping cycle - previous still running');
      return null;
    }

    if (!this.config.enabled) {
      return null;
    }

    // Check circuit breaker
    if (marketplaceState.isCircuitBreakerOpen()) {
      console.log('[MarketplaceBalancer] Circuit breaker open - skipping cycle');
      return null;
    }

    this.isProcessing = true;
    this.lastCycleStart = Date.now();
    marketplaceState.startCycle();

    try {
      // Step 1: Collect telemetry
      const snapshot = await telemetryCollector.collectSnapshot();

      // Step 2: Generate forecasts
      const forecasts = this.generateForecasts(snapshot);

      // Step 3: Make decisions
      const decisions = await this.makeDecisions(snapshot, forecasts);

      // Step 4: Apply safety guards
      const { correctedSurge, correctedCommission, correctedIncentives, violations } = 
        safetyGuards.validateAllDecisions(
          decisions.surgeDecisions,
          decisions.commissionDecisions,
          decisions.incentiveDecisions
        );

      // Step 5: Apply decisions
      if (!this.config.manualOverrideActive) {
        this.applyDecisions(correctedSurge, correctedCommission, correctedIncentives);
      }

      // Step 6: Calculate global balance score
      const globalBalanceScore = this.calculateGlobalBalance(snapshot);

      // Step 7: Build decision payload
      const payload = this.buildPayload(
        snapshot,
        forecasts,
        correctedSurge,
        correctedCommission,
        correctedIncentives,
        violations,
        globalBalanceScore
      );

      // Step 8: Save decision
      marketplaceState.saveDecision(payload);

      const duration = Date.now() - this.lastCycleStart;
      marketplaceState.endCycle(duration);

      if (this.config.debugMode) {
        console.log(`[MarketplaceBalancer] Cycle ${payload.cycleNumber} complete in ${duration}ms`);
        console.log(`[MarketplaceBalancer] Balance score: ${globalBalanceScore.toFixed(2)}`);
      }

      return payload;

    } catch (error) {
      const duration = Date.now() - this.lastCycleStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      marketplaceState.endCycle(duration, errorMessage);
      console.error('[MarketplaceBalancer] Cycle error:', errorMessage);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  // ========================================
  // FORECAST GENERATION
  // ========================================

  private generateForecasts(snapshot: MarketplaceSnapshot): {
    '10m': ForecastWindow;
    '30m': ForecastWindow;
    '60m': ForecastWindow;
  } {
    return {
      '10m': generateForecastWindow(snapshot.zones, '10m', snapshot.weather, snapshot.activeEvents),
      '30m': generateForecastWindow(snapshot.zones, '30m', snapshot.weather, snapshot.activeEvents),
      '60m': generateForecastWindow(snapshot.zones, '60m', snapshot.weather, snapshot.activeEvents),
    };
  }

  // ========================================
  // DECISION MAKING
  // ========================================

  private async makeDecisions(
    snapshot: MarketplaceSnapshot,
    forecasts: { '10m': ForecastWindow; '30m': ForecastWindow; '60m': ForecastWindow }
  ): Promise<{
    surgeDecisions: SurgeDecision[];
    commissionDecisions: CommissionDecision[];
    incentiveDecisions: IncentiveDecision[];
  }> {
    // Use 10-minute forecast for immediate decisions
    const forecast = forecasts['10m'];
    
    // Build lookup maps
    const demandMap = new Map(forecast.demandForecasts.map(f => [f.zoneId, f]));
    const supplyMap = new Map(forecast.supplyForecasts.map(f => [f.zoneId, f]));
    const gapMap = new Map(forecast.supplyGaps.map(g => [g.zoneId, g]));

    // Generate surge decisions
    const surgeDecisions = this.config.surgeAdjustmentEnabled
      ? surgeController.calculateAllSurgeDecisions(snapshot.zones, demandMap, supplyMap, gapMap)
      : [];

    // Generate commission decisions
    const commissionDecisions = this.config.commissionAdjustmentEnabled
      ? commissionController.calculateAllCommissionDecisions(snapshot.zones, demandMap, supplyMap)
      : [];

    // Generate incentive decisions
    const incentiveDecisions = this.config.incentiveOptimizationEnabled
      ? incentiveController.calculateAllIncentiveDecisions(
          snapshot.zones, demandMap, supplyMap, gapMap, snapshot.weather
        )
      : [];

    return { surgeDecisions, commissionDecisions, incentiveDecisions };
  }

  // ========================================
  // DECISION APPLICATION
  // ========================================

  private applyDecisions(
    surgeDecisions: SurgeDecision[],
    commissionDecisions: CommissionDecision[],
    incentiveDecisions: IncentiveDecision[]
  ): void {
    surgeController.applyAllSurgeDecisions(surgeDecisions);
    commissionController.applyAllCommissionDecisions(commissionDecisions);
    incentiveController.applyAllIncentiveDecisions(incentiveDecisions);
  }

  // ========================================
  // BALANCE CALCULATION
  // ========================================

  private calculateGlobalBalance(snapshot: MarketplaceSnapshot): number {
    if (snapshot.zones.length === 0) return 1.0;

    let totalBalance = 0;
    for (const zone of snapshot.zones) {
      totalBalance += zone.balanceScore;
    }

    return Math.round((totalBalance / snapshot.zones.length) * 100) / 100;
  }

  // ========================================
  // PAYLOAD BUILDING
  // ========================================

  private buildPayload(
    snapshot: MarketplaceSnapshot,
    forecasts: { '10m': ForecastWindow; '30m': ForecastWindow; '60m': ForecastWindow },
    surgeDecisions: SurgeDecision[],
    commissionDecisions: CommissionDecision[],
    incentiveDecisions: IncentiveDecision[],
    violations: SafetyGuardViolation[],
    globalBalanceScore: number
  ): BalancerDecisionPayload {
    const actionsTaken: string[] = [];
    const nextCycleRecommendations: string[] = [];

    // Track surge changes
    const surgeChanges = surgeDecisions.filter(d => d.recommendedMultiplier !== d.currentMultiplier);
    if (surgeChanges.length > 0) {
      actionsTaken.push(`Adjusted surge in ${surgeChanges.length} zones`);
    }

    // Track commission changes
    const commissionChanges = commissionDecisions.filter(d => d.recommendedRate !== d.currentRate);
    if (commissionChanges.length > 0) {
      actionsTaken.push(`Adjusted commission in ${commissionChanges.length} zones`);
    }

    // Track incentive activations
    const activatedIncentives = incentiveDecisions.filter(d => d.activate);
    const deactivatedIncentives = incentiveDecisions.filter(d => !d.activate);
    if (activatedIncentives.length > 0) {
      actionsTaken.push(`Activated ${activatedIncentives.length} incentives`);
    }
    if (deactivatedIncentives.length > 0) {
      actionsTaken.push(`Deactivated ${deactivatedIncentives.length} incentives`);
    }

    // Track violations
    if (violations.length > 0) {
      actionsTaken.push(`Corrected ${violations.length} safety guard violations`);
    }

    // Generate recommendations
    const criticalZones = snapshot.zones.filter(z => z.status === 'critical');
    if (criticalZones.length > 0) {
      nextCycleRecommendations.push(`Monitor ${criticalZones.length} critical zones`);
    }

    if (globalBalanceScore < 0.5) {
      nextCycleRecommendations.push('Consider emergency supply boost');
    }

    return {
      timestamp: new Date(),
      cycleNumber: marketplaceState.getCycleCount(),
      snapshot,
      forecasts,
      decisions: {
        surgeDecisions,
        commissionDecisions,
        incentiveDecisions,
        dispatchHints: [],
      },
      safetyGuardViolations: violations,
      globalBalanceScore,
      actionsTaken,
      nextCycleRecommendations,
    };
  }

  // ========================================
  // PUBLIC API
  // ========================================

  getStatus(): MarketplaceStatus {
    const storeStatus = marketplaceState.getStatus();
    const zones = marketplaceState.getAllZones();
    
    return {
      isRunning: storeStatus.isRunning,
      lastCycleTime: storeStatus.lastCycleTime || new Date(),
      cycleCount: storeStatus.cycleCount,
      avgCycleDurationMs: storeStatus.avgCycleDurationMs,
      errorCount: storeStatus.errorCount,
      lastError: storeStatus.lastError || undefined,
      safetyGuardTriggeredCount: safetyGuards.getViolationCount(),
      activeZones: zones.length,
      balancedZones: zones.filter(z => z.metrics.status === 'balanced').length,
      criticalZones: zones.filter(z => z.metrics.status === 'critical').length,
    };
  }

  getMetricsSummary(): MarketplaceMetricsSummary {
    const snapshot = marketplaceState.getLatestSnapshot();
    const zones = marketplaceState.getAllZones();
    
    let totalSurge = 0;
    let totalCommission = 0;
    let activeIncentives = 0;

    for (const zone of zones) {
      totalSurge += marketplaceState.getActiveSurge(zone.zone.id);
      totalCommission += marketplaceState.getActiveCommission(zone.zone.id);
      activeIncentives += marketplaceState.getActiveIncentives(zone.zone.id).length;
    }

    const zoneCount = zones.length || 1;

    return {
      timestamp: new Date(),
      globalBalanceScore: snapshot?.globalMetrics?.globalMatchRate || 0,
      avgSurge: Math.round((totalSurge / zoneCount) * 100) / 100,
      avgCommission: Math.round((totalCommission / zoneCount) * 10) / 10,
      activeIncentives,
      totalDrivers: snapshot?.globalMetrics?.totalActiveDrivers || 0,
      totalRequests: snapshot?.globalMetrics?.totalPendingRequests || 0,
      matchRate: snapshot?.globalMetrics?.globalMatchRate || 0,
      avgWaitTime: snapshot?.globalMetrics?.avgWaitTimeSeconds || 0,
      revenueImpact: 0,
    };
  }

  getHeatmaps(): MarketplaceHeatmaps | null {
    if (!this.config.heatmapGenerationEnabled) return null;

    const snapshot = marketplaceState.getLatestSnapshot();
    const decision = marketplaceState.getLatestDecision();

    if (!snapshot || !decision) return null;

    return heatmapGenerator.generateAllHeatmaps(
      snapshot.zones,
      decision.forecasts['30m'],
      decision.forecasts['60m']
    );
  }

  getLatestDecision(): BalancerDecisionPayload | undefined {
    return marketplaceState.getLatestDecision();
  }

  getDecisionHistory(count: number): BalancerDecisionPayload[] {
    return marketplaceState.getDecisionHistory(count);
  }

  // ========================================
  // CONFIGURATION
  // ========================================

  updateConfig(config: Partial<MarketplaceBalancerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if interval changed
    if (config.cycleDurationMs && this.intervalId) {
      this.stop();
      this.start();
    }
  }

  getConfig(): MarketplaceBalancerConfig {
    return { ...this.config };
  }

  enableManualOverride(): void {
    this.config.manualOverrideActive = true;
    console.log('[MarketplaceBalancer] Manual override enabled - AI decisions will not be applied');
  }

  disableManualOverride(): void {
    this.config.manualOverrideActive = false;
    console.log('[MarketplaceBalancer] Manual override disabled - AI decisions will be applied');
  }

  setDebugMode(enabled: boolean): void {
    this.config.debugMode = enabled;
  }

  // ========================================
  // MANUAL CONTROLS
  // ========================================

  forceRebalance(): Promise<BalancerDecisionPayload | null> {
    console.log('[MarketplaceBalancer] Forcing rebalance cycle...');
    return this.runCycle();
  }

  resetState(): void {
    this.stop();
    marketplaceState.reset();
    safetyGuards.resetViolationCount();
    console.log('[MarketplaceBalancer] State reset complete');
  }
}

// Singleton instance
export const marketplaceBalancer = new MarketplaceBalancer();

// Export all components
export { marketplaceState } from './stateStore';
export { telemetryCollector } from './telemetryCollector';
export { safetyGuards } from './safetyGuards';
export { surgeController } from './actuators/surgeController';
export { commissionController } from './actuators/commissionController';
export { incentiveController } from './actuators/incentiveController';
export { heatmapGenerator } from './heatmapGenerator';
export * from './predictiveModels';

export default marketplaceBalancer;
