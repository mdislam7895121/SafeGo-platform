/**
 * BD Ride Fare Calculation Service
 * 
 * Pure, side-effect free fare calculation for Bangladesh rides.
 * Implements city/vehicle-specific pricing with night/peak multipliers,
 * cash/online payment logic, and commission handling.
 * 
 * SafeGo Master Rules Compliance:
 * - BD: Both cash and online payments allowed
 * - US: ONLY online payment allowed (cash rejected)
 * - Commission: 15-25% depending on vehicle type
 * - Cash rides: Commission goes to negative driver wallet
 * - Online rides: Commission kept by platform
 */

import { prisma } from "../lib/prisma";

export type VehicleType = "bike" | "cng" | "car_economy" | "car_premium";
export type PaymentMethod = "cash" | "online";
export type SpeedOption = "normal" | "priority";

export interface FareCalculationInput {
  countryCode: string;
  cityCode: string;
  vehicleType: VehicleType;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  requestTimestamp: Date;
  customerPaymentMethod: PaymentMethod;
  speedOption?: SpeedOption;
}

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  subtotal: number;
  nightMultiplier: number;
  peakMultiplier: number;
  finalMultiplier: number;
  multiplierAdjustment: number;
  priorityFee: number;
  totalFare: number;
  minimumFareApplied: boolean;
  safegoCommission: number;
  driverEarnings: number;
  currency: string;
  commissionRate: number;
}

export interface FareCalculationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  pricingRuleId?: string;
  vehicleType: VehicleType;
  vehicleDisplayName?: string;
  paymentMethod: PaymentMethod;
  distanceKm: number;
  durationMin: number;
  fare: FareBreakdown;
  isNightTime: boolean;
  isPeakTime: boolean;
  cashAllowed: boolean;
  onlineAllowed: boolean;
  calculatedAt: Date;
}

export interface VehicleOption {
  vehicleType: VehicleType;
  displayName: string;
  description: string;
  estimatedFare: number;
  fareRange: { min: number; max: number };
  currency: string;
  etaMinutes: number;
  capacity?: number;
  isAvailable: boolean;
}

function roundCurrency(amount: number, decimalPlaces: number = 2): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(amount * factor) / factor;
}

