/**
 * NYC TLC HVFHV Compliance Report Generator
 * 
 * Generates TLC-compliant monthly reports for High-Volume For-Hire Vehicle operations:
 * - Trip Record Report (TRR)
 * - Driver Pay Report (DPR)
 * - HVFHV Summary Report (HSR)
 * - Out-of-Town Trips Report
 * - Accessibility Report (AVF-related)
 * - Airport Activity Report
 * 
 * Reference: NYC TLC HVFHV Reporting Requirements
 */

import { PrismaClient } from "@prisma/client";
import { NYC_TLC_CONFIG, calculatePerRideMinimumPay } from "./tlcMinimumPayEngine";

const prisma = new PrismaClient();

// ============================================
// Type Definitions
// ============================================

export type TripCategory = 
  | "NYC_TO_NYC"           // Intra-NYC trip
  | "NYC_TO_OOS"           // NYC to Out-of-State
  | "OOS_TO_NYC"           // Out-of-State to NYC
  | "INTER_BOROUGH"        // Between NYC boroughs
  | "INTRA_BOROUGH"        // Within same borough
  | "AIRPORT_PICKUP"       // Pickup at airport
  | "AIRPORT_DROPOFF"      // Dropoff at airport
  | "MANHATTAN_CONGESTION" // Manhattan congestion zone
  | "LONG_TRIP"            // Long trip (>20 miles)
  | "UNKNOWN";

export type BoroughCode = 
  | "MANHATTAN"
  | "BROOKLYN"
  | "QUEENS"
  | "BRONX"
  | "STATEN_ISLAND"
  | "OUT_OF_NYC";

export type AirportCode = "JFK" | "LGA" | "EWR" | "WCY";

export interface TripRecordReport {
  tripId: string;
  driverId: string;
  vehicleId: string;
  pickupTime: Date;
  dropoffTime: Date;
  pickupLocation: {
    lat: number;
    lng: number;
    borough: BoroughCode;
    address?: string;
  };
  dropoffLocation: {
    lat: number;
    lng: number;
    borough: BoroughCode;
    address?: string;
  };
  tripDistanceMiles: number;
  tripDurationMinutes: number;
  fareSubtotal: number;
  tolls: number;
  congestionFee: number;
  airportFee: number;
  airportCode?: AirportCode;
  avfFee: number;
  bcfFee: number;
  hvrfFee: number;
  stateSurcharge: number;
  longTripSurcharge: number;
  outOfTownReturnFee: number;
  promoUsed: boolean;
  promoCode?: string;
  discountAmount: number;
  finalFare: number;
  driverPayout: number;
  commissionAmount: number;
  tripCategory: TripCategory;
  tlcMinimumApplied: boolean;
  tlcAdjustment: number;
  isAccessibleVehicle: boolean;
  isWheelchairTrip: boolean;
  reportGeneratedAt: Date;
}

export interface DriverPayReport {
  driverId: string;
  driverName?: string;
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  totalTrips: number;
  totalOnlineHours: number;
  totalEngagedHours: number;
  utilizationRate: number;
  baseEarnings: number;
  tlcTimeEarnings: number;
  tlcDistanceEarnings: number;
  tlcMinimumPayAdjustments: number;
  perRideAdjustmentsTotal: number;
  hourlyAdjustmentsTotal: number;
  weeklyAdjustmentTotal: number;
  incentivesTotal: number;
  incentiveBreakdown: {
    questBonus: number;
    boostZoneBonus: number;
    airportPickupBonus: number;
    weatherBonus: number;
    lateNightBonus: number;
  };
  tollsCollected: number;
  feesCollectedForTLC: number;
  feesBreakdown: {
    avfTotal: number;
    bcfTotal: number;
    hvrfTotal: number;
    stateSurchargeTotal: number;
    congestionTotal: number;
    airportTotal: number;
    longTripTotal: number;
    outOfTownTotal: number;
  };
  grossEarnings: number;
  netPayout: number;
  hourlyEarningsAverage: number;
  tlcComplianceStatus: "COMPLIANT" | "PENDING_ADJUSTMENT" | "ADJUSTED";
  reportGeneratedAt: Date;
}

export interface HVFHVSummaryReport {
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  totalTrips: number;
  tripsByBoroughPair: {
    pickupBorough: BoroughCode;
    dropoffBorough: BoroughCode;
    tripCount: number;
    totalFare: number;
    avgFare: number;
  }[];
  accessibilityFundTotals: {
    avfTripsCount: number;
    avfTotalCollected: number;
    wheelchairTripsCount: number;
    accessibleVehicleTripsCount: number;
  };
  airportPickupCounts: {
    airportCode: AirportCode;
    pickupCount: number;
    dropoffCount: number;
    totalAirportFees: number;
  }[];
  manhattanCongestionFees: {
    tripsInZone: number;
    totalCongestionFees: number;
    avgCongestionFee: number;
  };
  outOfTownTrips: {
    nycToOosCount: number;
    oosToNycCount: number;
    totalReturnFees: number;
  };
  longTripSurcharges: {
    tripsOver20Miles: number;
    totalLongTripSurcharges: number;
    avgLongTripSurcharge: number;
  };
  driverWorkingHours: {
    totalOnlineHours: number;
    totalEngagedHours: number;
    avgUtilizationRate: number;
    driversActive: number;
  };
  financialSummary: {
    totalFaresCollected: number;
    totalDriverPayouts: number;
    totalCommissions: number;
    totalTLCFees: number;
    totalTolls: number;
  };
  reportGeneratedAt: Date;
}

export interface OutOfTownReport {
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  trips: {
    tripId: string;
    driverId: string;
    direction: "NYC_TO_OOS" | "OOS_TO_NYC";
    pickupBorough: BoroughCode;
    dropoffLocation: string;
    distanceMiles: number;
    returnFeeMiles?: number;
    returnFeeCharged: number;
    tripFare: number;
  }[];
  summary: {
    totalOutboundTrips: number;
    totalInboundTrips: number;
    totalReturnFeesCollected: number;
    avgReturnFee: number;
  };
  reportGeneratedAt: Date;
}

