/**
 * Fare Engine Seed Data
 * Seeds ride types, fare configs, regulatory zones, and fee rules for multi-route pricing
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NYC Area Polygon Coordinates (simplified for demonstration)
const NYC_POLYGON = [
  { lat: 40.9176, lng: -74.2591 },
  { lat: 40.9176, lng: -73.7002 },
  { lat: 40.4774, lng: -73.7002 },
  { lat: 40.4774, lng: -74.2591 },
];

// JFK Airport Zone
const JFK_AIRPORT_POLYGON = [
  { lat: 40.6650, lng: -73.8067 },
  { lat: 40.6650, lng: -73.7571 },
  { lat: 40.6302, lng: -73.7571 },
  { lat: 40.6302, lng: -73.8067 },
];

// LaGuardia Airport Zone
const LGA_AIRPORT_POLYGON = [
  { lat: 40.7832, lng: -73.8869 },
  { lat: 40.7832, lng: -73.8529 },
  { lat: 40.7654, lng: -73.8529 },
  { lat: 40.7654, lng: -73.8869 },
];

// Newark Airport Zone
const EWR_AIRPORT_POLYGON = [
  { lat: 40.7073, lng: -74.1942 },
  { lat: 40.7073, lng: -74.1549 },
  { lat: 40.6689, lng: -74.1549 },
  { lat: 40.6689, lng: -74.1942 },
];

// Manhattan Congestion Zone (below 60th Street)
const MANHATTAN_CONGESTION_POLYGON = [
  { lat: 40.7644, lng: -74.0060 },
  { lat: 40.7644, lng: -73.9712 },
  { lat: 40.6997, lng: -73.9712 },
  { lat: 40.6997, lng: -74.0177 },
  { lat: 40.7073, lng: -74.0204 },
];

function calculateBoundingBox(polygon: { lat: number; lng: number }[]) {
  const lats = polygon.map(p => p.lat);
  const lngs = polygon.map(p => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

export async function seedFareEngine() {
  console.log("[FareEngine] Seeding ride types...");
  
  // Seed Ride Types
  const rideTypes = await Promise.all([
    prisma.rideType.upsert({
      where: { code: "SAVER" },
      create: {
        code: "SAVER",
        name: "SafeGo Saver",
        description: "Budget-friendly option with shared routes",
        iconType: "economy",
        capacity: 4,
        sortOrder: 1,
        isActive: true,
      },
      update: {
        name: "SafeGo Saver",
        description: "Budget-friendly option with shared routes",
      },
    }),
    prisma.rideType.upsert({
      where: { code: "STANDARD" },
      create: {
        code: "STANDARD",
        name: "SafeGo X",
        description: "Affordable everyday rides",
        iconType: "economy",
        capacity: 4,
        sortOrder: 2,
        isActive: true,
      },
      update: {
        name: "SafeGo X",
        description: "Affordable everyday rides",
      },
    }),
    prisma.rideType.upsert({
      where: { code: "COMFORT" },
      create: {
        code: "COMFORT",
        name: "SafeGo Comfort",
        description: "Newer cars with extra legroom",
        iconType: "comfort",
        capacity: 4,
        sortOrder: 3,
        isActive: true,
      },
      update: {
        name: "SafeGo Comfort",
        description: "Newer cars with extra legroom",
      },
    }),
    prisma.rideType.upsert({
      where: { code: "XL" },
      create: {
        code: "XL",
        name: "SafeGo XL",
        description: "SUVs for groups up to 6",
        iconType: "xl",
        capacity: 6,
        sortOrder: 4,
        isActive: true,
      },
      update: {
        name: "SafeGo XL",
        description: "SUVs for groups up to 6",
      },
    }),
    prisma.rideType.upsert({
      where: { code: "PREMIUM" },
      create: {
        code: "PREMIUM",
        name: "SafeGo Premium",
        description: "High-end vehicles with top-rated drivers",
        iconType: "premium",
        capacity: 4,
        sortOrder: 5,
        isActive: true,
      },
      update: {
        name: "SafeGo Premium",
        description: "High-end vehicles with top-rated drivers",
      },
    }),
  ]);

  console.log(`[FareEngine] Created ${rideTypes.length} ride types`);

  // Seed Fare Configs for each ride type (USA defaults)
  console.log("[FareEngine] Seeding fare configurations...");

  const fareConfigData = [
    { code: "SAVER", baseFare: 1.50, perMile: 0.90, perMin: 0.15, minimum: 4.00, driverPerMile: 0.75, driverPerMin: 0.12, serviceFee: 18 },
    { code: "STANDARD", baseFare: 2.50, perMile: 1.50, perMin: 0.30, minimum: 5.00, driverPerMile: 1.20, driverPerMin: 0.20, serviceFee: 15 },
    { code: "COMFORT", baseFare: 3.50, perMile: 2.00, perMin: 0.45, minimum: 7.00, driverPerMile: 1.60, driverPerMin: 0.35, serviceFee: 15 },
    { code: "XL", baseFare: 4.00, perMile: 2.50, perMin: 0.50, minimum: 8.00, driverPerMile: 2.00, driverPerMin: 0.40, serviceFee: 15 },
    { code: "PREMIUM", baseFare: 7.00, perMile: 3.50, perMin: 0.75, minimum: 15.00, driverPerMile: 2.80, driverPerMin: 0.60, serviceFee: 12 },
  ];

  for (const config of fareConfigData) {
    const rideType = rideTypes.find(rt => rt.code === config.code);
    if (!rideType) continue;

    // Check if config exists
    const existing = await prisma.rideFareConfig.findFirst({
      where: {
        rideTypeId: rideType.id,
        countryCode: "US",
        cityCode: null,
        version: 1,
      },
    });

    if (!existing) {
      await prisma.rideFareConfig.create({
        data: {
          rideTypeId: rideType.id,
          countryCode: "US",
          cityCode: null,
          baseFare: config.baseFare,
          perMileRate: config.perMile,
          perMinuteRate: config.perMin,
          minimumFare: config.minimum,
          driverPerMileRate: config.driverPerMile,
          driverPerMinuteRate: config.driverPerMin,
          serviceFeePercent: config.serviceFee,
          serviceFeeMinimum: 1.50,
          serviceFeeMaximum: 12.00,
          maxSurgeMultiplier: 3.00,
          surgeEnabled: true,
          trafficMultiplierLight: 1.00,
          trafficMultiplierModerate: 1.10,
          trafficMultiplierHeavy: 1.25,
          isActive: true,
          version: 1,
        },
      });
      console.log(`[FareEngine] Created fare config for ${config.code}`);
    }
  }

  // Seed Regulatory Zones
  console.log("[FareEngine] Seeding regulatory zones...");

  // NYC BCF Zone
  const nycBox = calculateBoundingBox(NYC_POLYGON);
  const nycBcfZone = await prisma.regulatoryZone.upsert({
    where: { id: "zone-nyc-bcf" },
    create: {
      id: "zone-nyc-bcf",
      name: "New York City",
      zoneType: "BLACK_CAR_FUND",
      countryCode: "US",
      stateCode: "NY",
      cityCode: "NYC",
      polygonCoordinates: NYC_POLYGON,
      boundingBoxMinLat: nycBox.minLat,
      boundingBoxMaxLat: nycBox.maxLat,
      boundingBoxMinLng: nycBox.minLng,
      boundingBoxMaxLng: nycBox.maxLng,
      isActive: true,
    },
    update: {
      polygonCoordinates: NYC_POLYGON,
      boundingBoxMinLat: nycBox.minLat,
      boundingBoxMaxLat: nycBox.maxLat,
      boundingBoxMinLng: nycBox.minLng,
      boundingBoxMaxLng: nycBox.maxLng,
    },
  });

  // JFK Airport Zone
  const jfkBox = calculateBoundingBox(JFK_AIRPORT_POLYGON);
  const jfkZone = await prisma.regulatoryZone.upsert({
    where: { id: "zone-jfk-airport" },
    create: {
      id: "zone-jfk-airport",
      name: "JFK International Airport",
      zoneType: "AIRPORT",
      countryCode: "US",
      stateCode: "NY",
      cityCode: "NYC",
      polygonCoordinates: JFK_AIRPORT_POLYGON,
      boundingBoxMinLat: jfkBox.minLat,
      boundingBoxMaxLat: jfkBox.maxLat,
      boundingBoxMinLng: jfkBox.minLng,
      boundingBoxMaxLng: jfkBox.maxLng,
      isActive: true,
    },
    update: {
      polygonCoordinates: JFK_AIRPORT_POLYGON,
    },
  });

  // LaGuardia Airport Zone
  const lgaBox = calculateBoundingBox(LGA_AIRPORT_POLYGON);
  const lgaZone = await prisma.regulatoryZone.upsert({
    where: { id: "zone-lga-airport" },
    create: {
      id: "zone-lga-airport",
      name: "LaGuardia Airport",
      zoneType: "AIRPORT",
      countryCode: "US",
      stateCode: "NY",
      cityCode: "NYC",
      polygonCoordinates: LGA_AIRPORT_POLYGON,
      boundingBoxMinLat: lgaBox.minLat,
      boundingBoxMaxLat: lgaBox.maxLat,
      boundingBoxMinLng: lgaBox.minLng,
      boundingBoxMaxLng: lgaBox.maxLng,
      isActive: true,
    },
    update: {
      polygonCoordinates: LGA_AIRPORT_POLYGON,
    },
  });

  // Newark Airport Zone
  const ewrBox = calculateBoundingBox(EWR_AIRPORT_POLYGON);
  const ewrZone = await prisma.regulatoryZone.upsert({
    where: { id: "zone-ewr-airport" },
    create: {
      id: "zone-ewr-airport",
      name: "Newark Liberty International Airport",
      zoneType: "AIRPORT",
      countryCode: "US",
      stateCode: "NJ",
      cityCode: "EWR",
      polygonCoordinates: EWR_AIRPORT_POLYGON,
      boundingBoxMinLat: ewrBox.minLat,
      boundingBoxMaxLat: ewrBox.maxLat,
      boundingBoxMinLng: ewrBox.minLng,
      boundingBoxMaxLng: ewrBox.maxLng,
      isActive: true,
    },
    update: {
      polygonCoordinates: EWR_AIRPORT_POLYGON,
    },
  });

  // Manhattan Congestion Zone
  const manhattanBox = calculateBoundingBox(MANHATTAN_CONGESTION_POLYGON);
  const manhattanZone = await prisma.regulatoryZone.upsert({
    where: { id: "zone-manhattan-congestion" },
    create: {
      id: "zone-manhattan-congestion",
      name: "Manhattan Congestion Zone",
      zoneType: "CONGESTION",
      countryCode: "US",
      stateCode: "NY",
      cityCode: "NYC",
      polygonCoordinates: MANHATTAN_CONGESTION_POLYGON,
      boundingBoxMinLat: manhattanBox.minLat,
      boundingBoxMaxLat: manhattanBox.maxLat,
      boundingBoxMinLng: manhattanBox.minLng,
      boundingBoxMaxLng: manhattanBox.maxLng,
      isActive: true,
    },
    update: {
      polygonCoordinates: MANHATTAN_CONGESTION_POLYGON,
    },
  });

  console.log("[FareEngine] Created 5 regulatory zones");

  // Seed Regulatory Fee Configs
  console.log("[FareEngine] Seeding regulatory fee configurations...");

  // NYC Black Car Fund (2.5%)
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-nyc-bcf" },
    create: {
      id: "fee-nyc-bcf",
      zoneId: nycBcfZone.id,
      feeType: "BLACK_CAR_FUND",
      percentFeeRate: 2.5,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "Black Car Fund",
      description: "NY TLC Black Car Fund contribution",
      isActive: true,
      version: 1,
    },
    update: {
      percentFeeRate: 2.5,
    },
  });

  // NYC Local Tax (1%)
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-nyc-local-tax" },
    create: {
      id: "fee-nyc-local-tax",
      zoneId: nycBcfZone.id,
      feeType: "LOCAL_TAX",
      percentFeeRate: 1.0,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "Local Ride Tax",
      description: "New York City ride tax",
      isActive: true,
      version: 1,
    },
    update: {
      percentFeeRate: 1.0,
    },
  });

  // JFK Airport Fee
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-jfk-airport" },
    create: {
      id: "fee-jfk-airport",
      zoneId: jfkZone.id,
      feeType: "AIRPORT_FEE",
      flatFeeAmount: 5.00,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "JFK Airport Surcharge",
      description: "Airport access fee for JFK",
      isActive: true,
      version: 1,
    },
    update: {
      flatFeeAmount: 5.00,
    },
  });

  // LGA Airport Fee
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-lga-airport" },
    create: {
      id: "fee-lga-airport",
      zoneId: lgaZone.id,
      feeType: "AIRPORT_FEE",
      flatFeeAmount: 5.00,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "LaGuardia Airport Surcharge",
      description: "Airport access fee for LaGuardia",
      isActive: true,
      version: 1,
    },
    update: {
      flatFeeAmount: 5.00,
    },
  });

  // Newark Airport Fee
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-ewr-airport" },
    create: {
      id: "fee-ewr-airport",
      zoneId: ewrZone.id,
      feeType: "AIRPORT_FEE",
      flatFeeAmount: 5.00,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "Newark Airport Surcharge",
      description: "Airport access fee for Newark",
      isActive: true,
      version: 1,
    },
    update: {
      flatFeeAmount: 5.00,
    },
  });

  // Manhattan Congestion Fee
  await prisma.regulatoryFeeConfig.upsert({
    where: { id: "fee-manhattan-congestion" },
    create: {
      id: "fee-manhattan-congestion",
      zoneId: manhattanZone.id,
      feeType: "CONGESTION_FEE",
      flatFeeAmount: 2.75,
      appliesToPickup: true,
      appliesToDropoff: true,
      displayName: "Congestion Surcharge",
      description: "Manhattan congestion zone surcharge",
      isActive: true,
      version: 1,
    },
    update: {
      flatFeeAmount: 2.75,
    },
  });

  console.log("[FareEngine] Created 6 regulatory fee configs");

  // Seed Fee Rules (cancellation, waiting, safety, eco)
  console.log("[FareEngine] Seeding fee rules...");

  const feeRulesData = [
    {
      id: "rule-cancellation-us",
      feeType: "CANCELLATION_FEE" as const,
      flatAmount: 5.00,
      minimumFee: 5.00,
      maximumFee: 10.00,
      requiresDriverAssigned: true,
      minimumMinutesAfterAccept: 2,
      displayName: "Cancellation Fee",
      description: "Fee charged for cancelling after driver is assigned and 2+ minutes have passed",
    },
    {
      id: "rule-waiting-us",
      feeType: "WAITING_FEE" as const,
      perUnitAmount: 0.50,
      unitType: "minute",
      freeUnits: 2,
      minimumFee: 0,
      maximumFee: 15.00,
      displayName: "Waiting Fee",
      description: "Fee for driver wait time beyond 2 free minutes",
    },
    {
      id: "rule-booking-us",
      feeType: "BOOKING_FEE" as const,
      flatAmount: 2.00,
      displayName: "Booking Fee",
      description: "Platform booking fee per ride",
    },
    {
      id: "rule-safety-us",
      feeType: "SAFETY_FEE" as const,
      flatAmount: 1.00,
      displayName: "Safety Fee",
      description: "Contribution to safety initiatives and driver background checks",
    },
    {
      id: "rule-clean-air-us",
      feeType: "CLEAN_AIR_FEE" as const,
      flatAmount: 0.50,
      displayName: "Clean Air Fee",
      description: "Environmental sustainability contribution",
    },
  ];

  for (const rule of feeRulesData) {
    await prisma.feeRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        feeType: rule.feeType,
        countryCode: "US",
        flatAmount: rule.flatAmount,
        perUnitAmount: rule.perUnitAmount,
        unitType: rule.unitType,
        freeUnits: rule.freeUnits,
        minimumFee: rule.minimumFee,
        maximumFee: rule.maximumFee,
        requiresDriverAssigned: rule.requiresDriverAssigned || false,
        minimumMinutesAfterAccept: rule.minimumMinutesAfterAccept,
        displayName: rule.displayName,
        description: rule.description,
        isActive: true,
        version: 1,
      },
      update: {
        displayName: rule.displayName,
        description: rule.description,
      },
    });
  }

  console.log(`[FareEngine] Created ${feeRulesData.length} fee rules`);

  // Seed Toll Configs for NYC area
  console.log("[FareEngine] Seeding toll configurations...");

  const tollConfigs = [
    {
      id: "toll-gw-bridge",
      name: "George Washington Bridge",
      segmentIdentifier: "George Washington Bridge",
      stateCode: "NY",
      tollRates: { saver: 16.00, standard: 16.00, comfort: 16.00, xl: 24.00, premium: 16.00 },
    },
    {
      id: "toll-lincoln-tunnel",
      name: "Lincoln Tunnel",
      segmentIdentifier: "Lincoln Tunnel",
      stateCode: "NJ",
      tollRates: { saver: 16.00, standard: 16.00, comfort: 16.00, xl: 24.00, premium: 16.00 },
    },
    {
      id: "toll-holland-tunnel",
      name: "Holland Tunnel",
      segmentIdentifier: "Holland Tunnel",
      stateCode: "NJ",
      tollRates: { saver: 16.00, standard: 16.00, comfort: 16.00, xl: 24.00, premium: 16.00 },
    },
    {
      id: "toll-verrazano-bridge",
      name: "Verrazzano-Narrows Bridge",
      segmentIdentifier: "Verrazzano-Narrows Bridge",
      stateCode: "NY",
      tollRates: { saver: 6.94, standard: 6.94, comfort: 6.94, xl: 13.88, premium: 6.94 },
    },
    {
      id: "toll-triboro-bridge",
      name: "Robert F. Kennedy Bridge",
      segmentIdentifier: "Robert F. Kennedy Bridge",
      stateCode: "NY",
      tollRates: { saver: 6.94, standard: 6.94, comfort: 6.94, xl: 13.88, premium: 6.94 },
    },
    {
      id: "toll-brooklyn-battery-tunnel",
      name: "Hugh L. Carey Tunnel",
      segmentIdentifier: "Hugh L. Carey Tunnel",
      stateCode: "NY",
      tollRates: { saver: 6.94, standard: 6.94, comfort: 6.94, xl: 13.88, premium: 6.94 },
    },
    {
      id: "toll-queens-midtown-tunnel",
      name: "Queens-Midtown Tunnel",
      segmentIdentifier: "Queens-Midtown Tunnel",
      stateCode: "NY",
      tollRates: { saver: 6.94, standard: 6.94, comfort: 6.94, xl: 13.88, premium: 6.94 },
    },
  ];

  for (const toll of tollConfigs) {
    await prisma.tollConfig.upsert({
      where: { id: toll.id },
      create: {
        id: toll.id,
        name: toll.name,
        countryCode: "US",
        stateCode: toll.stateCode,
        segmentIdentifier: toll.segmentIdentifier,
        alternateIdentifiers: [],
        tollRateSaver: toll.tollRates.saver,
        tollRateStandard: toll.tollRates.standard,
        tollRateComfort: toll.tollRates.comfort,
        tollRateXL: toll.tollRates.xl,
        tollRatePremium: toll.tollRates.premium,
        tollPaidToDriver: true,
        isActive: true,
      },
      update: {
        name: toll.name,
        tollRateSaver: toll.tollRates.saver,
        tollRateStandard: toll.tollRates.standard,
        tollRateComfort: toll.tollRates.comfort,
        tollRateXL: toll.tollRates.xl,
        tollRatePremium: toll.tollRates.premium,
      },
    });
  }

  console.log(`[FareEngine] Created ${tollConfigs.length} toll configs`);
  console.log("[FareEngine] Fare engine seed completed successfully!");
}

// Run the seed
seedFareEngine()
  .catch((e) => {
    console.error("[FareEngine] Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
