/**
 * SafeGo AI Marketplace Balancer - Predictive Models
 * 
 * ML-style prediction algorithms for:
 * - Demand forecasting (10m/30m/60m)
 * - Supply forecasting
 * - Shortage risk assessment
 * - Hot zone identification
 */

import {
  DemandMetrics,
  SupplyMetrics,
  DemandForecast,
  SupplyForecast,
  SupplyGap,
  ForecastWindow,
  DemandLevel,
  SupplyLevel,
  DemandFactor,
  WeatherCondition,
  EventInfo,
  ZoneMetrics,
} from '@shared/marketplace';
import { marketplaceState } from './stateStore';

// ========================================
// EXPONENTIAL SMOOTHING
// ========================================

function exponentialSmoothing(values: number[], alpha: number = 0.3): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
}

function linearTrend(values: number[]): { slope: number; intercept: number } {
  if (values.length < 2) return { slope: 0, intercept: values[0] || 0 };
  
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? values[0] || 0 : intercept };
}

// ========================================
// DEMAND PREDICTION
// ========================================

export function predictDemand(
  zoneId: string,
  window: '10m' | '30m' | '60m',
  weather: WeatherCondition,
  events: EventInfo[]
): DemandForecast {
  const history = marketplaceState.getDemandHistory(zoneId, 60);
  const requestRates = history.map(h => h.rideRequestsPerMinute);
  
  // Base prediction using exponential smoothing
  const smoothedRate = exponentialSmoothing(requestRates, 0.4);
  const { slope } = linearTrend(requestRates);
  
  // Time-based multiplier
  const windowMinutes = window === '10m' ? 10 : window === '30m' ? 30 : 60;
  const projectedChange = slope * windowMinutes;
  
  // Calculate factors
  const factors: DemandFactor[] = [];
  let totalMultiplier = 1.0;
  
  // Time of day factor
  const now = new Date();
  const futureTime = new Date(now.getTime() + windowMinutes * 60000);
  const futureHour = futureTime.getHours();
  const timeMultiplier = getTimeOfDayMultiplier(futureHour);
  if (timeMultiplier !== 1.0) {
    factors.push({
      type: 'time_of_day',
      impact: timeMultiplier - 1,
      description: getTimeOfDayDescription(futureHour),
    });
    totalMultiplier *= timeMultiplier;
  }
  
  // Day of week factor
  const dayMultiplier = getDayOfWeekMultiplier(futureTime.getDay(), futureHour);
  if (dayMultiplier !== 1.0) {
    factors.push({
      type: 'day_of_week',
      impact: dayMultiplier - 1,
      description: getDayOfWeekDescription(futureTime.getDay()),
    });
    totalMultiplier *= dayMultiplier;
  }
  
  // Weather factor
  if (weather.severity !== 'none') {
    factors.push({
      type: 'weather',
      impact: weather.impactMultiplier - 1,
      description: `${weather.type.replace('_', ' ')} conditions`,
    });
    totalMultiplier *= weather.impactMultiplier;
  }
  
  // Event factor
  const relevantEvents = events.filter(e => isEventRelevant(e, zoneId, futureTime));
  for (const event of relevantEvents) {
    factors.push({
      type: 'event',
      impact: event.demandImpact - 1,
      description: event.name,
    });
    totalMultiplier *= event.demandImpact;
  }
  
  // Historical pattern factor (trend)
  if (Math.abs(projectedChange) > 0.5) {
    factors.push({
      type: 'trend',
      impact: projectedChange / Math.max(smoothedRate, 1),
      description: projectedChange > 0 ? 'Increasing trend' : 'Decreasing trend',
    });
  }
  
  // Calculate final prediction
  const basePrediction = Math.max(0, smoothedRate + projectedChange);
  const adjustedPrediction = basePrediction * totalMultiplier;
  const predictedRequestsPerMinute = Math.round(adjustedPrediction * 10) / 10;
  
  // Determine demand level
  const predictedLevel = getDemandLevel(predictedRequestsPerMinute);
  
  // Calculate confidence (decreases with longer windows)
  const baseConfidence = Math.min(0.95, 0.7 + (history.length / 100));
  const windowPenalty = window === '10m' ? 0 : window === '30m' ? 0.1 : 0.2;
  const factorPenalty = factors.length * 0.03;
  const confidenceScore = Math.max(0.5, baseConfidence - windowPenalty - factorPenalty);
  
  return {
    zoneId,
    window,
    predictedLevel,
    predictedRequestsPerMinute,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    factors,
    timestamp: new Date(),
  };
}