export interface AccessibilityReport {
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  avfCollection: {
    totalTrips: number;
    totalAVFCollected: number;
    avgAVFPerTrip: number;
  };
  accessibleVehicleTrips: {
    totalTrips: number;
    wheelchairTrips: number;
    avgTripDistance: number;
    avgTripDuration: number;
  };
  boroughBreakdown: {
    borough: BoroughCode;
    accessibleTrips: number;
    avfCollected: number;
  }[];
  complianceMetrics: {
    percentAccessibleTrips: number;
    targetPercentage: number;
    isCompliant: boolean;
  };
  reportGeneratedAt: Date;
}

export interface AirportActivityReport {
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  airports: {
    code: AirportCode;
    name: string;
    pickups: {
      count: number;
      totalFare: number;
      avgFare: number;
      avgWaitTime?: number;
    };
    dropoffs: {
      count: number;
      totalFare: number;
      avgFare: number;
    };
    airportFeesCollected: number;
    hourlyDistribution: {
      hour: number;
      pickupCount: number;
      dropoffCount: number;
    }[];
  }[];
  summary: {
    totalAirportTrips: number;
    totalAirportFees: number;
    busiestAirport: AirportCode;
    peakHour: number;
  };
  reportGeneratedAt: Date;
}

export interface TLCReportFilters {
  startDate: Date;
  endDate: Date;
  driverId?: string;
  borough?: BoroughCode;
  tripType?: TripCategory;
  airportCode?: AirportCode;
  minFare?: number;
  maxFare?: number;
}

export interface TLCReportExport {
  format: "json" | "csv";
  reportType: "TRR" | "DPR" | "HSR" | "OUT_OF_TOWN" | "ACCESSIBILITY" | "AIRPORT";
  data: unknown;
  filename: string;
  generatedAt: Date;
  recordCount: number;
}

// ============================================
// Helper Functions
// ============================================

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function normalizeBoroughCode(borough: string | null | undefined): BoroughCode {
  if (!borough) return "OUT_OF_NYC";
  
  const normalized = borough.toUpperCase().replace(/\s+/g, "_");
  
  const mappings: Record<string, BoroughCode> = {
    "MANHATTAN": "MANHATTAN",
    "NEW_YORK": "MANHATTAN",
    "NEW_YORK_COUNTY": "MANHATTAN",
    "BROOKLYN": "BROOKLYN",
    "KINGS": "BROOKLYN",
    "KINGS_COUNTY": "BROOKLYN",
    "QUEENS": "QUEENS",
    "QUEENS_COUNTY": "QUEENS",
    "BRONX": "BRONX",
    "THE_BRONX": "BRONX",
    "BRONX_COUNTY": "BRONX",
    "STATEN_ISLAND": "STATEN_ISLAND",
    "RICHMOND": "STATEN_ISLAND",
    "RICHMOND_COUNTY": "STATEN_ISLAND",
  };
  
  return mappings[normalized] || "OUT_OF_NYC";
}

function determineAirportCode(lat: number, lng: number): AirportCode | undefined {
  const JFK_BOUNDS = { minLat: 40.625, maxLat: 40.66, minLng: -73.82, maxLng: -73.75 };
  const LGA_BOUNDS = { minLat: 40.765, maxLat: 40.785, minLng: -73.895, maxLng: -73.855 };
  const EWR_BOUNDS = { minLat: 40.67, maxLat: 40.71, minLng: -74.195, maxLng: -74.155 };
  const WCY_BOUNDS = { minLat: 41.065, maxLat: 41.08, minLng: -73.715, maxLng: -73.695 };
  
  if (lat >= JFK_BOUNDS.minLat && lat <= JFK_BOUNDS.maxLat && 
      lng >= JFK_BOUNDS.minLng && lng <= JFK_BOUNDS.maxLng) {
    return "JFK";
  }
  if (lat >= LGA_BOUNDS.minLat && lat <= LGA_BOUNDS.maxLat && 
      lng >= LGA_BOUNDS.minLng && lng <= LGA_BOUNDS.maxLng) {
    return "LGA";
  }
  if (lat >= EWR_BOUNDS.minLat && lat <= EWR_BOUNDS.maxLat && 
      lng >= EWR_BOUNDS.minLng && lng <= EWR_BOUNDS.maxLng) {
    return "EWR";
  }
  if (lat >= WCY_BOUNDS.minLat && lat <= WCY_BOUNDS.maxLat && 
      lng >= WCY_BOUNDS.minLng && lng <= WCY_BOUNDS.maxLng) {
    return "WCY";
  }
  
  return undefined;
}

function determineTripCategory(
  pickupBorough: BoroughCode,
  dropoffBorough: BoroughCode,
  distanceMiles: number,
  pickupAirport?: AirportCode,
  dropoffAirport?: AirportCode,
  isInCongestionZone?: boolean
): TripCategory {
  if (pickupAirport) return "AIRPORT_PICKUP";
  if (dropoffAirport) return "AIRPORT_DROPOFF";
  if (isInCongestionZone && pickupBorough === "MANHATTAN") return "MANHATTAN_CONGESTION";
  if (distanceMiles > 20) return "LONG_TRIP";
  
  if (pickupBorough === "OUT_OF_NYC" && dropoffBorough !== "OUT_OF_NYC") {
    return "OOS_TO_NYC";
  }
  if (pickupBorough !== "OUT_OF_NYC" && dropoffBorough === "OUT_OF_NYC") {
    return "NYC_TO_OOS";
  }
  
  if (pickupBorough === dropoffBorough && pickupBorough !== "OUT_OF_NYC") {
    return "INTRA_BOROUGH";
  }
  
  if (pickupBorough !== "OUT_OF_NYC" && dropoffBorough !== "OUT_OF_NYC") {
    return "INTER_BOROUGH";
  }
  
  return "NYC_TO_NYC";
}

function getAirportName(code: AirportCode): string {
  const names: Record<AirportCode, string> = {
    JFK: "John F. Kennedy International Airport",
    LGA: "LaGuardia Airport",
    EWR: "Newark Liberty International Airport",
    WCY: "Westchester County Airport",
  };
  return names[code];
}

// ============================================
// Mock Data Generator (for demo/testing)
// ============================================

