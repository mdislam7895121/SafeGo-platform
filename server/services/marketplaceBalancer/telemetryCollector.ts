/**
 * SafeGo AI Marketplace Balancer - Telemetry Collector
 * 
 * Real-time data ingestion for marketplace optimization:
 * - Ride request metrics
 * - Driver supply metrics
 * - Weather and event data
 * - Traffic and pricing data
 */

import {
  DemandMetrics,
  SupplyMetrics,
  ZoneMetrics,
  GlobalMetrics,
  MarketplaceSnapshot,
  WeatherCondition,
  EventInfo,
  TelemetryEvent,
  GeoZone,
  GeoLocation,
} from '@shared/marketplace';
import { marketplaceState } from './stateStore';

// ========================================
// DEFAULT ZONES (NYC Metro)
// ========================================

export const DEFAULT_ZONES: GeoZone[] = [
  { id: 'manhattan_midtown', name: 'Midtown Manhattan', center: { lat: 40.7549, lng: -73.9840 }, radiusMiles: 1.5 },
  { id: 'manhattan_downtown', name: 'Downtown Manhattan', center: { lat: 40.7128, lng: -74.0060 }, radiusMiles: 1.5 },
  { id: 'manhattan_uptown', name: 'Uptown Manhattan', center: { lat: 40.7831, lng: -73.9712 }, radiusMiles: 1.5 },
  { id: 'brooklyn_downtown', name: 'Downtown Brooklyn', center: { lat: 40.6892, lng: -73.9857 }, radiusMiles: 2.0 },
  { id: 'brooklyn_williamsburg', name: 'Williamsburg', center: { lat: 40.7081, lng: -73.9571 }, radiusMiles: 1.5 },
  { id: 'queens_lic', name: 'Long Island City', center: { lat: 40.7447, lng: -73.9485 }, radiusMiles: 1.5 },
  { id: 'queens_astoria', name: 'Astoria', center: { lat: 40.7720, lng: -73.9301 }, radiusMiles: 1.5 },
  { id: 'jfk_airport', name: 'JFK Airport', center: { lat: 40.6413, lng: -73.7781 }, radiusMiles: 2.5 },
  { id: 'lga_airport', name: 'LaGuardia Airport', center: { lat: 40.7769, lng: -73.8740 }, radiusMiles: 1.5 },
  { id: 'ewr_airport', name: 'Newark Airport', center: { lat: 40.6895, lng: -74.1745 }, radiusMiles: 2.5 },
];

// ========================================
// TELEMETRY COLLECTOR CLASS
// ========================================

export class TelemetryCollector {
  private zones: GeoZone[];
  private lastCollectionTime: Date | null = null;
  private simulationMode: boolean = true;

  constructor(zones: GeoZone[] = DEFAULT_ZONES) {
    this.zones = zones;
    this.initializeZones();
  }

  private initializeZones(): void {
    for (const zone of this.zones) {
      marketplaceState.initializeZone(zone);
    }
  }

  // ========================================
  // DATA COLLECTION
  // ========================================

  async collectSnapshot(): Promise<MarketplaceSnapshot> {
    const timestamp = new Date();
    const zones: ZoneMetrics[] = [];

    for (const zone of this.zones) {
      const demand = await this.collectDemandMetrics(zone.id);
      const supply = await this.collectSupplyMetrics(zone.id);
      
      marketplaceState.updateZoneMetrics(zone.id, demand, supply);
      
      const zoneState = marketplaceState.getZone(zone.id);
      if (zoneState) {
        zones.push(zoneState.metrics);
      }
    }

    const globalMetrics = this.calculateGlobalMetrics(zones);
    const weather = await this.collectWeatherData();
    const activeEvents = await this.collectActiveEvents();

    const snapshot: MarketplaceSnapshot = {
      timestamp,
      zones,
      globalMetrics,
      weather,
      activeEvents,
    };

    marketplaceState.saveSnapshot(snapshot);
    this.lastCollectionTime = timestamp;

    return snapshot;
  }

  private async collectDemandMetrics(zoneId: string): Promise<DemandMetrics> {
    if (this.simulationMode) {
      return this.simulateDemandMetrics(zoneId);
    }
    
    // In production, this would query actual ride request data
    return this.simulateDemandMetrics(zoneId);
  }

  private async collectSupplyMetrics(zoneId: string): Promise<SupplyMetrics> {
    if (this.simulationMode) {
      return this.simulateSupplyMetrics(zoneId);
    }
    
    // In production, this would query actual driver data
    return this.simulateSupplyMetrics(zoneId);
  }

