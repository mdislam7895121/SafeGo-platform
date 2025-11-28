/**
 * Demand Detection Engine
 * 
 * A lightweight module that determines the current demand level
 * based on real-time market conditions.
 * 
 * Inputs:
 * - activeRides: Number of active rides in the zone
 * - availableDrivers: Number of available drivers in the zone
 * - surgeMultiplier: Current surge multiplier (1.0 = no surge)
 * - etaDensity: Average ETA in minutes (lower = higher demand)
 * 
 * Output:
 * - demandLevel: "low" | "normal" | "high"
 */

export type DemandLevel = "low" | "normal" | "high";

export interface DemandInput {
  activeRides: number;
  availableDrivers: number;
  surgeMultiplier: number;
  etaDensity: number;
  hour?: number;
  dayOfWeek?: number;
}

export interface DemandResult {
  demandLevel: DemandLevel;
  demandScore: number;
  factors: {
    supplyDemandRatio: number;
    surgeImpact: number;
    etaImpact: number;
    timeImpact: number;
  };
}

export interface DemandThresholds {
  lowDemandMaxScore: number;
  highDemandMinScore: number;
  supplyDemandWeight: number;
  surgeWeight: number;
  etaWeight: number;
  timeWeight: number;
}

export const DEFAULT_DEMAND_THRESHOLDS: DemandThresholds = {
  lowDemandMaxScore: 30,
  highDemandMinScore: 70,
  supplyDemandWeight: 0.35,
  surgeWeight: 0.30,
  etaWeight: 0.20,
  timeWeight: 0.15,
};

function isPeakTimeWindow(hour: number, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return (hour >= 10 && hour < 14) || (hour >= 18 && hour < 22);
  }
  return (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19);
}

function isLateNight(hour: number): boolean {
  return hour >= 1 && hour < 5;
}

function calculateSupplyDemandScore(activeRides: number, availableDrivers: number): number {
  if (availableDrivers === 0) {
    return 100;
  }
  
  const ratio = activeRides / availableDrivers;
  
  if (ratio <= 0.3) return 10;
  if (ratio <= 0.5) return 25;
  if (ratio <= 0.8) return 40;
  if (ratio <= 1.0) return 50;
  if (ratio <= 1.3) return 65;
  if (ratio <= 1.8) return 80;
  if (ratio <= 2.5) return 90;
  return 100;
}

function calculateSurgeScore(surgeMultiplier: number): number {
  if (surgeMultiplier <= 1.0) return 0;
  if (surgeMultiplier <= 1.2) return 30;
  if (surgeMultiplier <= 1.5) return 55;
  if (surgeMultiplier <= 2.0) return 75;
  if (surgeMultiplier <= 2.5) return 90;
  return 100;
}

function calculateEtaScore(etaDensity: number): number {
  if (etaDensity <= 2) return 0;
  if (etaDensity <= 4) return 20;
  if (etaDensity <= 6) return 40;
  if (etaDensity <= 10) return 60;
  if (etaDensity <= 15) return 80;
  return 100;
}

function calculateTimeScore(hour: number, dayOfWeek: number): number {
  if (isPeakTimeWindow(hour, dayOfWeek)) {
    return 80;
  }
  if (isLateNight(hour)) {
    return 15;
  }
  return 40;
}

export function detectDemand(
  input: DemandInput,
  thresholds: DemandThresholds = DEFAULT_DEMAND_THRESHOLDS
): DemandResult {
  const {
    activeRides,
    availableDrivers,
    surgeMultiplier,
    etaDensity,
    hour = new Date().getHours(),
    dayOfWeek = new Date().getDay(),
  } = input;

  const supplyDemandScore = calculateSupplyDemandScore(activeRides, availableDrivers);
  const surgeScore = calculateSurgeScore(surgeMultiplier);
  const etaScore = calculateEtaScore(etaDensity);
  const timeScore = calculateTimeScore(hour, dayOfWeek);

  const supplyDemandRatio = activeRides / Math.max(availableDrivers, 1);
  const surgeImpact = surgeScore / 100;
  const etaImpact = etaScore / 100;
  const timeImpact = timeScore / 100;

  const weightedScore = Math.round(
    supplyDemandScore * thresholds.supplyDemandWeight +
    surgeScore * thresholds.surgeWeight +
    etaScore * thresholds.etaWeight +
    timeScore * thresholds.timeWeight
  );

  const demandScore = Math.min(100, Math.max(0, weightedScore));

  let demandLevel: DemandLevel;
  if (demandScore <= thresholds.lowDemandMaxScore) {
    demandLevel = "low";
  } else if (demandScore >= thresholds.highDemandMinScore) {
    demandLevel = "high";
  } else {
    demandLevel = "normal";
  }

  return {
    demandLevel,
    demandScore,
    factors: {
      supplyDemandRatio: Math.round(supplyDemandRatio * 100) / 100,
      surgeImpact: Math.round(surgeImpact * 100) / 100,
      etaImpact: Math.round(etaImpact * 100) / 100,
      timeImpact: Math.round(timeImpact * 100) / 100,
    },
  };
}

export interface CommissionBands {
  lowDemand: { min: number; max: number };
  normalDemand: { min: number; max: number };
  highDemand: { min: number; max: number };
  hardCap: number;
  hardFloor: number;
}

export const DEFAULT_COMMISSION_BANDS: CommissionBands = {
  lowDemand: { min: 10, max: 12 },
  normalDemand: { min: 13, max: 15 },
  highDemand: { min: 15, max: 18 },
  hardCap: 18,
  hardFloor: 10,
};

export function calculateDynamicCommissionRate(
  demandResult: DemandResult,
  bands: CommissionBands = DEFAULT_COMMISSION_BANDS
): number {
  const { demandLevel, demandScore } = demandResult;

  let band: { min: number; max: number };
  let bandStartScore: number;
  let bandEndScore: number;

  switch (demandLevel) {
    case "low":
      band = bands.lowDemand;
      bandStartScore = 0;
      bandEndScore = 30;
      break;
    case "normal":
      band = bands.normalDemand;
      bandStartScore = 31;
      bandEndScore = 69;
      break;
    case "high":
      band = bands.highDemand;
      bandStartScore = 70;
      bandEndScore = 100;
      break;
    default:
      band = bands.normalDemand;
      bandStartScore = 31;
      bandEndScore = 69;
  }

  const bandRange = bandEndScore - bandStartScore;
  const scoreInBand = Math.max(0, demandScore - bandStartScore);
  const positionInBand = bandRange > 0 ? scoreInBand / bandRange : 0.5;
  
  const commissionRange = band.max - band.min;
  let rate = band.min + (positionInBand * commissionRange);

  rate = Math.max(bands.hardFloor, rate);
  rate = Math.min(bands.hardCap, rate);

  return Math.round(rate * 100) / 100;
}

export function getDemandLevelFromContext(
  surgeMultiplier: number,
  hour: number,
  dayOfWeek: number,
  activeRides: number = 50,
  availableDrivers: number = 50,
  etaDensity: number = 5
): DemandResult {
  return detectDemand({
    activeRides,
    availableDrivers,
    surgeMultiplier,
    etaDensity,
    hour,
    dayOfWeek,
  });
}