function generateMockTripData(filters: TLCReportFilters): TripRecordReport[] {
  const trips: TripRecordReport[] = [];
  const startTime = filters.startDate.getTime();
  const endTime = filters.endDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysInRange = Math.ceil((endTime - startTime) / dayMs);
  
  const boroughs: BoroughCode[] = ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN_ISLAND"];
  const airports: AirportCode[] = ["JFK", "LGA", "EWR"];
  
  const avgTripsPerDay = 150;
  const totalTrips = avgTripsPerDay * Math.max(1, daysInRange);
  
  for (let i = 0; i < totalTrips; i++) {
    const pickupBorough = boroughs[Math.floor(Math.random() * boroughs.length)];
    const dropoffBorough = boroughs[Math.floor(Math.random() * boroughs.length)];
    const isAirportPickup = Math.random() < 0.08;
    const isAirportDropoff = !isAirportPickup && Math.random() < 0.06;
    
    const tripDuration = 10 + Math.floor(Math.random() * 45);
    const tripDistance = roundCurrency(2 + Math.random() * 18);
    const isLongTrip = tripDistance > 20;
    const isOutOfTown = Math.random() < 0.05;
    const isAccessible = Math.random() < 0.02;
    const isWheelchair = isAccessible && Math.random() < 0.3;
    
    const baseFare = roundCurrency(2.50 + tripDistance * 2.20 + tripDuration * 0.40);
    const surgeMult = Math.random() < 0.2 ? 1.2 + Math.random() * 0.8 : 1.0;
    const fareWithSurge = roundCurrency(baseFare * surgeMult);
    
    const congestionFee = pickupBorough === "MANHATTAN" ? 2.75 : 0;
    const airportCode = isAirportPickup ? airports[Math.floor(Math.random() * airports.length)] : undefined;
    const airportFee = airportCode ? 2.50 : 0;
    const avfFee = roundCurrency(tripDistance * 0.025);
    const bcfFee = roundCurrency(fareWithSurge * 0.025);
    const hvrfFee = 0.05;
    const stateSurcharge = 2.50;
    const longTripSurcharge = isLongTrip ? 5.00 : 0;
    const outOfTownFee = isOutOfTown ? roundCurrency(tripDistance * 0.5) : 0;
    const tolls = Math.random() < 0.15 ? roundCurrency(6 + Math.random() * 10) : 0;
    
    const promoUsed = Math.random() < 0.1;
    const discountAmount = promoUsed ? roundCurrency(fareWithSurge * 0.15) : 0;
    
    const totalFees = congestionFee + airportFee + avfFee + bcfFee + hvrfFee + 
                      stateSurcharge + longTripSurcharge + outOfTownFee + tolls;
    const finalFare = roundCurrency(fareWithSurge + totalFees - discountAmount);
    
    const commissionRate = 0.25;
    const commissionAmount = roundCurrency((fareWithSurge - discountAmount) * commissionRate);
    const driverPayout = roundCurrency(fareWithSurge - commissionAmount + tolls);
    
    const tlcResult = calculatePerRideMinimumPay({
      tripTimeMinutes: tripDuration,
      tripDistanceMiles: tripDistance,
      actualDriverPayout: driverPayout,
    });
    
    const pickupTime = new Date(startTime + Math.random() * (endTime - startTime));
    const dropoffTime = new Date(pickupTime.getTime() + tripDuration * 60 * 1000);
    
    const category = determineTripCategory(
      pickupBorough,
      dropoffBorough,
      tripDistance,
      airportCode,
      undefined,
      congestionFee > 0
    );
    
    if (filters.borough && pickupBorough !== filters.borough && dropoffBorough !== filters.borough) {
      continue;
    }
    if (filters.tripType && category !== filters.tripType) {
      continue;
    }
    if (filters.driverId && `driver-${i % 50}` !== filters.driverId) {
      continue;
    }
    
    trips.push({
      tripId: `TRP-${Date.now()}-${i.toString().padStart(6, '0')}`,
      driverId: `driver-${i % 50}`,
      vehicleId: `VEH-${(i % 50).toString().padStart(4, '0')}`,
      pickupTime,
      dropoffTime,
      pickupLocation: {
        lat: 40.7 + (Math.random() - 0.5) * 0.2,
        lng: -74.0 + (Math.random() - 0.5) * 0.2,
        borough: pickupBorough,
      },
      dropoffLocation: {
        lat: 40.7 + (Math.random() - 0.5) * 0.2,
        lng: -74.0 + (Math.random() - 0.5) * 0.2,
        borough: dropoffBorough,
      },
      tripDistanceMiles: tripDistance,
      tripDurationMinutes: tripDuration,
      fareSubtotal: fareWithSurge,
      tolls,
      congestionFee,
      airportFee,
      airportCode,
      avfFee,
      bcfFee,
      hvrfFee,
      stateSurcharge,
      longTripSurcharge,
      outOfTownReturnFee: outOfTownFee,
      promoUsed,
      promoCode: promoUsed ? `PROMO${Math.floor(Math.random() * 1000)}` : undefined,
      discountAmount,
      finalFare,
      driverPayout: roundCurrency(driverPayout + tlcResult.adjustmentRequired),
      commissionAmount,
      tripCategory: category,
      tlcMinimumApplied: tlcResult.tlcMinimumApplied,
      tlcAdjustment: tlcResult.adjustmentRequired,
      isAccessibleVehicle: isAccessible,
      isWheelchairTrip: isWheelchair,
      reportGeneratedAt: new Date(),
    });
  }
  
  return trips;
}

// ============================================
// Report Generator Functions
// ============================================

export async function generateTripRecordReport(
  filters: TLCReportFilters
): Promise<TripRecordReport[]> {
  const trips = generateMockTripData(filters);
  
  return trips.map(trip => ({
    ...trip,
    reportGeneratedAt: new Date(),
  }));
}