  private async collectWeatherData(): Promise<WeatherCondition> {
    if (this.simulationMode) {
      return this.simulateWeather();
    }
    
    // In production, this would call a weather API
    return this.simulateWeather();
  }

  private async collectActiveEvents(): Promise<EventInfo[]> {
    if (this.simulationMode) {
      return this.simulateEvents();
    }
    
    // In production, this would query an events database
    return this.simulateEvents();
  }

  // ========================================
  // SIMULATION (For Development)
  // ========================================

  private simulateDemandMetrics(zoneId: string): DemandMetrics {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAirport = zoneId.includes('airport');
    
    // Base demand varies by time of day
    let baseDemand = 2;
    if (hour >= 7 && hour <= 9) baseDemand = 5; // Morning rush
    else if (hour >= 17 && hour <= 20) baseDemand = 6; // Evening rush
    else if (hour >= 22 || hour <= 2) baseDemand = isWeekend ? 7 : 3; // Nightlife
    else if (hour >= 2 && hour <= 5) baseDemand = 1; // Late night
    
    // Airport has different patterns
    if (isAirport) {
      baseDemand = Math.max(3, baseDemand);
      if (hour >= 6 && hour <= 10) baseDemand = 8; // Morning flights
      if (hour >= 16 && hour <= 20) baseDemand = 7; // Evening flights
    }
    
    // Add some randomness
    const randomFactor = 0.8 + Math.random() * 0.4;
    const requestsPerMinute = Math.max(0.5, baseDemand * randomFactor);
    
    const cancellationRate = 0.05 + Math.random() * 0.10;
    const matchRate = 0.85 + Math.random() * 0.10;
    
    return {
      zoneId,
      rideRequestsPerMinute: Math.round(requestsPerMinute * 10) / 10,
      requestsLastHour: Math.round(requestsPerMinute * 60),
      requestsLast15Min: Math.round(requestsPerMinute * 15),
      requestsLast5Min: Math.round(requestsPerMinute * 5),
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      requestConversionRate: Math.round(matchRate * 100) / 100,
      avgWaitTimeSeconds: Math.round(120 + Math.random() * 180),
      pendingRequests: Math.round(Math.random() * 10),
      matchRate: Math.round(matchRate * 100) / 100,
    };
  }

  private simulateSupplyMetrics(zoneId: string): SupplyMetrics {
    const now = new Date();
    const hour = now.getHours();
    const isAirport = zoneId.includes('airport');
    
    // Base supply varies by time
    let baseSupply = 15;
    if (hour >= 7 && hour <= 9) baseSupply = 25; // Morning
    else if (hour >= 17 && hour <= 22) baseSupply = 30; // Evening peak
    else if (hour >= 2 && hour <= 5) baseSupply = 8; // Late night low
    
    // Airports have dedicated supply
    if (isAirport) {
      baseSupply = Math.max(10, baseSupply * 0.7);
    }
    
    const randomFactor = 0.8 + Math.random() * 0.4;
    const activeDrivers = Math.round(baseSupply * randomFactor);
    const idlePercent = 0.3 + Math.random() * 0.3;
    const idleDrivers = Math.round(activeDrivers * idlePercent);
    
    return {
      zoneId,
      activeDrivers,
      idleDrivers,
      onTripDrivers: activeDrivers - idleDrivers,
      avgDistanceToZone: 0.5 + Math.random() * 2,
      avgAcceptanceRate: 0.80 + Math.random() * 0.15,
      avgCompletionRate: 0.92 + Math.random() * 0.06,
      avgRating: 4.6 + Math.random() * 0.3,
      driversGoingOfflineSoon: Math.round(activeDrivers * (0.05 + Math.random() * 0.1)),
      driversInboundToZone: Math.round(Math.random() * 5),
    };
  }

  private simulateWeather(): WeatherCondition {
    const random = Math.random();
    
    if (random < 0.7) {
      return {
        type: 'clear',
        temperatureFahrenheit: 55 + Math.round(Math.random() * 30),
        severity: 'none',
        impactMultiplier: 1.0,
      };
    } else if (random < 0.85) {
      return {
        type: 'rain',
        temperatureFahrenheit: 50 + Math.round(Math.random() * 20),
        severity: 'mild',
        impactMultiplier: 1.2,
      };
    } else if (random < 0.95) {
      return {
        type: 'heavy_rain',
        temperatureFahrenheit: 45 + Math.round(Math.random() * 15),
        severity: 'moderate',
        impactMultiplier: 1.5,
      };
    } else {
      return {
        type: 'storm',
        temperatureFahrenheit: 40 + Math.round(Math.random() * 10),
        severity: 'severe',
        impactMultiplier: 1.8,
      };
    }
  }

