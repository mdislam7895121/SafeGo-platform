/**
 * SafeGo AI Marketplace Balancer - Heatmap Generator
 * 
 * Generates visual heatmaps for admin dashboards:
 * - Live demand heatmap
 * - Live supply heatmap
 * - Predicted 30m/60m heatmaps
 * - Surge zone visualization
 * - Incentive zone visualization
 */

import {
  HeatmapCell,
  HeatmapData,
  MarketplaceHeatmaps,
  ZoneMetrics,
  ForecastWindow,
  DemandForecast,
  SupplyForecast,
  GeoLocation,
} from '@shared/marketplace';
import { marketplaceState } from './stateStore';

// ========================================
// INTENSITY THRESHOLDS
// ========================================

interface IntensityThresholds {
  demand: { low: number; medium: number; high: number };
  supply: { low: number; medium: number; high: number };
  surge: { low: number; medium: number; high: number };
}

const DEFAULT_THRESHOLDS: IntensityThresholds = {
  demand: { low: 2, medium: 5, high: 8 },
  supply: { low: 10, medium: 20, high: 30 },
  surge: { low: 1.1, medium: 1.3, high: 1.5 },
};

// ========================================
// HEATMAP GENERATOR CLASS
// ========================================

export class HeatmapGenerator {
  private thresholds: IntensityThresholds;