export async function generateDriverPayReport(
  filters: TLCReportFilters
): Promise<DriverPayReport[]> {
  const trips = await generateTripRecordReport(filters);
  
  const driverMap = new Map<string, {
    trips: TripRecordReport[];
    onlineHours: number;
    engagedHours: number;
  }>();
  
  for (const trip of trips) {
    const existing = driverMap.get(trip.driverId) || {
      trips: [],
      onlineHours: 0,
      engagedHours: 0,
    };
    existing.trips.push(trip);
    existing.engagedHours += trip.tripDurationMinutes / 60;
    existing.onlineHours += (trip.tripDurationMinutes + 5) / 60;
    driverMap.set(trip.driverId, existing);
  }
  
  const reports: DriverPayReport[] = [];
  
  const driverEntries = Array.from(driverMap.entries());
  for (let i = 0; i < driverEntries.length; i++) {
    const [driverId, data] = driverEntries[i];
    const baseEarnings = data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.fareSubtotal - t.commissionAmount, 0);
    const tlcAdjustments = data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.tlcAdjustment, 0);
    const incentives = roundCurrency(Math.random() * 100);
    const tollsCollected = data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.tolls, 0);
    
    const feesBreakdown = {
      avfTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.avfFee, 0)),
      bcfTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.bcfFee, 0)),
      hvrfTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.hvrfFee, 0)),
      stateSurchargeTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.stateSurcharge, 0)),
      congestionTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.congestionFee, 0)),
      airportTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.airportFee, 0)),
      longTripTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.longTripSurcharge, 0)),
      outOfTownTotal: roundCurrency(data.trips.reduce((sum: number, t: TripRecordReport) => sum + t.outOfTownReturnFee, 0)),
    };
    
    const feesCollectedForTLC = Object.values(feesBreakdown).reduce((a, b) => a + b, 0);
    const netPayout = roundCurrency(baseEarnings + tlcAdjustments + incentives + tollsCollected);
    const hourlyAvg = data.engagedHours > 0 ? roundCurrency(netPayout / data.engagedHours) : 0;
    
    const tlcTimeEarnings = data.trips.reduce((sum: number, t: TripRecordReport) => 
      sum + t.tripDurationMinutes * NYC_TLC_CONFIG.perMinuteRate, 0);
    const tlcDistanceEarnings = data.trips.reduce((sum: number, t: TripRecordReport) => 
      sum + t.tripDistanceMiles * NYC_TLC_CONFIG.perMileRate, 0);
    
    reports.push({
      driverId,
      reportPeriodStart: filters.startDate,
      reportPeriodEnd: filters.endDate,
      totalTrips: data.trips.length,
      totalOnlineHours: roundCurrency(data.onlineHours),
      totalEngagedHours: roundCurrency(data.engagedHours),
      utilizationRate: data.onlineHours > 0 
        ? roundCurrency(data.engagedHours / data.onlineHours) 
        : 0,
      baseEarnings: roundCurrency(baseEarnings),
      tlcTimeEarnings: roundCurrency(tlcTimeEarnings),
      tlcDistanceEarnings: roundCurrency(tlcDistanceEarnings),
      tlcMinimumPayAdjustments: roundCurrency(tlcAdjustments),
      perRideAdjustmentsTotal: roundCurrency(tlcAdjustments),
      hourlyAdjustmentsTotal: 0,
      weeklyAdjustmentTotal: 0,
      incentivesTotal: incentives,
      incentiveBreakdown: {
        questBonus: roundCurrency(incentives * 0.4),
        boostZoneBonus: roundCurrency(incentives * 0.25),
        airportPickupBonus: roundCurrency(incentives * 0.15),
        weatherBonus: roundCurrency(incentives * 0.1),
        lateNightBonus: roundCurrency(incentives * 0.1),
      },
      tollsCollected: roundCurrency(tollsCollected),
      feesCollectedForTLC: roundCurrency(feesCollectedForTLC),
      feesBreakdown,
      grossEarnings: roundCurrency(baseEarnings + incentives + tollsCollected),
      netPayout,
      hourlyEarningsAverage: hourlyAvg,
      tlcComplianceStatus: tlcAdjustments > 0 ? "ADJUSTED" : "COMPLIANT",
      reportGeneratedAt: new Date(),
    });
  }
  
  if (filters.driverId) {
    return reports.filter(r => r.driverId === filters.driverId);
  }
  
  return reports;
}