  private simulateEvents(): EventInfo[] {
    const now = new Date();
    const events: EventInfo[] = [];
    
    // Simulate random events with 30% probability
    if (Math.random() < 0.3) {
      const eventTypes: EventInfo['type'][] = ['concert', 'sports', 'festival', 'conference'];
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      events.push({
        id: `event-${Date.now()}`,
        name: `${randomType.charAt(0).toUpperCase() + randomType.slice(1)} Event`,
        type: randomType,
        location: { lat: 40.7580, lng: -73.9855 },
        radiusMiles: 1.0,
        startTime: new Date(now.getTime() - 3600000),
        endTime: new Date(now.getTime() + 3600000),
        expectedAttendees: 5000 + Math.round(Math.random() * 15000),
        demandImpact: 1.3 + Math.random() * 0.4,
      });
    }
    
    return events;
  }

  // ========================================
  // GLOBAL METRICS
  // ========================================

  private calculateGlobalMetrics(zones: ZoneMetrics[]): GlobalMetrics {
    let totalActiveDrivers = 0;
    let totalIdleDrivers = 0;
    let totalPendingRequests = 0;
    let totalWaitTime = 0;
    let totalMatchRate = 0;
    let totalCancellationRate = 0;
    let totalSurge = 0;
    let totalCommission = 0;

    for (const zone of zones) {
      totalActiveDrivers += zone.supply.activeDrivers;
      totalIdleDrivers += zone.supply.idleDrivers;
      totalPendingRequests += zone.demand.pendingRequests;
      totalWaitTime += zone.demand.avgWaitTimeSeconds;
      totalMatchRate += zone.demand.matchRate;
      totalCancellationRate += zone.demand.cancellationRate;
      
      const zoneState = marketplaceState.getZone(zone.zoneId);
      if (zoneState) {
        totalSurge += zoneState.activeSurge;
        totalCommission += zoneState.activeCommission;
      }
    }

    const zoneCount = zones.length || 1;

    return {
      totalActiveDrivers,
      totalIdleDrivers,
      totalPendingRequests,
      avgWaitTimeSeconds: Math.round(totalWaitTime / zoneCount),
      globalMatchRate: Math.round((totalMatchRate / zoneCount) * 100) / 100,
      globalCancellationRate: Math.round((totalCancellationRate / zoneCount) * 100) / 100,
      avgSurgeMultiplier: Math.round((totalSurge / zoneCount) * 100) / 100,
      avgCommissionRate: Math.round((totalCommission / zoneCount) * 10) / 10,
    };
  }

  // ========================================
  // TELEMETRY EVENTS
  // ========================================

  recordRideRequest(zoneId: string, data: Record<string, unknown>): void {
    marketplaceState.recordTelemetryEvent({
      eventType: 'ride_request',
      timestamp: new Date(),
      zoneId,
      data,
    });
  }

  recordRideMatched(zoneId: string, data: Record<string, unknown>): void {
    marketplaceState.recordTelemetryEvent({
      eventType: 'ride_matched',
      timestamp: new Date(),
      zoneId,
      data,
    });
  }

  recordRideCancelled(zoneId: string, data: Record<string, unknown>): void {
    marketplaceState.recordTelemetryEvent({
      eventType: 'ride_cancelled',
      timestamp: new Date(),
      zoneId,
      data,
    });
  }

  recordDriverOnline(zoneId: string, driverId: string): void {
    marketplaceState.recordTelemetryEvent({
      eventType: 'driver_online',
      timestamp: new Date(),
      zoneId,
      data: { driverId },
    });
  }

  recordDriverOffline(zoneId: string, driverId: string): void {
    marketplaceState.recordTelemetryEvent({
      eventType: 'driver_offline',
      timestamp: new Date(),
      zoneId,
      data: { driverId },
    });
  }

  // ========================================
  // UTILITIES
  // ========================================

  getZones(): GeoZone[] {
    return this.zones;
  }

  setSimulationMode(enabled: boolean): void {
    this.simulationMode = enabled;
  }

  isSimulating(): boolean {
    return this.simulationMode;
  }

  getLastCollectionTime(): Date | null {
    return this.lastCollectionTime;
  }

  findZoneForLocation(location: GeoLocation): string | null {
    for (const zone of this.zones) {
      const distance = this.getDistanceMiles(location, zone.center);
      if (distance <= zone.radiusMiles) {
        return zone.id;
      }
    }
    return null;
  }

  private getDistanceMiles(a: GeoLocation, b: GeoLocation): number {
    const R = 3959;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    
    return R * c;
  }
}

// Singleton instance
export const telemetryCollector = new TelemetryCollector();

export default telemetryCollector;