function isNightTime(date: Date, startHour: number, endHour: number): boolean {
  const hour = date.getHours();
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

function isPeakTime(date: Date, peakRanges: { start: number; end: number }[] | null): boolean {
  if (!peakRanges || peakRanges.length === 0) return false;
  
  const hour = date.getHours();
  const dayOfWeek = date.getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  for (const range of peakRanges) {
    if (hour >= range.start && hour < range.end) {
      return true;
    }
  }
  return false;
}

function calculateBDTDecimalPlaces(): number {
  return 0;
}

function calculateUSDDecimalPlaces(): number {
  return 2;
}

export async function calculateRideFare(input: FareCalculationInput): Promise<FareCalculationResult> {
  const {
    countryCode,
    cityCode,
    vehicleType,
    estimatedDistanceKm,
    estimatedDurationMin,
    requestTimestamp,
    customerPaymentMethod,
    speedOption = "normal",
  } = input;

  const pricingRule = await prisma.ridePricingRule.findFirst({
    where: {
      countryCode,
      cityCode,
      vehicleType,
      isActive: true,
    },
  });

  if (!pricingRule) {
    return {
      success: false,
      error: `No active pricing rule found for ${countryCode}/${cityCode}/${vehicleType}`,
      errorCode: "PRICING_RULE_NOT_FOUND",
      vehicleType,
      paymentMethod: customerPaymentMethod,
      distanceKm: estimatedDistanceKm,
      durationMin: estimatedDurationMin,
      fare: {
        baseFare: 0,
        distanceFare: 0,
        timeFare: 0,
        bookingFee: 0,
        subtotal: 0,
        nightMultiplier: 1,
        peakMultiplier: 1,
        finalMultiplier: 1,
        multiplierAdjustment: 0,
        priorityFee: 0,
        totalFare: 0,
        minimumFareApplied: false,
        safegoCommission: 0,
        driverEarnings: 0,
        currency: countryCode === "BD" ? "BDT" : "USD",
        commissionRate: 0,
      },
      isNightTime: false,
      isPeakTime: false,
      cashAllowed: false,
      onlineAllowed: false,
      calculatedAt: new Date(),
    };
  }

  if (countryCode === "US" && customerPaymentMethod === "cash") {
    return {
      success: false,
      error: "Cash payment is not allowed for rides in the United States. Please use online payment.",
      errorCode: "CASH_NOT_ALLOWED_US",
      vehicleType,
      paymentMethod: customerPaymentMethod,
      distanceKm: estimatedDistanceKm,
      durationMin: estimatedDurationMin,
      fare: {
        baseFare: 0,
        distanceFare: 0,
        timeFare: 0,
        bookingFee: 0,
        subtotal: 0,
        nightMultiplier: 1,
        peakMultiplier: 1,
        finalMultiplier: 1,
        multiplierAdjustment: 0,
        priorityFee: 0,
        totalFare: 0,
        minimumFareApplied: false,
        safegoCommission: 0,
        driverEarnings: 0,
        currency: "USD",
        commissionRate: 0,
      },
      isNightTime: false,
      isPeakTime: false,
      cashAllowed: false,
      onlineAllowed: true,
      calculatedAt: new Date(),
    };
  }

  if (customerPaymentMethod === "cash" && !pricingRule.allowCash) {
    return {
      success: false,
      error: "Cash payment is not available for this ride type.",
      errorCode: "CASH_NOT_ALLOWED",
      vehicleType,
      paymentMethod: customerPaymentMethod,
      distanceKm: estimatedDistanceKm,
      durationMin: estimatedDurationMin,
      fare: {
        baseFare: 0,
        distanceFare: 0,
        timeFare: 0,
        bookingFee: 0,
        subtotal: 0,
        nightMultiplier: 1,
        peakMultiplier: 1,
        finalMultiplier: 1,
        multiplierAdjustment: 0,
        priorityFee: 0,
        totalFare: 0,
        minimumFareApplied: false,
        safegoCommission: 0,
        driverEarnings: 0,
        currency: pricingRule.currency,
        commissionRate: 0,
      },
      isNightTime: false,
      isPeakTime: false,
      cashAllowed: pricingRule.allowCash,
      onlineAllowed: pricingRule.allowOnline,
      calculatedAt: new Date(),
    };
  }

  const baseFare = Number(pricingRule.baseFare);
  const perKmRate = Number(pricingRule.perKmRate);
  const perMinRate = Number(pricingRule.perMinRate);
  const bookingFee = Number(pricingRule.bookingFee);
  const minimumFare = Number(pricingRule.minimumFare);
  const nightMultiplierConfig = Number(pricingRule.nightMultiplier);
  const peakMultiplierConfig = Number(pricingRule.peakMultiplier);
  const commissionRate = Number(pricingRule.commissionRate);
  const currency = pricingRule.currency;
  const decimalPlaces = currency === "BDT" ? calculateBDTDecimalPlaces() : calculateUSDDecimalPlaces();

  const distanceFare = perKmRate * estimatedDistanceKm;
  const timeFare = perMinRate * estimatedDurationMin;

  let subtotal = baseFare + distanceFare + timeFare + bookingFee;

  const isNight = isNightTime(requestTimestamp, pricingRule.nightStartHour, pricingRule.nightEndHour);
  const isPeak = isPeakTime(requestTimestamp, pricingRule.peakTimeRanges as { start: number; end: number }[] | null);

  let nightMultiplier = 1;
  let peakMultiplier = 1;

  if (isNight) {
    nightMultiplier = nightMultiplierConfig;
  }

  if (isPeak && !isNight) {
    peakMultiplier = peakMultiplierConfig;
  }

  const finalMultiplier = Math.max(nightMultiplier, peakMultiplier);
  const multiplierAdjustment = subtotal * (finalMultiplier - 1);
  subtotal = subtotal * finalMultiplier;

  let priorityFee = 0;
  if (speedOption === "priority") {
    priorityFee = subtotal * 0.15;
    subtotal = subtotal + priorityFee;
  }

  let minimumFareApplied = false;
  if (subtotal < minimumFare) {
    subtotal = minimumFare;
    minimumFareApplied = true;
  }

  const totalFare = roundCurrency(subtotal, decimalPlaces);
  const safegoCommission = roundCurrency(totalFare * (commissionRate / 100), decimalPlaces);
  const driverEarnings = roundCurrency(totalFare - safegoCommission, decimalPlaces);

  return {
    success: true,
    pricingRuleId: pricingRule.id,
    vehicleType,
    vehicleDisplayName: pricingRule.displayName || undefined,
    paymentMethod: customerPaymentMethod,
    distanceKm: estimatedDistanceKm,
    durationMin: estimatedDurationMin,
    fare: {
      baseFare: roundCurrency(baseFare, decimalPlaces),
      distanceFare: roundCurrency(distanceFare, decimalPlaces),
      timeFare: roundCurrency(timeFare, decimalPlaces),
      bookingFee: roundCurrency(bookingFee, decimalPlaces),
      subtotal: roundCurrency(baseFare + distanceFare + timeFare + bookingFee, decimalPlaces),
      nightMultiplier,
      peakMultiplier,
      finalMultiplier,
      multiplierAdjustment: roundCurrency(multiplierAdjustment, decimalPlaces),
      priorityFee: roundCurrency(priorityFee, decimalPlaces),
      totalFare,
      minimumFareApplied,
      safegoCommission,
      driverEarnings,
      currency,
      commissionRate,
    },
    isNightTime: isNight,
    isPeakTime: isPeak,
    cashAllowed: pricingRule.allowCash,
    onlineAllowed: pricingRule.allowOnline,
    calculatedAt: new Date(),
  };
}

export async function getAvailableVehicleOptions(
  countryCode: string,
  cityCode: string,
  estimatedDistanceKm: number,
  estimatedDurationMin: number,
  requestTimestamp: Date
): Promise<VehicleOption[]> {
  const pricingRules = await prisma.ridePricingRule.findMany({
    where: {
      countryCode,
      cityCode,
      isActive: true,
    },
    orderBy: { baseFare: "asc" },
  });

  const vehicleOptions: VehicleOption[] = [];

  for (const rule of pricingRules) {
    const fareResult = await calculateRideFare({
      countryCode,
      cityCode,
      vehicleType: rule.vehicleType as VehicleType,
      pickupLat: 0,
      pickupLng: 0,
      dropoffLat: 0,
      dropoffLng: 0,
      estimatedDistanceKm,
      estimatedDurationMin,
      requestTimestamp,
      customerPaymentMethod: "online",
    });

    if (fareResult.success) {
      const estimatedFare = fareResult.fare.totalFare;
      vehicleOptions.push({
        vehicleType: rule.vehicleType as VehicleType,
        displayName: rule.displayName || rule.vehicleType,
        description: rule.description || "",
        estimatedFare,
        fareRange: {
          min: Math.floor(estimatedFare * 0.9),
          max: Math.ceil(estimatedFare * 1.1),
        },
        currency: rule.currency,
        etaMinutes: getVehicleETA(rule.vehicleType as VehicleType),
        capacity: getVehicleCapacity(rule.vehicleType as VehicleType),
        isAvailable: true,
      });
    }
  }

  return vehicleOptions;
}

function getVehicleETA(vehicleType: VehicleType): number {
  switch (vehicleType) {
    case "bike":
      return 3;
    case "cng":
      return 5;
    case "car_economy":
      return 7;
    case "car_premium":
      return 10;
    default:
      return 5;
  }
}

function getVehicleCapacity(vehicleType: VehicleType): number {
  switch (vehicleType) {
    case "bike":
      return 1;
    case "cng":
      return 3;
    case "car_economy":
      return 4;
    case "car_premium":
      return 4;
    default:
      return 4;
  }
}

export async function getPricingRules(countryCode?: string, cityCode?: string) {
  const where: any = { isActive: true };
  if (countryCode) where.countryCode = countryCode;
  if (cityCode) where.cityCode = cityCode;

  return prisma.ridePricingRule.findMany({
    where,
    orderBy: [{ countryCode: "asc" }, { cityCode: "asc" }, { baseFare: "asc" }],
  });
}

export async function getAvailableCities(countryCode: string) {
  const rules = await prisma.ridePricingRule.findMany({
    where: { countryCode, isActive: true },
    select: { cityCode: true },
    distinct: ["cityCode"],
  });
  return rules.map((r) => r.cityCode);
}

export function getCityDisplayName(cityCode: string): string {
  const cityNames: Record<string, string> = {
    DHK: "Dhaka",
    CTG: "Chittagong",
    KHL: "Khulna",
    SYL: "Sylhet",
    NYC: "New York City",
    LAX: "Los Angeles",
    CHI: "Chicago",
  };
  return cityNames[cityCode] || cityCode;
}

export function getVehicleDisplayName(vehicleType: string): string {
  const vehicleNames: Record<string, string> = {
    bike: "Motorcycle",
    cng: "CNG Auto",
    car_economy: "Economy Car",
    car_premium: "Premium Car",
  };
  return vehicleNames[vehicleType] || vehicleType;
}

export function getVehicleIcon(vehicleType: VehicleType): string {
  switch (vehicleType) {
    case "bike":
      return "bike";
    case "cng":
      return "truck";
    case "car_economy":
      return "car";
    case "car_premium":
      return "car-front";
    default:
      return "car";
  }
}