export async function generateHVFHVSummaryReport(
  filters: TLCReportFilters
): Promise<HVFHVSummaryReport> {
  const trips = await generateTripRecordReport(filters);
  const driverReports = await generateDriverPayReport(filters);
  
  const boroughPairMap = new Map<string, {
    pickupBorough: BoroughCode;
    dropoffBorough: BoroughCode;
    tripCount: number;
    totalFare: number;
  }>();
  
  for (const trip of trips) {
    const key = `${trip.pickupLocation.borough}-${trip.dropoffLocation.borough}`;
    const existing = boroughPairMap.get(key) || {
      pickupBorough: trip.pickupLocation.borough,
      dropoffBorough: trip.dropoffLocation.borough,
      tripCount: 0,
      totalFare: 0,
    };
    existing.tripCount++;
    existing.totalFare += trip.finalFare;
    boroughPairMap.set(key, existing);
  }
  
  const airportMap = new Map<AirportCode, {
    pickupCount: number;
    dropoffCount: number;
    totalFees: number;
  }>();
  
  for (const trip of trips) {
    if (trip.airportCode) {
      const existing = airportMap.get(trip.airportCode) || {
        pickupCount: 0,
        dropoffCount: 0,
        totalFees: 0,
      };
      if (trip.tripCategory === "AIRPORT_PICKUP") {
        existing.pickupCount++;
      } else if (trip.tripCategory === "AIRPORT_DROPOFF") {
        existing.dropoffCount++;
      }
      existing.totalFees += trip.airportFee;
      airportMap.set(trip.airportCode, existing);
    }
  }
  
  const congestionTrips = trips.filter(t => t.congestionFee > 0);
  const outOfTownTripsNYCToOOS = trips.filter(t => t.tripCategory === "NYC_TO_OOS");
  const outOfTownTripsOOSToNYC = trips.filter(t => t.tripCategory === "OOS_TO_NYC");
  const longTrips = trips.filter(t => t.longTripSurcharge > 0);
  
  return {
    reportPeriodStart: filters.startDate,
    reportPeriodEnd: filters.endDate,
    totalTrips: trips.length,
    tripsByBoroughPair: Array.from(boroughPairMap.values()).map(bp => ({
      ...bp,
      avgFare: bp.tripCount > 0 ? roundCurrency(bp.totalFare / bp.tripCount) : 0,
    })),
    accessibilityFundTotals: {
      avfTripsCount: trips.length,
      avfTotalCollected: roundCurrency(trips.reduce((sum, t) => sum + t.avfFee, 0)),
      wheelchairTripsCount: trips.filter(t => t.isWheelchairTrip).length,
      accessibleVehicleTripsCount: trips.filter(t => t.isAccessibleVehicle).length,
    },
    airportPickupCounts: (["JFK", "LGA", "EWR", "WCY"] as AirportCode[]).map(code => ({
      airportCode: code,
      pickupCount: airportMap.get(code)?.pickupCount || 0,
      dropoffCount: airportMap.get(code)?.dropoffCount || 0,
      totalAirportFees: airportMap.get(code)?.totalFees || 0,
    })),
    manhattanCongestionFees: {
      tripsInZone: congestionTrips.length,
      totalCongestionFees: roundCurrency(congestionTrips.reduce((sum, t) => sum + t.congestionFee, 0)),
      avgCongestionFee: congestionTrips.length > 0 
        ? roundCurrency(congestionTrips.reduce((sum, t) => sum + t.congestionFee, 0) / congestionTrips.length)
        : 0,
    },
    outOfTownTrips: {
      nycToOosCount: outOfTownTripsNYCToOOS.length,
      oosToNycCount: outOfTownTripsOOSToNYC.length,
      totalReturnFees: roundCurrency(
        [...outOfTownTripsNYCToOOS, ...outOfTownTripsOOSToNYC]
          .reduce((sum, t) => sum + t.outOfTownReturnFee, 0)
      ),
    },
    longTripSurcharges: {
      tripsOver20Miles: longTrips.length,
      totalLongTripSurcharges: roundCurrency(longTrips.reduce((sum, t) => sum + t.longTripSurcharge, 0)),
      avgLongTripSurcharge: longTrips.length > 0
        ? roundCurrency(longTrips.reduce((sum, t) => sum + t.longTripSurcharge, 0) / longTrips.length)
        : 0,
    },
    driverWorkingHours: {
      totalOnlineHours: roundCurrency(driverReports.reduce((sum, d) => sum + d.totalOnlineHours, 0)),
      totalEngagedHours: roundCurrency(driverReports.reduce((sum, d) => sum + d.totalEngagedHours, 0)),
      avgUtilizationRate: driverReports.length > 0
        ? roundCurrency(driverReports.reduce((sum, d) => sum + d.utilizationRate, 0) / driverReports.length)
        : 0,
      driversActive: driverReports.length,
    },
    financialSummary: {
      totalFaresCollected: roundCurrency(trips.reduce((sum, t) => sum + t.finalFare, 0)),
      totalDriverPayouts: roundCurrency(trips.reduce((sum, t) => sum + t.driverPayout, 0)),
      totalCommissions: roundCurrency(trips.reduce((sum, t) => sum + t.commissionAmount, 0)),
      totalTLCFees: roundCurrency(trips.reduce((sum, t) => 
        sum + t.avfFee + t.bcfFee + t.hvrfFee + t.stateSurcharge + 
        t.congestionFee + t.airportFee + t.longTripSurcharge + t.outOfTownReturnFee, 0)),
      totalTolls: roundCurrency(trips.reduce((sum, t) => sum + t.tolls, 0)),
    },
    reportGeneratedAt: new Date(),
  };
}

export async function generateOutOfTownReport(
  filters: TLCReportFilters
): Promise<OutOfTownReport> {
  const allTrips = await generateTripRecordReport(filters);
  const outOfTownTrips = allTrips.filter(t => 
    t.tripCategory === "NYC_TO_OOS" || t.tripCategory === "OOS_TO_NYC"
  );
  
  return {
    reportPeriodStart: filters.startDate,
    reportPeriodEnd: filters.endDate,
    trips: outOfTownTrips.map(t => ({
      tripId: t.tripId,
      driverId: t.driverId,
      direction: t.tripCategory as "NYC_TO_OOS" | "OOS_TO_NYC",
      pickupBorough: t.pickupLocation.borough,
      dropoffLocation: `${t.dropoffLocation.lat.toFixed(4)}, ${t.dropoffLocation.lng.toFixed(4)}`,
      distanceMiles: t.tripDistanceMiles,
      returnFeeMiles: t.tripCategory === "NYC_TO_OOS" ? t.tripDistanceMiles * 0.75 : undefined,
      returnFeeCharged: t.outOfTownReturnFee,
      tripFare: t.finalFare,
    })),
    summary: {
      totalOutboundTrips: outOfTownTrips.filter(t => t.tripCategory === "NYC_TO_OOS").length,
      totalInboundTrips: outOfTownTrips.filter(t => t.tripCategory === "OOS_TO_NYC").length,
      totalReturnFeesCollected: roundCurrency(
        outOfTownTrips.reduce((sum, t) => sum + t.outOfTownReturnFee, 0)
      ),
      avgReturnFee: outOfTownTrips.length > 0
        ? roundCurrency(outOfTownTrips.reduce((sum, t) => sum + t.outOfTownReturnFee, 0) / outOfTownTrips.length)
        : 0,
    },
    reportGeneratedAt: new Date(),
  };
}

export async function generateAccessibilityReport(
  filters: TLCReportFilters
): Promise<AccessibilityReport> {
  const trips = await generateTripRecordReport(filters);
  const accessibleTrips = trips.filter(t => t.isAccessibleVehicle);
  const wheelchairTrips = trips.filter(t => t.isWheelchairTrip);
  
  const boroughBreakdown = new Map<BoroughCode, { trips: number; avf: number }>();
  
  for (const trip of accessibleTrips) {
    const existing = boroughBreakdown.get(trip.pickupLocation.borough) || { trips: 0, avf: 0 };
    existing.trips++;
    existing.avf += trip.avfFee;
    boroughBreakdown.set(trip.pickupLocation.borough, existing);
  }
  
  const totalAVF = trips.reduce((sum, t) => sum + t.avfFee, 0);
  const percentAccessible = trips.length > 0 
    ? roundCurrency((accessibleTrips.length / trips.length) * 100) 
    : 0;
  
  return {
    reportPeriodStart: filters.startDate,
    reportPeriodEnd: filters.endDate,
    avfCollection: {
      totalTrips: trips.length,
      totalAVFCollected: roundCurrency(totalAVF),
      avgAVFPerTrip: trips.length > 0 ? roundCurrency(totalAVF / trips.length) : 0,
    },
    accessibleVehicleTrips: {
      totalTrips: accessibleTrips.length,
      wheelchairTrips: wheelchairTrips.length,
      avgTripDistance: accessibleTrips.length > 0
        ? roundCurrency(accessibleTrips.reduce((sum, t) => sum + t.tripDistanceMiles, 0) / accessibleTrips.length)
        : 0,
      avgTripDuration: accessibleTrips.length > 0
        ? roundCurrency(accessibleTrips.reduce((sum, t) => sum + t.tripDurationMinutes, 0) / accessibleTrips.length)
        : 0,
    },
    boroughBreakdown: Array.from(boroughBreakdown.entries()).map(([borough, data]) => ({
      borough,
      accessibleTrips: data.trips,
      avfCollected: roundCurrency(data.avf),
    })),
    complianceMetrics: {
      percentAccessibleTrips: percentAccessible,
      targetPercentage: 5.0,
      isCompliant: percentAccessible >= 5.0,
    },
    reportGeneratedAt: new Date(),
  };
}