  constructor(thresholds: IntensityThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  // ========================================
  // MAIN GENERATION
  // ========================================

  generateAllHeatmaps(
    zones: ZoneMetrics[],
    forecast30m: ForecastWindow,
    forecast60m: ForecastWindow
  ): MarketplaceHeatmaps {
    return {
      demandLive: this.generateDemandHeatmap(zones),
      supplyLive: this.generateSupplyHeatmap(zones),
      demand30m: this.generateForecastDemandHeatmap(forecast30m),
      demand60m: this.generateForecastDemandHeatmap(forecast60m),
      surgeZones: this.generateSurgeHeatmap(zones),
      incentiveZones: this.generateIncentiveHeatmap(zones),
      timestamp: new Date(),
    };
  }

  // ========================================
  // DEMAND HEATMAP
  // ========================================

  generateDemandHeatmap(zones: ZoneMetrics[]): HeatmapData {
    const cells: HeatmapCell[] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    let totalValue = 0;

    for (const zone of zones) {
      const value = zone.demand.rideRequestsPerMinute;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      totalValue += value;

      cells.push({
        zoneId: zone.zoneId,
        center: this.getZoneCenter(zone.zoneId),
        value,
        intensity: this.getDemandIntensity(value),
        timestamp: new Date(),
      });
    }

    return {
      type: 'demand',
      timestamp: new Date(),
      cells,
      minValue: minValue === Infinity ? 0 : minValue,
      maxValue: maxValue === -Infinity ? 0 : maxValue,
      avgValue: zones.length > 0 ? totalValue / zones.length : 0,
    };
  }

  private getDemandIntensity(value: number): HeatmapCell['intensity'] {
    if (value >= this.thresholds.demand.high) return 'extreme';
    if (value >= this.thresholds.demand.medium) return 'high';
    if (value >= this.thresholds.demand.low) return 'medium';
    return 'low';
  }

  // ========================================
  // SUPPLY HEATMAP
  // ========================================

  generateSupplyHeatmap(zones: ZoneMetrics[]): HeatmapData {
    const cells: HeatmapCell[] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    let totalValue = 0;

    for (const zone of zones) {
      const value = zone.supply.idleDrivers;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      totalValue += value;

      cells.push({
        zoneId: zone.zoneId,
        center: this.getZoneCenter(zone.zoneId),
        value,
        intensity: this.getSupplyIntensity(value),
        timestamp: new Date(),
      });
    }

    return {
      type: 'supply',
      timestamp: new Date(),
      cells,
      minValue: minValue === Infinity ? 0 : minValue,
      maxValue: maxValue === -Infinity ? 0 : maxValue,
      avgValue: zones.length > 0 ? totalValue / zones.length : 0,
    };
  }

  private getSupplyIntensity(value: number): HeatmapCell['intensity'] {
    // Inverse intensity - low supply = extreme (bad)
    if (value <= this.thresholds.supply.low / 2) return 'extreme';
    if (value <= this.thresholds.supply.low) return 'high';
    if (value <= this.thresholds.supply.medium) return 'medium';
    return 'low';
  }

  // ========================================
  // FORECAST DEMAND HEATMAP
  // ========================================

  generateForecastDemandHeatmap(forecast: ForecastWindow): HeatmapData {
    const cells: HeatmapCell[] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    let totalValue = 0;

    for (const demandForecast of forecast.demandForecasts) {
      const value = demandForecast.predictedRequestsPerMinute;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      totalValue += value;

      cells.push({
        zoneId: demandForecast.zoneId,
        center: this.getZoneCenter(demandForecast.zoneId),
        value,
        intensity: this.getDemandIntensity(value),
        timestamp: demandForecast.timestamp,
      });
    }

    return {
      type: 'demand',
      timestamp: forecast.timestamp,
      cells,
      minValue: minValue === Infinity ? 0 : minValue,
      maxValue: maxValue === -Infinity ? 0 : maxValue,
      avgValue: forecast.demandForecasts.length > 0 ? totalValue / forecast.demandForecasts.length : 0,
    };
  }

  // ========================================
  // SURGE HEATMAP
  // ========================================

  generateSurgeHeatmap(zones: ZoneMetrics[]): HeatmapData {
    const cells: HeatmapCell[] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    let totalValue = 0;

    for (const zone of zones) {
      const value = marketplaceState.getActiveSurge(zone.zoneId);
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      totalValue += value;

      cells.push({
        zoneId: zone.zoneId,
        center: this.getZoneCenter(zone.zoneId),
        value,
        intensity: this.getSurgeIntensity(value),
        timestamp: new Date(),
      });
    }

    return {
      type: 'surge',
      timestamp: new Date(),
      cells,
      minValue: minValue === Infinity ? 1 : minValue,
      maxValue: maxValue === -Infinity ? 1 : maxValue,
      avgValue: zones.length > 0 ? totalValue / zones.length : 1,
    };
  }

  private getSurgeIntensity(value: number): HeatmapCell['intensity'] {
    if (value >= this.thresholds.surge.high) return 'extreme';
    if (value >= this.thresholds.surge.medium) return 'high';
    if (value >= this.thresholds.surge.low) return 'medium';
    return 'low';
  }

  // ========================================
  // INCENTIVE HEATMAP
  // ========================================

  generateIncentiveHeatmap(zones: ZoneMetrics[]): HeatmapData {
    const cells: HeatmapCell[] = [];
    let minValue = Infinity;
    let maxValue = -Infinity;
    let totalValue = 0;

    for (const zone of zones) {
      const incentives = marketplaceState.getActiveIncentives(zone.zoneId);
      const value = incentives.length;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      totalValue += value;

      let intensity: HeatmapCell['intensity'] = 'low';
      if (value >= 3) intensity = 'extreme';
      else if (value >= 2) intensity = 'high';
      else if (value >= 1) intensity = 'medium';

      cells.push({
        zoneId: zone.zoneId,
        center: this.getZoneCenter(zone.zoneId),
        value,
        intensity,
        timestamp: new Date(),
      });
    }

    return {
      type: 'incentive',
      timestamp: new Date(),
      cells,
      minValue: minValue === Infinity ? 0 : minValue,
      maxValue: maxValue === -Infinity ? 0 : maxValue,
      avgValue: zones.length > 0 ? totalValue / zones.length : 0,
    };
  }

  // ========================================
  // UTILITIES
  // ========================================

  private getZoneCenter(zoneId: string): GeoLocation {
    const zoneState = marketplaceState.getZone(zoneId);
    if (zoneState) {
      return zoneState.zone.center;
    }
    
    // Fallback zone centers
    const zoneCenters: Record<string, GeoLocation> = {
      'manhattan_midtown': { lat: 40.7549, lng: -73.9840 },
      'manhattan_downtown': { lat: 40.7128, lng: -74.0060 },
      'manhattan_uptown': { lat: 40.7831, lng: -73.9712 },
      'brooklyn_downtown': { lat: 40.6892, lng: -73.9857 },
      'brooklyn_williamsburg': { lat: 40.7081, lng: -73.9571 },
      'queens_lic': { lat: 40.7447, lng: -73.9485 },
      'queens_astoria': { lat: 40.7720, lng: -73.9301 },
      'jfk_airport': { lat: 40.6413, lng: -73.7781 },
      'lga_airport': { lat: 40.7769, lng: -73.8740 },
      'ewr_airport': { lat: 40.6895, lng: -74.1745 },
    };
    
    return zoneCenters[zoneId] || { lat: 40.7128, lng: -74.0060 };
  }

  updateThresholds(thresholds: Partial<IntensityThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  getThresholds(): IntensityThresholds {
    return { ...this.thresholds };
  }

  // ========================================
  // SUMMARY STATS
  // ========================================

  getHeatmapSummary(heatmap: HeatmapData): {
    totalCells: number;
    byIntensity: Record<HeatmapCell['intensity'], number>;
    hotspots: string[];
    coldspots: string[];
  } {
    const byIntensity: Record<HeatmapCell['intensity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      extreme: 0,
    };

    const hotspots: string[] = [];
    const coldspots: string[] = [];

    for (const cell of heatmap.cells) {
      byIntensity[cell.intensity]++;
      
      if (cell.intensity === 'extreme' || cell.intensity === 'high') {
        hotspots.push(cell.zoneId);
      } else if (cell.intensity === 'low') {
        coldspots.push(cell.zoneId);
      }
    }

    return {
      totalCells: heatmap.cells.length,
      byIntensity,
      hotspots,
      coldspots,
    };
  }
}

// Singleton instance
export const heatmapGenerator = new HeatmapGenerator();

export default heatmapGenerator;
