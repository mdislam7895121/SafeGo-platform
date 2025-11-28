/**
 * Promotion Engine Seed Data
 * 
 * Seeds promo configurations and low-demand zones for the USA market.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPromoConfigs() {
  console.log("[Seed] Seeding promo configurations...");

  const promoConfigs = [
    {
      promoType: "ANCHOR_ONLY" as const,
      countryCode: "US",
      name: "Promo Applied",
      displayTag: "Promo Applied",
      description: "Psychological anchor pricing - shows perceived savings",
      anchorMultiplier: 1.10,
      discountPercent: null,
      discountMaxAmount: null,
      discountMinFare: 5.00,
      priority: 0,
      stackable: true,
    },
    {
      promoType: "SAVER" as const,
      countryCode: "US",
      name: "Saver Discount",
      displayTag: "Saver",
      description: "Save by waiting a little longer for your ride",
      anchorMultiplier: 1.10,
      discountPercent: 3.00,
      discountMaxAmount: 5.00,
      discountMinFare: 5.00,
      maxSurgeAllowed: 1.30,
      priority: 10,
      stackable: false,
    },
    {
      promoType: "FIRST_RIDE" as const,
      countryCode: "US",
      name: "Welcome Discount",
      displayTag: "First Ride",
      description: "Welcome discount - limited to your first ride",
      anchorMultiplier: 1.10,
      discountPercent: 8.00,
      discountMaxAmount: 7.00,
      discountMinFare: 5.00,
      maxSurgeAllowed: 1.30,
      maxUsesPerUser: 1,
      priority: 100,
      stackable: false,
    },
    {
      promoType: "TIME_BASED" as const,
      countryCode: "US",
      name: "Off-Peak Discount",
      displayTag: "Off-Peak",
      description: "Discounted rides during off-peak hours",
      anchorMultiplier: 1.10,
      discountPercent: 4.00,
      discountMaxAmount: 5.00,
      discountMinFare: 5.00,
      validDaysOfWeek: [1, 2, 3, 4, 5],
      validStartHour: 10,
      validEndHour: 15,
      maxSurgeAllowed: 1.20,
      priority: 20,
      stackable: false,
    },
    {
      promoType: "LOCATION_BASED" as const,
      countryCode: "US",
      name: "Zone Discount",
      displayTag: "Zone Deal",
      description: "Special discount for low-demand areas",
      anchorMultiplier: 1.10,
      discountPercent: 2.50,
      discountMaxAmount: 4.00,
      discountMinFare: 5.00,
      maxSurgeAllowed: 1.30,
      priority: 15,
      stackable: false,
    },
    {
      promoType: "PAYMENT_METHOD" as const,
      countryCode: "US",
      name: "Wallet Bonus",
      displayTag: "Wallet",
      description: "Pay with SafeGo Wallet and save",
      anchorMultiplier: 1.10,
      discountPercent: 2.00,
      discountMaxAmount: 3.00,
      discountMinFare: 5.00,
      walletOnly: true,
      priority: 5,
      stackable: true,
    },
    {
      promoType: "REWARD_POINTS" as const,
      countryCode: "US",
      name: "SafeGo Points",
      displayTag: "Points",
      description: "Earn 1 point per $1 spent. 100 points = $1 credit",
      anchorMultiplier: 1.10,
      discountPercent: null,
      discountMaxAmount: null,
      discountMinFare: null,
      priority: 1,
      stackable: true,
    },
    {
      promoType: "DRIVER_ARRIVAL" as const,
      countryCode: "US",
      name: "Arrival Credit",
      displayTag: "Arrival Credit",
      description: "$1 credit if driver arrives late",
      anchorMultiplier: 1.00,
      discountPercent: null,
      discountMaxAmount: 1.00,
      discountMinFare: null,
      priority: 0,
      stackable: true,
    },
  ];

  for (const config of promoConfigs) {
    const existing = await prisma.promoConfig.findFirst({
      where: {
        promoType: config.promoType,
        countryCode: config.countryCode,
        cityCode: null,
      },
    });

    if (existing) {
      await prisma.promoConfig.update({
        where: { id: existing.id },
        data: {
          name: config.name,
          displayTag: config.displayTag,
          description: config.description,
          anchorMultiplier: config.anchorMultiplier,
          discountPercent: config.discountPercent,
          discountMaxAmount: config.discountMaxAmount,
          discountMinFare: config.discountMinFare,
          validDaysOfWeek: (config as any).validDaysOfWeek || [],
          validStartHour: (config as any).validStartHour || null,
          validEndHour: (config as any).validEndHour || null,
          maxUsesPerUser: (config as any).maxUsesPerUser || null,
          maxSurgeAllowed: (config as any).maxSurgeAllowed || 1.30,
          walletOnly: (config as any).walletOnly || false,
          priority: config.priority,
          stackable: config.stackable,
          isActive: true,
        },
      });
    } else {
      await prisma.promoConfig.create({
        data: {
          promoType: config.promoType,
          countryCode: config.countryCode,
          name: config.name,
          displayTag: config.displayTag,
          description: config.description,
          anchorMultiplier: config.anchorMultiplier,
          discountPercent: config.discountPercent,
          discountMaxAmount: config.discountMaxAmount,
          discountMinFare: config.discountMinFare,
          validDaysOfWeek: (config as any).validDaysOfWeek || [],
          validStartHour: (config as any).validStartHour || null,
          validEndHour: (config as any).validEndHour || null,
          maxUsesPerUser: (config as any).maxUsesPerUser || null,
          maxSurgeAllowed: (config as any).maxSurgeAllowed || 1.30,
          walletOnly: (config as any).walletOnly || false,
          priority: config.priority,
          stackable: config.stackable,
          isActive: true,
        },
      });
    }
  }

  console.log(`[Seed] Created/updated ${promoConfigs.length} promo configurations`);
}

async function seedLowDemandZones() {
  console.log("[Seed] Seeding low-demand zones...");

  const lowDemandZones = [
    {
      name: "Staten Island South",
      countryCode: "US",
      cityCode: "NYC",
      polygonCoordinates: [
        { lat: 40.4950, lng: -74.2500 },
        { lat: 40.5200, lng: -74.1500 },
        { lat: 40.5500, lng: -74.1500 },
        { lat: 40.5500, lng: -74.2500 },
        { lat: 40.4950, lng: -74.2500 },
      ],
      boundingBoxMinLat: 40.4950,
      boundingBoxMaxLat: 40.5500,
      boundingBoxMinLng: -74.2500,
      boundingBoxMaxLng: -74.1500,
      discountPercent: 3.00,
      demandLevel: 25,
    },
    {
      name: "Far Rockaway",
      countryCode: "US",
      cityCode: "NYC",
      polygonCoordinates: [
        { lat: 40.5800, lng: -73.8200 },
        { lat: 40.6100, lng: -73.7500 },
        { lat: 40.5900, lng: -73.7200 },
        { lat: 40.5600, lng: -73.8000 },
        { lat: 40.5800, lng: -73.8200 },
      ],
      boundingBoxMinLat: 40.5600,
      boundingBoxMaxLat: 40.6100,
      boundingBoxMinLng: -73.8200,
      boundingBoxMaxLng: -73.7200,
      discountPercent: 2.50,
      demandLevel: 30,
    },
    {
      name: "Eastern Queens",
      countryCode: "US",
      cityCode: "NYC",
      polygonCoordinates: [
        { lat: 40.7300, lng: -73.7600 },
        { lat: 40.7800, lng: -73.7000 },
        { lat: 40.7600, lng: -73.6800 },
        { lat: 40.7100, lng: -73.7400 },
        { lat: 40.7300, lng: -73.7600 },
      ],
      boundingBoxMinLat: 40.7100,
      boundingBoxMaxLat: 40.7800,
      boundingBoxMinLng: -73.7600,
      boundingBoxMaxLng: -73.6800,
      discountPercent: 2.00,
      demandLevel: 40,
    },
    {
      name: "North Bronx",
      countryCode: "US",
      cityCode: "NYC",
      polygonCoordinates: [
        { lat: 40.8800, lng: -73.8800 },
        { lat: 40.9100, lng: -73.8300 },
        { lat: 40.9000, lng: -73.8000 },
        { lat: 40.8700, lng: -73.8500 },
        { lat: 40.8800, lng: -73.8800 },
      ],
      boundingBoxMinLat: 40.8700,
      boundingBoxMaxLat: 40.9100,
      boundingBoxMinLng: -73.8800,
      boundingBoxMaxLng: -73.8000,
      discountPercent: 2.00,
      demandLevel: 35,
    },
  ];

  for (const zone of lowDemandZones) {
    const existing = await prisma.lowDemandZone.findFirst({
      where: {
        name: zone.name,
        countryCode: zone.countryCode,
      },
    });

    if (existing) {
      await prisma.lowDemandZone.update({
        where: { id: existing.id },
        data: {
          polygonCoordinates: zone.polygonCoordinates,
          boundingBoxMinLat: zone.boundingBoxMinLat,
          boundingBoxMaxLat: zone.boundingBoxMaxLat,
          boundingBoxMinLng: zone.boundingBoxMinLng,
          boundingBoxMaxLng: zone.boundingBoxMaxLng,
          discountPercent: zone.discountPercent,
          demandLevel: zone.demandLevel,
          isActive: true,
        },
      });
    } else {
      await prisma.lowDemandZone.create({
        data: zone,
      });
    }
  }

  console.log(`[Seed] Created/updated ${lowDemandZones.length} low-demand zones`);
}

export async function seedPromotionEngine() {
  try {
    await seedPromoConfigs();
    await seedLowDemandZones();
    console.log("[Seed] Promotion engine seeding complete!");
  } catch (error) {
    console.error("[Seed] Failed to seed promotion engine:", error);
    throw error;
  }
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedPromotionEngine()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