export async function generateAirportActivityReport(
  filters: TLCReportFilters
): Promise<AirportActivityReport> {
  const trips = await generateTripRecordReport(filters);
  const airportTrips = trips.filter(t => 
    t.tripCategory === "AIRPORT_PICKUP" || t.tripCategory === "AIRPORT_DROPOFF"
  );
  
  const airportCodes: AirportCode[] = ["JFK", "LGA", "EWR", "WCY"];
  const airports = airportCodes.map(code => {
    const pickups = airportTrips.filter(t => 
      t.tripCategory === "AIRPORT_PICKUP" && t.airportCode === code
    );
    const dropoffs = airportTrips.filter(t => 
      t.tripCategory === "AIRPORT_DROPOFF" && t.airportCode === code
    );
    
    const hourlyDist = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      pickupCount: pickups.filter(t => t.pickupTime.getHours() === hour).length,
      dropoffCount: dropoffs.filter(t => t.dropoffTime.getHours() === hour).length,
    }));
    
    return {
      code,
      name: getAirportName(code),
      pickups: {
        count: pickups.length,
        totalFare: roundCurrency(pickups.reduce((sum, t) => sum + t.finalFare, 0)),
        avgFare: pickups.length > 0
          ? roundCurrency(pickups.reduce((sum, t) => sum + t.finalFare, 0) / pickups.length)
          : 0,
      },
      dropoffs: {
        count: dropoffs.length,
        totalFare: roundCurrency(dropoffs.reduce((sum, t) => sum + t.finalFare, 0)),
        avgFare: dropoffs.length > 0
          ? roundCurrency(dropoffs.reduce((sum, t) => sum + t.finalFare, 0) / dropoffs.length)
          : 0,
      },
      airportFeesCollected: roundCurrency(
        [...pickups, ...dropoffs].reduce((sum, t) => sum + t.airportFee, 0)
      ),
      hourlyDistribution: hourlyDist,
    };
  });
  
  const totalTrips = airportTrips.length;
  let busiestAirport: AirportCode = "JFK";
  let maxTrips = 0;
  let peakHour = 0;
  let maxHourTrips = 0;
  
  for (const airport of airports) {
    const airportTotal = airport.pickups.count + airport.dropoffs.count;
    if (airportTotal > maxTrips) {
      maxTrips = airportTotal;
      busiestAirport = airport.code;
    }
    
    for (const hourData of airport.hourlyDistribution) {
      const hourTotal = hourData.pickupCount + hourData.dropoffCount;
      if (hourTotal > maxHourTrips) {
        maxHourTrips = hourTotal;
        peakHour = hourData.hour;
      }
    }
  }
  
  return {
    reportPeriodStart: filters.startDate,
    reportPeriodEnd: filters.endDate,
    airports,
    summary: {
      totalAirportTrips: totalTrips,
      totalAirportFees: roundCurrency(airportTrips.reduce((sum, t) => sum + t.airportFee, 0)),
      busiestAirport,
      peakHour,
    },
    reportGeneratedAt: new Date(),
  };
}