function getTimeOfDayMultiplier(hour: number): number {
  if (hour >= 7 && hour <= 9) return 1.4; // Morning rush
  if (hour >= 17 && hour <= 20) return 1.5; // Evening rush
  if (hour >= 22 || hour <= 2) return 1.3; // Nightlife
  if (hour >= 2 && hour <= 5) return 0.5; // Late night
  return 1.0;
}

function getTimeOfDayDescription(hour: number): string {
  if (hour >= 7 && hour <= 9) return 'Morning rush hour';
  if (hour >= 17 && hour <= 20) return 'Evening rush hour';
  if (hour >= 22 || hour <= 2) return 'Nightlife peak';
  if (hour >= 2 && hour <= 5) return 'Late night low';
  return 'Normal hours';
}

function getDayOfWeekMultiplier(day: number, hour: number): number {
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    if (hour >= 10 && hour <= 14) return 1.2;
    if (hour >= 20 || hour <= 2) return 1.4;
  } else {
    if (day === 5 && hour >= 17) return 1.3; // Friday evening
  }
  return 1.0;
}

function getDayOfWeekDescription(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? `Weekend (${days[day]})` : days[day];
}

function getDemandLevel(requestsPerMinute: number): DemandLevel {
  if (requestsPerMinute >= 8) return 'extreme';
  if (requestsPerMinute >= 5) return 'high';
  if (requestsPerMinute >= 2) return 'normal';
  return 'low';
}

function isEventRelevant(event: EventInfo, zoneId: string, time: Date): boolean {
  if (time < event.startTime || time > event.endTime) return false;
  // Simplified relevance check - in production would use geo distance
  return true;
}

// ========================================
// SUPPLY PREDICTION
// ========================================

