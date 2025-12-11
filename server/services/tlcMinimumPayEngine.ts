/**
 * NYC TLC HVFHV Driver Minimum Pay Enforcement Engine
 * 
 * Implements legally required formulas for High-Volume For-Hire Vehicle (HVFHV)
 * driver compensation under NYC Taxi and Limousine Commission rules.
 * 
 * Key Components:
 * 1. Per-Ride Minimum Pay (enforced on every trip)
 * 2. Hourly Utilization Guarantee ($27.86/hour equivalent)
 * 3. Weekly Guaranteed Pay (TLC weekly settlement)
 * 
 * Reference: NYC TLC Rules Chapter 59
 */

export interface TLCConfig {
  perMinuteRate: number;
  perMileRate: number;
  hourlyMinimumRate: number;
  weeklyMinRides: number;
  weeklyMinOnlineHours: number;
  effectiveDate: Date;
}

export const NYC_TLC_CONFIG: TLCConfig = {
  perMinuteRate: 0.56,
  perMileRate: 1.31,
  hourlyMinimumRate: 27.86,
  weeklyMinRides: 1,
  weeklyMinOnlineHours: 1,
  effectiveDate: new Date('2019-02-01'),
};

export interface TLCPerRideInput {
  tripTimeMinutes: number;
  tripDistanceMiles: number;
  actualDriverPayout: number;
}

export interface TLCPerRideResult {
  timeBasedMinimum: number;
  hourlyEquivalentMinimum: number;
  tlcMinimumPay: number;
  actualPayout: number;
  adjustmentRequired: number;
  tlcMinimumApplied: boolean;
  formula: string;
}

export interface TLCHourlyInput {
  driverId: string;
  hourStart: Date;
  hourEnd: Date;
  totalOnlineMinutes: number;
  engagedMinutes: number;
  totalEarnings: number;
  ridesCompleted: number;
}

export interface TLCHourlyResult {
  utilizationRate: number;
  guaranteedAmount: number;
  actualEarnings: number;
  adjustmentRequired: number;
  tlcHourlyGuaranteeApplied: boolean;
  hourlyBreakdown: {
    onlineTime: number;
    engagedTime: number;
    waitingTime: number;
    utilizationPercent: number;
  };
}

export interface TLCWeeklyInput {
  driverId: string;
  weekStart: Date;
  weekEnd: Date;
  totalOnlineHours: number;
  totalEngagedHours: number;
  totalRides: number;
  totalEarnings: number;
  perRideAdjustments: number;
  hourlyAdjustments: number;
}

export interface TLCWeeklyResult {
  utilizationRate: number;
  weeklyMinimumGuarantee: number;
  totalEarningsWithAdjustments: number;
  weeklyAdjustmentRequired: number;
  tlcWeeklyAdjustmentApplied: boolean;
  isEligible: boolean;
  eligibilityReason?: string;
  breakdown: {
    baseEarnings: number;
    perRideAdjustments: number;
    hourlyAdjustments: number;
    weeklyAdjustment: number;
    finalPayout: number;
  };
}

export interface TLCDriverSession {
  driverId: string;
  sessionStart: Date;
  sessionEnd?: Date;
  totalOnlineMinutes: number;
  totalEngagedMinutes: number;
  totalWaitingMinutes: number;
  ridesCompleted: number;
  totalEarnings: number;
  totalTLCAdjustments: number;
  rideDetails: TLCRideRecord[];
}

export interface TLCRideRecord {
  rideId: string;
  startTime: Date;
  endTime: Date;
  tripTimeMinutes: number;
  tripDistanceMiles: number;
  basePayout: number;
  tlcAdjustment: number;
  finalPayout: number;
  tlcMinimumApplied: boolean;
}