// ============================================
// CSV Export Functions
// ============================================

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function tripRecordToCSV(trips: TripRecordReport[]): string {
  const headers = [
    "tripId", "driverId", "vehicleId", "pickupTime", "dropoffTime",
    "pickupLat", "pickupLng", "pickupBorough", "dropoffLat", "dropoffLng", "dropoffBorough",
    "tripDistanceMiles", "tripDurationMinutes", "fareSubtotal", "tolls",
    "congestionFee", "airportFee", "airportCode", "avfFee", "bcfFee", "hvrfFee",
    "stateSurcharge", "longTripSurcharge", "outOfTownReturnFee",
    "promoUsed", "promoCode", "discountAmount", "finalFare",
    "driverPayout", "commissionAmount", "tripCategory",
    "tlcMinimumApplied", "tlcAdjustment", "isAccessibleVehicle", "isWheelchairTrip"
  ];
  
  const rows = trips.map(trip => [
    trip.tripId,
    trip.driverId,
    trip.vehicleId,
    trip.pickupTime.toISOString(),
    trip.dropoffTime.toISOString(),
    trip.pickupLocation.lat,
    trip.pickupLocation.lng,
    trip.pickupLocation.borough,
    trip.dropoffLocation.lat,
    trip.dropoffLocation.lng,
    trip.dropoffLocation.borough,
    trip.tripDistanceMiles,
    trip.tripDurationMinutes,
    trip.fareSubtotal,
    trip.tolls,
    trip.congestionFee,
    trip.airportFee,
    trip.airportCode || "",
    trip.avfFee,
    trip.bcfFee,
    trip.hvrfFee,
    trip.stateSurcharge,
    trip.longTripSurcharge,
    trip.outOfTownReturnFee,
    trip.promoUsed,
    trip.promoCode || "",
    trip.discountAmount,
    trip.finalFare,
    trip.driverPayout,
    trip.commissionAmount,
    trip.tripCategory,
    trip.tlcMinimumApplied,
    trip.tlcAdjustment,
    trip.isAccessibleVehicle,
    trip.isWheelchairTrip,
  ].map(escapeCSV));
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

export function driverPayToCSV(reports: DriverPayReport[]): string {
  const headers = [
    "driverId", "reportPeriodStart", "reportPeriodEnd",
    "totalTrips", "totalOnlineHours", "totalEngagedHours", "utilizationRate",
    "baseEarnings", "tlcTimeEarnings", "tlcDistanceEarnings",
    "tlcMinimumPayAdjustments", "incentivesTotal",
    "questBonus", "boostZoneBonus", "airportPickupBonus", "weatherBonus", "lateNightBonus",
    "tollsCollected", "feesCollectedForTLC",
    "avfTotal", "bcfTotal", "hvrfTotal", "stateSurchargeTotal",
    "congestionTotal", "airportTotal", "longTripTotal", "outOfTownTotal",
    "grossEarnings", "netPayout", "hourlyEarningsAverage", "tlcComplianceStatus"
  ];
  
  const rows = reports.map(r => [
    r.driverId,
    r.reportPeriodStart.toISOString(),
    r.reportPeriodEnd.toISOString(),
    r.totalTrips,
    r.totalOnlineHours,
    r.totalEngagedHours,
    r.utilizationRate,
    r.baseEarnings,
    r.tlcTimeEarnings,
    r.tlcDistanceEarnings,
    r.tlcMinimumPayAdjustments,
    r.incentivesTotal,
    r.incentiveBreakdown.questBonus,
    r.incentiveBreakdown.boostZoneBonus,
    r.incentiveBreakdown.airportPickupBonus,
    r.incentiveBreakdown.weatherBonus,
    r.incentiveBreakdown.lateNightBonus,
    r.tollsCollected,
    r.feesCollectedForTLC,
    r.feesBreakdown.avfTotal,
    r.feesBreakdown.bcfTotal,
    r.feesBreakdown.hvrfTotal,
    r.feesBreakdown.stateSurchargeTotal,
    r.feesBreakdown.congestionTotal,
    r.feesBreakdown.airportTotal,
    r.feesBreakdown.longTripTotal,
    r.feesBreakdown.outOfTownTotal,
    r.grossEarnings,
    r.netPayout,
    r.hourlyEarningsAverage,
    r.tlcComplianceStatus,
  ].map(escapeCSV));
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

export function summaryReportToCSV(report: HVFHVSummaryReport): string {
  const lines: string[] = [];
  
  lines.push("NYC TLC HVFHV Summary Report");
  lines.push(`Report Period: ${report.reportPeriodStart.toISOString()} to ${report.reportPeriodEnd.toISOString()}`);
  lines.push(`Generated: ${report.reportGeneratedAt.toISOString()}`);
  lines.push("");
  
  lines.push("=== TRIP SUMMARY ===");
  lines.push(`Total Trips,${report.totalTrips}`);
  lines.push("");
  
  lines.push("=== BOROUGH PAIR BREAKDOWN ===");
  lines.push("Pickup Borough,Dropoff Borough,Trip Count,Total Fare,Avg Fare");
  for (const bp of report.tripsByBoroughPair) {
    lines.push(`${bp.pickupBorough},${bp.dropoffBorough},${bp.tripCount},${bp.totalFare},${bp.avgFare}`);
  }
  lines.push("");
  
  lines.push("=== ACCESSIBILITY FUND ===");
  lines.push(`Total AVF Trips,${report.accessibilityFundTotals.avfTripsCount}`);
  lines.push(`Total AVF Collected,$${report.accessibilityFundTotals.avfTotalCollected}`);
  lines.push(`Wheelchair Trips,${report.accessibilityFundTotals.wheelchairTripsCount}`);
  lines.push(`Accessible Vehicle Trips,${report.accessibilityFundTotals.accessibleVehicleTripsCount}`);
  lines.push("");
  
  lines.push("=== AIRPORT ACTIVITY ===");
  lines.push("Airport,Pickups,Dropoffs,Total Fees");
  for (const ap of report.airportPickupCounts) {
    lines.push(`${ap.airportCode},${ap.pickupCount},${ap.dropoffCount},$${ap.totalAirportFees}`);
  }
  lines.push("");
  
  lines.push("=== MANHATTAN CONGESTION ===");
  lines.push(`Trips in Zone,${report.manhattanCongestionFees.tripsInZone}`);
  lines.push(`Total Congestion Fees,$${report.manhattanCongestionFees.totalCongestionFees}`);
  lines.push(`Avg Congestion Fee,$${report.manhattanCongestionFees.avgCongestionFee}`);
  lines.push("");
  
  lines.push("=== OUT-OF-TOWN TRIPS ===");
  lines.push(`NYC to Out-of-State,${report.outOfTownTrips.nycToOosCount}`);
  lines.push(`Out-of-State to NYC,${report.outOfTownTrips.oosToNycCount}`);
  lines.push(`Total Return Fees,$${report.outOfTownTrips.totalReturnFees}`);
  lines.push("");
  
  lines.push("=== LONG TRIP SURCHARGES ===");
  lines.push(`Trips Over 20 Miles,${report.longTripSurcharges.tripsOver20Miles}`);
  lines.push(`Total Long Trip Surcharges,$${report.longTripSurcharges.totalLongTripSurcharges}`);
  lines.push("");
  
  lines.push("=== DRIVER WORKING HOURS ===");
  lines.push(`Total Online Hours,${report.driverWorkingHours.totalOnlineHours}`);
  lines.push(`Total Engaged Hours,${report.driverWorkingHours.totalEngagedHours}`);
  lines.push(`Avg Utilization Rate,${(report.driverWorkingHours.avgUtilizationRate * 100).toFixed(1)}%`);
  lines.push(`Active Drivers,${report.driverWorkingHours.driversActive}`);
  lines.push("");
  
  lines.push("=== FINANCIAL SUMMARY ===");
  lines.push(`Total Fares Collected,$${report.financialSummary.totalFaresCollected}`);
  lines.push(`Total Driver Payouts,$${report.financialSummary.totalDriverPayouts}`);
  lines.push(`Total Commissions,$${report.financialSummary.totalCommissions}`);
  lines.push(`Total TLC Fees,$${report.financialSummary.totalTLCFees}`);
  lines.push(`Total Tolls,$${report.financialSummary.totalTolls}`);
  
  return lines.join("\n");
}

// ============================================
// Validation Functions
// ============================================

export interface TripValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTripRecord(trip: TripRecordReport): TripValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!trip.tripId) errors.push("Missing tripId");
  if (!trip.driverId) errors.push("Missing driverId");
  if (!trip.vehicleId) errors.push("Missing vehicleId");
  
  if (!trip.pickupTime || !(trip.pickupTime instanceof Date)) {
    errors.push("Invalid pickupTime");
  }
  if (!trip.dropoffTime || !(trip.dropoffTime instanceof Date)) {
    errors.push("Invalid dropoffTime");
  }
  if (trip.pickupTime && trip.dropoffTime && trip.pickupTime >= trip.dropoffTime) {
    errors.push("pickupTime must be before dropoffTime");
  }
  
  if (trip.tripDistanceMiles < 0) errors.push("tripDistanceMiles cannot be negative");
  if (trip.tripDurationMinutes < 0) errors.push("tripDurationMinutes cannot be negative");
  if (trip.fareSubtotal < 0) errors.push("fareSubtotal cannot be negative");
  if (trip.finalFare < 0) errors.push("finalFare cannot be negative");
  if (trip.driverPayout < 0) errors.push("driverPayout cannot be negative");
  
  const expectedMinimum = calculatePerRideMinimumPay({
    tripTimeMinutes: trip.tripDurationMinutes,
    tripDistanceMiles: trip.tripDistanceMiles,
    actualDriverPayout: trip.driverPayout - trip.tlcAdjustment,
  });
  
  if (trip.driverPayout < expectedMinimum.tlcMinimumPay - 0.01) {
    warnings.push(`Driver payout ($${trip.driverPayout}) below TLC minimum ($${expectedMinimum.tlcMinimumPay})`);
  }
  
  const calculatedFees = trip.congestionFee + trip.airportFee + trip.avfFee + 
                         trip.bcfFee + trip.hvrfFee + trip.stateSurcharge +
                         trip.longTripSurcharge + trip.outOfTownReturnFee + trip.tolls;
  const expectedFinal = trip.fareSubtotal + calculatedFees - trip.discountAmount;
  
  if (Math.abs(trip.finalFare - expectedFinal) > 0.02) {
    warnings.push(`Final fare mismatch: expected $${expectedFinal.toFixed(2)}, got $${trip.finalFare.toFixed(2)}`);
  }
  
  const validBoroughs: BoroughCode[] = ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN_ISLAND", "OUT_OF_NYC"];
  if (!validBoroughs.includes(trip.pickupLocation.borough)) {
    errors.push(`Invalid pickup borough: ${trip.pickupLocation.borough}`);
  }
  if (!validBoroughs.includes(trip.dropoffLocation.borough)) {
    errors.push(`Invalid dropoff borough: ${trip.dropoffLocation.borough}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateDriverPayReport(report: DriverPayReport): TripValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!report.driverId) errors.push("Missing driverId");
  if (report.totalTrips < 0) errors.push("totalTrips cannot be negative");
  if (report.totalOnlineHours < 0) errors.push("totalOnlineHours cannot be negative");
  if (report.totalEngagedHours < 0) errors.push("totalEngagedHours cannot be negative");
  
  if (report.totalEngagedHours > report.totalOnlineHours) {
    warnings.push("Engaged hours exceed online hours");
  }
  
  const expectedHourlyMinimum = report.totalOnlineHours * NYC_TLC_CONFIG.hourlyMinimumRate;
  if (report.netPayout < expectedHourlyMinimum - 1) {
    warnings.push(`Net payout may be below TLC hourly minimum: $${report.netPayout} vs $${expectedHourlyMinimum.toFixed(2)}`);
  }
  
  const feeSum = Object.values(report.feesBreakdown).reduce((a, b) => a + b, 0);
  if (Math.abs(feeSum - report.feesCollectedForTLC) > 0.02) {
    warnings.push(`Fee breakdown sum ($${feeSum.toFixed(2)}) doesn't match total ($${report.feesCollectedForTLC.toFixed(2)})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// Export Utilities
// ============================================

export async function exportReport(
  reportType: TLCReportExport["reportType"],
  format: "json" | "csv",
  filters: TLCReportFilters
): Promise<TLCReportExport> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let data: unknown;
  let filename: string;
  let recordCount: number;
  
  switch (reportType) {
    case "TRR": {
      const trips = await generateTripRecordReport(filters);
      data = format === "csv" ? tripRecordToCSV(trips) : trips;
      filename = `TLC_TripRecordReport_${timestamp}.${format}`;
      recordCount = trips.length;
      break;
    }
    case "DPR": {
      const driverReports = await generateDriverPayReport(filters);
      data = format === "csv" ? driverPayToCSV(driverReports) : driverReports;
      filename = `TLC_DriverPayReport_${timestamp}.${format}`;
      recordCount = driverReports.length;
      break;
    }
    case "HSR": {
      const summary = await generateHVFHVSummaryReport(filters);
      data = format === "csv" ? summaryReportToCSV(summary) : summary;
      filename = `TLC_HVFHVSummaryReport_${timestamp}.${format}`;
      recordCount = 1;
      break;
    }
    case "OUT_OF_TOWN": {
      const outOfTown = await generateOutOfTownReport(filters);
      data = format === "csv" 
        ? outOfTown.trips.map(t => Object.values(t).join(",")).join("\n")
        : outOfTown;
      filename = `TLC_OutOfTownReport_${timestamp}.${format}`;
      recordCount = outOfTown.trips.length;
      break;
    }
    case "ACCESSIBILITY": {
      const accessibility = await generateAccessibilityReport(filters);
      data = format === "csv" 
        ? JSON.stringify(accessibility, null, 2)
        : accessibility;
      filename = `TLC_AccessibilityReport_${timestamp}.${format}`;
      recordCount = 1;
      break;
    }
    case "AIRPORT": {
      const airport = await generateAirportActivityReport(filters);
      data = format === "csv" 
        ? JSON.stringify(airport, null, 2)
        : airport;
      filename = `TLC_AirportActivityReport_${timestamp}.${format}`;
      recordCount = airport.airports.length;
      break;
    }
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
  
  return {
    format,
    reportType,
    data,
    filename,
    generatedAt: new Date(),
    recordCount,
  };
}