export function predictSupply(
  zoneId: string,
  window: '10m' | '30m' | '60m'
): SupplyForecast {
  const history = marketplaceState.getSupplyHistory(zoneId, 60);
  const activeDrivers = history.map(h => h.activeDrivers);
  const idleDrivers = history.map(h => h.idleDrivers);
  const goingOffline = history.map(h => h.driversGoingOfflineSoon);
  
  // Base prediction
  const smoothedActive = exponentialSmoothing(activeDrivers, 0.3);
  const { slope } = linearTrend(activeDrivers);
  
  const windowMinutes = window === '10m' ? 10 : window === '30m' ? 30 : 60;
  const projectedChange = slope * windowMinutes;
  
  // Estimate drivers going offline
  const avgGoingOffline = goingOffline.length > 0
    ? goingOffline.reduce((a, b) => a + b, 0) / goingOffline.length
    : 0;
  const expectedOffline = avgGoingOffline * (windowMinutes / 60);
  
  // Calculate prediction
  const predictedActiveDrivers = Math.max(0, Math.round(smoothedActive + projectedChange - expectedOffline));
  
  // Determine supply level
  const predictedLevel = getSupplyLevel(predictedActiveDrivers, zoneId);
  
  // Calculate shortage risk
  const zoneState = marketplaceState.getZone(zoneId);
  const currentDemand = zoneState?.metrics.demand.rideRequestsPerMinute || 0;
  const requiredDrivers = Math.ceil(currentDemand * 3); // 3 drivers per request/min
  const shortageRisk = predictedActiveDrivers < requiredDrivers
    ? Math.min(1, (requiredDrivers - predictedActiveDrivers) / Math.max(requiredDrivers, 1))
    : 0;
  
  // Confidence
  const baseConfidence = Math.min(0.95, 0.75 + (history.length / 120));
  const windowPenalty = window === '10m' ? 0 : window === '30m' ? 0.08 : 0.15;
  const confidenceScore = Math.max(0.5, baseConfidence - windowPenalty);
  
  return {
    zoneId,
    window,
    predictedLevel,
    predictedActiveDrivers,
    shortageRisk: Math.round(shortageRisk * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    timestamp: new Date(),
  };
}

function getSupplyLevel(activeDrivers: number, zoneId: string): SupplyLevel {
  // Adjust thresholds based on zone type
  const isAirport = zoneId.includes('airport');
  const threshold = isAirport ? { critical: 5, low: 10, adequate: 20 } 
                              : { critical: 8, low: 15, adequate: 25 };
  
  if (activeDrivers <= threshold.critical) return 'critical';
  if (activeDrivers <= threshold.low) return 'low';
  if (activeDrivers <= threshold.adequate) return 'adequate';
  return 'surplus';
}

// ========================================
// SUPPLY GAP CALCULATION
// ========================================

export function calculateSupplyGap(
  zoneId: string,
  demandForecast: DemandForecast,
  supplyForecast: SupplyForecast
): SupplyGap {
  // Calculate required drivers based on predicted demand
  const driversPerRequestPerMinute = 2.5;
  const requiredDrivers = Math.ceil(demandForecast.predictedRequestsPerMinute * driversPerRequestPerMinute);
  const currentDrivers = supplyForecast.predictedActiveDrivers;
  
  const gap = requiredDrivers - currentDrivers;
  const gapPercent = requiredDrivers > 0 
    ? Math.round((gap / requiredDrivers) * 100) 
    : 0;
  
  let severity: SupplyGap['severity'] = 'none';
  if (gap > 0) {
    if (gapPercent >= 50) severity = 'severe';
    else if (gapPercent >= 30) severity = 'moderate';
    else if (gapPercent >= 10) severity = 'minor';
  }
  
  return {
    zoneId,
    currentDrivers,
    requiredDrivers,
    gap: Math.max(0, gap),
    gapPercent: Math.max(0, gapPercent),
    severity,
  };
}

// ========================================
// FORECAST WINDOW GENERATION
// ========================================

export function generateForecastWindow(
  zones: ZoneMetrics[],
  window: '10m' | '30m' | '60m',
  weather: WeatherCondition,
  events: EventInfo[]
): ForecastWindow {
  const demandForecasts: DemandForecast[] = [];
  const supplyForecasts: SupplyForecast[] = [];
  const supplyGaps: SupplyGap[] = [];
  const hotZones: string[] = [];
  const coldZones: string[] = [];
  
  for (const zone of zones) {
    const demandForecast = predictDemand(zone.zoneId, window, weather, events);
    const supplyForecast = predictSupply(zone.zoneId, window);
    const supplyGap = calculateSupplyGap(zone.zoneId, demandForecast, supplyForecast);
    
    demandForecasts.push(demandForecast);
    supplyForecasts.push(supplyForecast);
    supplyGaps.push(supplyGap);
    
    // Identify hot and cold zones
    if (demandForecast.predictedLevel === 'extreme' || demandForecast.predictedLevel === 'high') {
      hotZones.push(zone.zoneId);
    }
    if (supplyForecast.predictedLevel === 'surplus' && demandForecast.predictedLevel === 'low') {
      coldZones.push(zone.zoneId);
    }
  }
  
  return {
    window,
    demandForecasts,
    supplyForecasts,
    supplyGaps,
    hotZones,
    coldZones,
    timestamp: new Date(),
  };
}

// ========================================
// EXPORTS
// ========================================

export default {
  predictDemand,
  predictSupply,
  calculateSupplyGap,
  generateForecastWindow,
};