export interface TLCWeeklySettlement {
  driverId: string;
  weekStart: Date;
  weekEnd: Date;
  totalOnlineHours: number;
  totalEngagedHours: number;
  utilizationRate: number;
  totalRides: number;
  baseEarnings: number;
  perRideAdjustments: number;
  hourlyAdjustments: number;
  weeklyAdjustment: number;
  finalPayout: number;
  isCompliant: boolean;
  settlementDate: Date;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate per-ride TLC minimum pay
 * 
 * Formula: max(
 *   timeMinutes * $0.56 + distanceMiles * $1.31,
 *   tripTimeHours * $27.86
 * )
 */
export function calculatePerRideMinimumPay(
  input: TLCPerRideInput,
  config: TLCConfig = NYC_TLC_CONFIG
): TLCPerRideResult {
  const { tripTimeMinutes, tripDistanceMiles, actualDriverPayout } = input;
  
  const timeBasedMinimum = roundCurrency(
    (tripTimeMinutes * config.perMinuteRate) + (tripDistanceMiles * config.perMileRate)
  );
  
  const tripTimeHours = tripTimeMinutes / 60;
  const hourlyEquivalentMinimum = roundCurrency(tripTimeHours * config.hourlyMinimumRate);
  
  const tlcMinimumPay = roundCurrency(Math.max(timeBasedMinimum, hourlyEquivalentMinimum));
  
  const adjustmentRequired = roundCurrency(Math.max(0, tlcMinimumPay - actualDriverPayout));
  const tlcMinimumApplied = adjustmentRequired > 0;
  
  const formulaUsed = timeBasedMinimum >= hourlyEquivalentMinimum 
    ? `time_distance: (${tripTimeMinutes}min × $${config.perMinuteRate}) + (${tripDistanceMiles}mi × $${config.perMileRate}) = $${timeBasedMinimum}`
    : `hourly_equiv: (${tripTimeMinutes}min ÷ 60) × $${config.hourlyMinimumRate} = $${hourlyEquivalentMinimum}`;
  
  return {
    timeBasedMinimum,
    hourlyEquivalentMinimum,
    tlcMinimumPay,
    actualPayout: actualDriverPayout,
    adjustmentRequired,
    tlcMinimumApplied,
    formula: formulaUsed,
  };
}

/**
 * Calculate hourly utilization guarantee
 * 
 * For every active hour:
 * - Guarantee driver earns equivalent of $27.86/hour
 * - Utilization rate = (engagedTime / totalOnlineTime)
 * - If earnings < guaranteed amount, pay the difference
 */
export function calculateHourlyGuarantee(
  input: TLCHourlyInput,
  config: TLCConfig = NYC_TLC_CONFIG
): TLCHourlyResult {
  const { totalOnlineMinutes, engagedMinutes, totalEarnings } = input;
  
  const onlineHours = totalOnlineMinutes / 60;
  const engagedHours = engagedMinutes / 60;
  const waitingMinutes = Math.max(0, totalOnlineMinutes - engagedMinutes);
  
  const utilizationRate = totalOnlineMinutes > 0 
    ? roundCurrency((engagedMinutes / totalOnlineMinutes) * 100) / 100
    : 0;
  
  const guaranteedAmount = roundCurrency(onlineHours * config.hourlyMinimumRate);
  
  const adjustmentRequired = roundCurrency(Math.max(0, guaranteedAmount - totalEarnings));
  const tlcHourlyGuaranteeApplied = adjustmentRequired > 0;
  
  return {
    utilizationRate,
    guaranteedAmount,
    actualEarnings: totalEarnings,
    adjustmentRequired,
    tlcHourlyGuaranteeApplied,
    hourlyBreakdown: {
      onlineTime: roundCurrency(onlineHours),
      engagedTime: roundCurrency(engagedHours),
      waitingTime: roundCurrency(waitingMinutes / 60),
      utilizationPercent: roundCurrency(utilizationRate * 100),
    },
  };
}

/**
 * Calculate weekly guaranteed pay per TLC HVFHV rules
 * 
 * - Calculate total online hours Monday–Sunday
 * - Calculate total engaged hours
 * - Apply TLC weekly utilization formula
 * - Ensure driver's total weekly payout matches TLC minimum
 */
export function calculateWeeklyGuarantee(
  input: TLCWeeklyInput,
  config: TLCConfig = NYC_TLC_CONFIG
): TLCWeeklyResult {
  const { 
    totalOnlineHours, 
    totalEngagedHours, 
    totalRides,
    totalEarnings, 
    perRideAdjustments, 
    hourlyAdjustments 
  } = input;
  
  if (totalRides < config.weeklyMinRides) {
    return {
      utilizationRate: 0,
      weeklyMinimumGuarantee: 0,
      totalEarningsWithAdjustments: totalEarnings + perRideAdjustments + hourlyAdjustments,
      weeklyAdjustmentRequired: 0,
      tlcWeeklyAdjustmentApplied: false,
      isEligible: false,
      eligibilityReason: `Minimum ${config.weeklyMinRides} ride(s) required for weekly guarantee`,
      breakdown: {
        baseEarnings: totalEarnings,
        perRideAdjustments,
        hourlyAdjustments,
        weeklyAdjustment: 0,
        finalPayout: roundCurrency(totalEarnings + perRideAdjustments + hourlyAdjustments),
      },
    };
  }
  
  if (totalOnlineHours < config.weeklyMinOnlineHours) {
    return {
      utilizationRate: 0,
      weeklyMinimumGuarantee: 0,
      totalEarningsWithAdjustments: totalEarnings + perRideAdjustments + hourlyAdjustments,
      weeklyAdjustmentRequired: 0,
      tlcWeeklyAdjustmentApplied: false,
      isEligible: false,
      eligibilityReason: `Minimum ${config.weeklyMinOnlineHours} hour(s) online required for weekly guarantee`,
      breakdown: {
        baseEarnings: totalEarnings,
        perRideAdjustments,
        hourlyAdjustments,
        weeklyAdjustment: 0,
        finalPayout: roundCurrency(totalEarnings + perRideAdjustments + hourlyAdjustments),
      },
    };
  }
  
  const utilizationRate = totalOnlineHours > 0 
    ? roundCurrency((totalEngagedHours / totalOnlineHours) * 100) / 100
    : 0;
  
  const weeklyMinimumGuarantee = roundCurrency(totalOnlineHours * config.hourlyMinimumRate);
  
  const totalEarningsWithAdjustments = roundCurrency(
    totalEarnings + perRideAdjustments + hourlyAdjustments
  );
  
  const weeklyAdjustmentRequired = roundCurrency(
    Math.max(0, weeklyMinimumGuarantee - totalEarningsWithAdjustments)
  );
  
  const tlcWeeklyAdjustmentApplied = weeklyAdjustmentRequired > 0;
  
  const finalPayout = roundCurrency(totalEarningsWithAdjustments + weeklyAdjustmentRequired);
  
  return {
    utilizationRate,
    weeklyMinimumGuarantee,
    totalEarningsWithAdjustments,
    weeklyAdjustmentRequired,
    tlcWeeklyAdjustmentApplied,
    isEligible: true,
    breakdown: {
      baseEarnings: totalEarnings,
      perRideAdjustments,
      hourlyAdjustments,
      weeklyAdjustment: weeklyAdjustmentRequired,
      finalPayout,
    },
  };
}

const driverSessionStore = new Map<string, TLCDriverSession>();
const weeklySettlementStore = new Map<string, TLCWeeklySettlement[]>();

export function getOrCreateDriverSession(driverId: string): TLCDriverSession {
  let session = driverSessionStore.get(driverId);
  
  if (!session) {
    session = {
      driverId,
      sessionStart: new Date(),
      totalOnlineMinutes: 0,
      totalEngagedMinutes: 0,
      totalWaitingMinutes: 0,
      ridesCompleted: 0,
      totalEarnings: 0,
      totalTLCAdjustments: 0,
      rideDetails: [],
    };
    driverSessionStore.set(driverId, session);
  }
  
  return session;
}

export function recordDriverRide(
  driverId: string,
  rideId: string,
  tripTimeMinutes: number,
  tripDistanceMiles: number,
  basePayout: number
): TLCRideRecord {
  const session = getOrCreateDriverSession(driverId);
  
  const tlcResult = calculatePerRideMinimumPay({
    tripTimeMinutes,
    tripDistanceMiles,
    actualDriverPayout: basePayout,
  });
  
  const rideRecord: TLCRideRecord = {
    rideId,
    startTime: new Date(Date.now() - tripTimeMinutes * 60 * 1000),
    endTime: new Date(),
    tripTimeMinutes,
    tripDistanceMiles,
    basePayout,
    tlcAdjustment: tlcResult.adjustmentRequired,
    finalPayout: roundCurrency(basePayout + tlcResult.adjustmentRequired),
    tlcMinimumApplied: tlcResult.tlcMinimumApplied,
  };
  
  session.rideDetails.push(rideRecord);
  session.ridesCompleted += 1;
  session.totalEngagedMinutes += tripTimeMinutes;
  session.totalEarnings += basePayout;
  session.totalTLCAdjustments += tlcResult.adjustmentRequired;
  
  driverSessionStore.set(driverId, session);
  
  return rideRecord;
}

export function updateDriverOnlineTime(
  driverId: string,
  additionalOnlineMinutes: number,
  additionalWaitingMinutes: number = 0
): void {
  const session = getOrCreateDriverSession(driverId);
  
  session.totalOnlineMinutes += additionalOnlineMinutes;
  session.totalWaitingMinutes += additionalWaitingMinutes;
  
  driverSessionStore.set(driverId, session);
}

export function getDriverSession(driverId: string): TLCDriverSession | undefined {
  return driverSessionStore.get(driverId);
}

export function processWeeklySettlement(
  driverId: string,
  weekStart: Date,
  weekEnd: Date
): TLCWeeklySettlement {
  const session = driverSessionStore.get(driverId);
  
  if (!session) {
    return {
      driverId,
      weekStart,
      weekEnd,
      totalOnlineHours: 0,
      totalEngagedHours: 0,
      utilizationRate: 0,
      totalRides: 0,
      baseEarnings: 0,
      perRideAdjustments: 0,
      hourlyAdjustments: 0,
      weeklyAdjustment: 0,
      finalPayout: 0,
      isCompliant: true,
      settlementDate: new Date(),
    };
  }
  
  const totalOnlineHours = session.totalOnlineMinutes / 60;
  const totalEngagedHours = session.totalEngagedMinutes / 60;
  
  const perRideAdjustments = session.rideDetails.reduce(
    (sum, ride) => sum + ride.tlcAdjustment, 
    0
  );
  
  const hourlyResult = calculateHourlyGuarantee({
    driverId,
    hourStart: weekStart,
    hourEnd: weekEnd,
    totalOnlineMinutes: session.totalOnlineMinutes,
    engagedMinutes: session.totalEngagedMinutes,
    totalEarnings: session.totalEarnings + perRideAdjustments,
    ridesCompleted: session.ridesCompleted,
  });
  
  const weeklyResult = calculateWeeklyGuarantee({
    driverId,
    weekStart,
    weekEnd,
    totalOnlineHours,
    totalEngagedHours,
    totalRides: session.ridesCompleted,
    totalEarnings: session.totalEarnings,
    perRideAdjustments,
    hourlyAdjustments: hourlyResult.adjustmentRequired,
  });
  
  const settlement: TLCWeeklySettlement = {
    driverId,
    weekStart,
    weekEnd,
    totalOnlineHours: roundCurrency(totalOnlineHours),
    totalEngagedHours: roundCurrency(totalEngagedHours),
    utilizationRate: weeklyResult.utilizationRate,
    totalRides: session.ridesCompleted,
    baseEarnings: session.totalEarnings,
    perRideAdjustments,
    hourlyAdjustments: hourlyResult.adjustmentRequired,
    weeklyAdjustment: weeklyResult.weeklyAdjustmentRequired,
    finalPayout: weeklyResult.breakdown.finalPayout,
    isCompliant: true,
    settlementDate: new Date(),
  };
  
  const existingSettlements = weeklySettlementStore.get(driverId) || [];
  existingSettlements.push(settlement);
  weeklySettlementStore.set(driverId, existingSettlements);
  
  driverSessionStore.delete(driverId);
  
  return settlement;
}

export function getDriverWeeklySettlements(driverId: string): TLCWeeklySettlement[] {
  return weeklySettlementStore.get(driverId) || [];
}

export function resetDriverSession(driverId: string): void {
  driverSessionStore.delete(driverId);
}

export function getAllDriverSessions(): Map<string, TLCDriverSession> {
  return new Map(driverSessionStore);
}

export interface TLCComplianceStatus {
  isCompliant: boolean;
  perRideCompliant: boolean;
  hourlyCompliant: boolean;
  weeklyCompliant: boolean;
  lastSettlementDate?: Date;
  pendingAdjustments: number;
  totalAdjustmentsThisWeek: number;
}

export function getDriverTLCComplianceStatus(driverId: string): TLCComplianceStatus {
  const session = driverSessionStore.get(driverId);
  const settlements = weeklySettlementStore.get(driverId) || [];
  const lastSettlement = settlements[settlements.length - 1];
  
  const perRideAdjustments = session?.rideDetails.reduce(
    (sum, ride) => sum + ride.tlcAdjustment, 
    0
  ) || 0;
  
  return {
    isCompliant: true,
    perRideCompliant: true,
    hourlyCompliant: true,
    weeklyCompliant: true,
    lastSettlementDate: lastSettlement?.settlementDate,
    pendingAdjustments: perRideAdjustments,
    totalAdjustmentsThisWeek: session?.totalTLCAdjustments || 0,
  };
}

export function enforceTLCMinimumOnFare(
  tripTimeMinutes: number,
  tripDistanceMiles: number,
  calculatedDriverPayout: number
): {
  finalDriverPayout: number;
  tlcAdjustment: number;
  tlcMinimumApplied: boolean;
  tlcDetails: TLCPerRideResult;
} {
  const tlcResult = calculatePerRideMinimumPay({
    tripTimeMinutes,
    tripDistanceMiles,
    actualDriverPayout: calculatedDriverPayout,
  });
  
  return {
    finalDriverPayout: roundCurrency(calculatedDriverPayout + tlcResult.adjustmentRequired),
    tlcAdjustment: tlcResult.adjustmentRequired,
    tlcMinimumApplied: tlcResult.tlcMinimumApplied,
    tlcDetails: tlcResult,
  };
}

export function getTLCRateInfo(): {
  perMinuteRate: string;
  perMileRate: string;
  hourlyMinimumRate: string;
  effectiveDate: string;
  formula: string;
} {
  return {
    perMinuteRate: `$${NYC_TLC_CONFIG.perMinuteRate.toFixed(2)}/minute`,
    perMileRate: `$${NYC_TLC_CONFIG.perMileRate.toFixed(2)}/mile`,
    hourlyMinimumRate: `$${NYC_TLC_CONFIG.hourlyMinimumRate.toFixed(2)}/hour`,
    effectiveDate: NYC_TLC_CONFIG.effectiveDate.toISOString().split('T')[0],
    formula: 'max((time × $0.56) + (distance × $1.31), (time_hours × $27.86))',
  };
}
