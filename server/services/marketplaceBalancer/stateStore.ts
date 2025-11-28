/**
 * SafeGo AI Marketplace Balancer - State Store
 * 
 * In-memory state management for marketplace balancer with:
 * - Rolling buffers for metrics history
 * - Zone state tracking
 * - Decision history
 * - Circuit breaker patterns
 */

import {
  ZoneMetrics,
  MarketplaceSnapshot,
  BalancerDecisionPayload,
  SurgeDecision,
  CommissionDecision,
  IncentiveDecision,
  TelemetryEvent,
  SafetyGuardViolation,
  DemandMetrics,
  SupplyMetrics,
  GeoZone,
} from '@shared/marketplace';

// ========================================
// RING BUFFER FOR ROLLING WINDOWS
// ========================================

class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  getAll(): T[] {
    const result: T[] = [];
    const start = this.size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(start + i) % this.capacity]);
    }
    return result;
  }

  getLast(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  getSize(): number {
    return this.size;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  getLatest(): T | undefined {
    if (this.size === 0) return undefined;
    const index = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[index];
  }
}

// ========================================
// ZONE STATE
// ========================================

interface ZoneState {
  zone: GeoZone;
  metrics: ZoneMetrics;
  demandHistory: RingBuffer<DemandMetrics>;
  supplyHistory: RingBuffer<SupplyMetrics>;
  surgeHistory: RingBuffer<SurgeDecision>;
  commissionHistory: RingBuffer<CommissionDecision>;
  incentiveHistory: RingBuffer<IncentiveDecision>;
  activeSurge: number;
  activeCommission: number;
  activeIncentives: IncentiveDecision[];
  lastUpdated: Date;
}

// ========================================
// MARKETPLACE STATE STORE
// ========================================

export class MarketplaceStateStore {
  private zones: Map<string, ZoneState> = new Map();
  private snapshotHistory: RingBuffer<MarketplaceSnapshot>;
  private decisionHistory: RingBuffer<BalancerDecisionPayload>;
  private telemetryBuffer: RingBuffer<TelemetryEvent>;
  private violationHistory: RingBuffer<SafetyGuardViolation>;
  
  private cycleCount: number = 0;
  private lastCycleTime: Date | null = null;
  private cycleDurations: RingBuffer<number>;
  private errorCount: number = 0;
  private lastError: string | null = null;
  
  private isRunning: boolean = false;
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerOpenedAt: Date | null = null;
  private consecutiveFailures: number = 0;
  
  private readonly HISTORY_WINDOW = 60; // 60 cycles = 1 hour at 60s/cycle
  private readonly TELEMETRY_BUFFER_SIZE = 1000;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 300000; // 5 minutes

  constructor() {
    this.snapshotHistory = new RingBuffer(this.HISTORY_WINDOW);
    this.decisionHistory = new RingBuffer(this.HISTORY_WINDOW);
    this.telemetryBuffer = new RingBuffer(this.TELEMETRY_BUFFER_SIZE);
    this.violationHistory = new RingBuffer(100);
    this.cycleDurations = new RingBuffer(this.HISTORY_WINDOW);
  }

  // ========================================
  // ZONE MANAGEMENT
  // ========================================

  initializeZone(zone: GeoZone): void {
    if (this.zones.has(zone.id)) return;

    const defaultDemand: DemandMetrics = {
      zoneId: zone.id,
      rideRequestsPerMinute: 0,
      requestsLastHour: 0,
      requestsLast15Min: 0,
      requestsLast5Min: 0,
      cancellationRate: 0,
      requestConversionRate: 1.0,
      avgWaitTimeSeconds: 0,
      pendingRequests: 0,
      matchRate: 1.0,
    };

    const defaultSupply: SupplyMetrics = {
      zoneId: zone.id,
      activeDrivers: 0,
      idleDrivers: 0,
      onTripDrivers: 0,
      avgDistanceToZone: 0,
      avgAcceptanceRate: 0.85,
      avgCompletionRate: 0.95,
      avgRating: 4.8,
      driversGoingOfflineSoon: 0,
      driversInboundToZone: 0,
    };

    const defaultMetrics: ZoneMetrics = {
      zoneId: zone.id,
      zoneName: zone.name,
      status: 'balanced',
      demand: defaultDemand,
      supply: defaultSupply,
      supplyDemandRatio: 1.0,
      balanceScore: 1.0,
      lastUpdated: new Date(),
    };

    this.zones.set(zone.id, {
      zone,
      metrics: defaultMetrics,
      demandHistory: new RingBuffer(this.HISTORY_WINDOW),
      supplyHistory: new RingBuffer(this.HISTORY_WINDOW),
      surgeHistory: new RingBuffer(this.HISTORY_WINDOW),
      commissionHistory: new RingBuffer(this.HISTORY_WINDOW),
      incentiveHistory: new RingBuffer(this.HISTORY_WINDOW),
      activeSurge: 1.0,
      activeCommission: 15,
      activeIncentives: [],
      lastUpdated: new Date(),
    });
  }

  getZone(zoneId: string): ZoneState | undefined {
    return this.zones.get(zoneId);
  }

  getAllZones(): ZoneState[] {
    return Array.from(this.zones.values());
  }

  updateZoneMetrics(zoneId: string, demand: DemandMetrics, supply: SupplyMetrics): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    zone.demandHistory.push(demand);
    zone.supplyHistory.push(supply);

    const supplyDemandRatio = demand.rideRequestsPerMinute > 0
      ? supply.idleDrivers / demand.rideRequestsPerMinute
      : supply.idleDrivers > 0 ? 10 : 1;

    const balanceScore = Math.min(supplyDemandRatio, 2) / 2;

    let status: ZoneMetrics['status'] = 'balanced';
    if (supplyDemandRatio < 0.3) status = 'critical';
    else if (supplyDemandRatio < 0.7) status = 'supply_shortage';
    else if (supplyDemandRatio > 2.0) status = 'oversupply';
    else if (demand.rideRequestsPerMinute > 5 && supplyDemandRatio < 1.0) status = 'demand_spike';

    zone.metrics = {
      ...zone.metrics,
      demand,
      supply,
      supplyDemandRatio,
      balanceScore,
      status,
      lastUpdated: new Date(),
    };

    zone.lastUpdated = new Date();
  }

  // ========================================
  // DECISION TRACKING
  // ========================================

  applySurgeDecision(decision: SurgeDecision): void {
    const zone = this.zones.get(decision.zoneId);
    if (!zone) return;

    zone.surgeHistory.push(decision);
    zone.activeSurge = decision.recommendedMultiplier;
    zone.lastUpdated = new Date();
  }

  applyCommissionDecision(decision: CommissionDecision): void {
    const zone = this.zones.get(decision.zoneId);
    if (!zone) return;

    zone.commissionHistory.push(decision);
    zone.activeCommission = decision.recommendedRate;
    zone.lastUpdated = new Date();
  }

  applyIncentiveDecision(decision: IncentiveDecision): void {
    const zone = this.zones.get(decision.zoneId);
    if (!zone) return;

    zone.incentiveHistory.push(decision);
    
    if (decision.activate) {
      zone.activeIncentives = [
        ...zone.activeIncentives.filter(i => i.incentiveType !== decision.incentiveType),
        decision,
      ];
    } else {
      zone.activeIncentives = zone.activeIncentives.filter(
        i => i.incentiveType !== decision.incentiveType
      );
    }
    
    zone.lastUpdated = new Date();
  }

  getActiveSurge(zoneId: string): number {
    return this.zones.get(zoneId)?.activeSurge ?? 1.0;
  }

  getActiveCommission(zoneId: string): number {
    return this.zones.get(zoneId)?.activeCommission ?? 15;
  }

  getActiveIncentives(zoneId: string): IncentiveDecision[] {
    return this.zones.get(zoneId)?.activeIncentives ?? [];
  }

  // ========================================
  // SNAPSHOT MANAGEMENT
  // ========================================

  saveSnapshot(snapshot: MarketplaceSnapshot): void {
    this.snapshotHistory.push(snapshot);
  }

  getLatestSnapshot(): MarketplaceSnapshot | undefined {
    return this.snapshotHistory.getLatest();
  }

  getSnapshotHistory(count: number): MarketplaceSnapshot[] {
    return this.snapshotHistory.getLast(count);
  }

  saveDecision(decision: BalancerDecisionPayload): void {
    this.decisionHistory.push(decision);
  }

  getLatestDecision(): BalancerDecisionPayload | undefined {
    return this.decisionHistory.getLatest();
  }

  getDecisionHistory(count: number): BalancerDecisionPayload[] {
    return this.decisionHistory.getLast(count);
  }

  // ========================================
  // TELEMETRY
  // ========================================

  recordTelemetryEvent(event: TelemetryEvent): void {
    this.telemetryBuffer.push(event);
  }

  getTelemetryEvents(count: number): TelemetryEvent[] {
    return this.telemetryBuffer.getLast(count);
  }

  getRecentTelemetryByType(type: TelemetryEvent['eventType'], windowMs: number): TelemetryEvent[] {
    const cutoff = new Date(Date.now() - windowMs);
    return this.telemetryBuffer
      .getAll()
      .filter(e => e.eventType === type && e.timestamp > cutoff);
  }

  // ========================================
  // SAFETY VIOLATIONS
  // ========================================

  recordViolation(violation: SafetyGuardViolation): void {
    this.violationHistory.push(violation);
  }

  getRecentViolations(count: number): SafetyGuardViolation[] {
    return this.violationHistory.getLast(count);
  }

  // ========================================
  // CYCLE MANAGEMENT
  // ========================================

  startCycle(): void {
    this.cycleCount++;
    this.lastCycleTime = new Date();
  }

  endCycle(durationMs: number, error?: string): void {
    this.cycleDurations.push(durationMs);
    
    if (error) {
      this.errorCount++;
      this.lastError = error;
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreakerOpen = true;
        this.circuitBreakerOpenedAt = new Date();
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  getCycleCount(): number {
    return this.cycleCount;
  }

  getAverageCycleDuration(): number {
    const durations = this.cycleDurations.getAll();
    if (durations.length === 0) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  // ========================================
  // CIRCUIT BREAKER
  // ========================================

  isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    if (this.circuitBreakerOpenedAt) {
      const elapsed = Date.now() - this.circuitBreakerOpenedAt.getTime();
      if (elapsed > this.CIRCUIT_BREAKER_RESET_MS) {
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
        return false;
      }
    }
    
    return true;
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenedAt = null;
    this.consecutiveFailures = 0;
  }

  // ========================================
  // STATUS
  // ========================================

  setRunning(running: boolean): void {
    this.isRunning = running;
  }

  getStatus(): {
    isRunning: boolean;
    cycleCount: number;
    lastCycleTime: Date | null;
    avgCycleDurationMs: number;
    errorCount: number;
    lastError: string | null;
    circuitBreakerOpen: boolean;
    zoneCount: number;
  } {
    return {
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      lastCycleTime: this.lastCycleTime,
      avgCycleDurationMs: this.getAverageCycleDuration(),
      errorCount: this.errorCount,
      lastError: this.lastError,
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      zoneCount: this.zones.size,
    };
  }

  // ========================================
  // HISTORY ACCESS
  // ========================================

  getDemandHistory(zoneId: string, count: number): DemandMetrics[] {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];
    return zone.demandHistory.getLast(count);
  }

  getSupplyHistory(zoneId: string, count: number): SupplyMetrics[] {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];
    return zone.supplyHistory.getLast(count);
  }

  getSurgeHistory(zoneId: string, count: number): SurgeDecision[] {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];
    return zone.surgeHistory.getLast(count);
  }

  // ========================================
  // RESET
  // ========================================

  reset(): void {
    this.zones.clear();
    this.snapshotHistory.clear();
    this.decisionHistory.clear();
    this.telemetryBuffer.clear();
    this.violationHistory.clear();
    this.cycleDurations.clear();
    this.cycleCount = 0;
    this.lastCycleTime = null;
    this.errorCount = 0;
    this.lastError = null;
    this.isRunning = false;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenedAt = null;
    this.consecutiveFailures = 0;
  }
}

// Singleton instance
export const marketplaceState = new MarketplaceStateStore();

export default marketplaceState;
