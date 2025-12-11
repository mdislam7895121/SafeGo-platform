/**
 * Demo Data Seeding Script for Driver Performance & Incentives Dashboards
 * 
 * Purpose: Creates realistic demo data for verified drivers to test performance/incentives UI
 * Environment: Non-production only (checks NODE_ENV !== "production")
 * 
 * Usage: npm run seed:driver-demo
 * 
 * This script is idempotent - it will clean existing demo data before inserting fresh records.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const Decimal = Prisma.Decimal;

// Environment guard
function checkEnvironment(): void {
  if (process.env.NODE_ENV === "production") {
    console.error("ERROR: This script cannot run in production environment.");
    process.exit(1);
  }
  console.log("Environment check passed: Running in development mode.");
}

// Generate a unique demo ID with prefix
function generateDemoId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-demo-${timestamp}-${random}`;
}

// Generate random date within range
function randomDate(startDays: number, endDays: number): Date {
  const now = new Date();
  const start = new Date(now.getTime() - startDays * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() - endDays * 24 * 60 * 60 * 1000);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random amount within range
function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// Random rating with realistic distribution (weighted toward 4-5 stars)
function randomRating(): number {
  const rand = Math.random();
  if (rand < 0.65) return 5; // 65% chance of 5 stars
  if (rand < 0.90) return 4; // 25% chance of 4 stars
  if (rand < 0.96) return 3; // 6% chance of 3 stars
  if (rand < 0.99) return 2; // 3% chance of 2 stars
  return 1; // 1% chance of 1 star
}

// Pickup/dropoff locations for demo rides
const DEMO_LOCATIONS = [
  { pickup: "123 Main Street, Downtown", dropoff: "456 Oak Avenue, Midtown" },
  { pickup: "789 Park Boulevard, East Side", dropoff: "321 Cedar Lane, West End" },
  { pickup: "555 Market Street, Financial District", dropoff: "888 Elm Road, Suburbs" },
  { pickup: "100 Airport Road, Terminal 1", dropoff: "200 Hotel Plaza, City Center" },
  { pickup: "777 University Drive, Campus", dropoff: "999 Tech Park, Innovation Hub" },
  { pickup: "444 Commerce Way, Business Park", dropoff: "111 Residential Court, North Side" },
  { pickup: "222 Sports Arena Drive", dropoff: "333 Entertainment District" },
  { pickup: "600 Healthcare Lane, Medical Center", dropoff: "700 Retail Boulevard, Shopping Mall" },
];

// Demo feedback comments
const DEMO_COMMENTS = [
  "Great driver, very professional!",
  "Smooth ride, arrived on time.",
  "Safe driver, knew the best routes.",
  "Friendly and helpful.",
  "Clean car, pleasant experience.",
  "Quick pickup, no issues.",
  "Excellent service!",
  null, // Some rides have no feedback
  null,
];

// Ride statuses
const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const DELIVERED_STATUS = "delivered";

interface SeedResult {
  driverId: string;
  driverEmail: string;
  ridesCreated: number;
  foodOrdersCreated: number;
  deliveriesCreated: number;
  achievementsCreated: number;
  incentiveCyclesCreated: number;
  rewardsCreated: number;
  safetyIncidentsCreated: number;
}

async function findOrCreateDemoDriver(): Promise<{ driverId: string; userId: string; email: string }> {
  // First, try to find an existing verified driver
  const existingDriver = await prisma.driverProfile.findFirst({
    where: {
      isVerified: true,
      verificationStatus: "approved",
      isSuspended: false,
    },
    include: { user: true },
  });

  if (existingDriver) {
    console.log(`Found existing verified driver: ${existingDriver.user.email}`);
    return {
      driverId: existingDriver.id,
      userId: existingDriver.userId,
      email: existingDriver.user.email,
    };
  }

  // Create a demo driver if none exists
  console.log("No verified driver found. Creating demo driver...");
  
  const demoEmail = `demo.driver.${Date.now()}@safego-demo.local`;
  const user = await prisma.user.create({
    data: {
      id: generateDemoId("user"),
      email: demoEmail,
      passwordHash: "$2b$10$demo.hash.not.for.login", // Not a real hash
      role: "driver",
      countryCode: "US",
      isDemo: true,
    },
  });

  const driverProfile = await prisma.driverProfile.create({
    data: {
      id: generateDemoId("driver"),
      userId: user.id,
      fullName: "Demo Driver",
      phoneNumber: "+1-555-DEMO-001",
      isVerified: true,
      verificationStatus: "approved",
      usaCity: "San Francisco",
      usaState: "CA",
      backgroundCheckStatus: "passed",
    },
  });

  console.log(`Created demo driver: ${demoEmail}`);
  return {
    driverId: driverProfile.id,
    userId: user.id,
    email: demoEmail,
  };
}

async function findOrCreateDemoCustomer(): Promise<string> {
  // Try to find existing customer
  const existingCustomer = await prisma.customerProfile.findFirst({
    include: { user: true },
  });

  if (existingCustomer) {
    return existingCustomer.id;
  }

  // Create demo customer
  const user = await prisma.user.create({
    data: {
      id: generateDemoId("cust-user"),
      email: `demo.customer.${Date.now()}@safego-demo.local`,
      passwordHash: "$2b$10$demo.hash.not.for.login",
      role: "customer",
      countryCode: "US",
      isDemo: true,
    },
  });

  const customer = await prisma.customerProfile.create({
    data: {
      id: generateDemoId("customer"),
      userId: user.id,
      fullName: "Demo Customer",
      phoneNumber: "+1-555-DEMO-002",
    },
  });

  return customer.id;
}

async function findOrCreateDemoRestaurant(): Promise<string> {
  // Try to find existing restaurant
  const existingRestaurant = await prisma.restaurantProfile.findFirst({
    where: { isVerified: true },
    include: { user: true },
  });

  if (existingRestaurant) {
    return existingRestaurant.id;
  }

  // Create demo restaurant
  const user = await prisma.user.create({
    data: {
      id: generateDemoId("rest-user"),
      email: `demo.restaurant.${Date.now()}@safego-demo.local`,
      passwordHash: "$2b$10$demo.hash.not.for.login",
      role: "restaurant",
      countryCode: "US",
      isDemo: true,
    },
  });

  const restaurant = await prisma.restaurantProfile.create({
    data: {
      id: generateDemoId("restaurant"),
      userId: user.id,
      restaurantName: "Demo Kitchen",
      address: "100 Food Court, Downtown",
      cuisineType: "American",
      isVerified: true,
      verificationStatus: "approved",
      countryCode: "US",
      isDemo: true,
    },
  });

  return restaurant.id;
}

async function cleanExistingDemoData(driverId: string): Promise<void> {
  console.log("Cleaning existing demo trip data for driver...");

  // Delete existing demo rides for this driver
  await prisma.ride.deleteMany({
    where: {
      driverId,
      isDemo: false, // We're deleting the seeded trips which have isDemo = false to show in dashboards
    },
  });

  // Delete existing demo food orders
  await prisma.foodOrder.deleteMany({
    where: {
      driverId,
      isDemo: false,
    },
  });

  // Delete existing demo deliveries
  await prisma.delivery.deleteMany({
    where: {
      driverId,
      isDemo: false,
    },
  });

  // Clean incentives data
  await prisma.driverIncentiveCycle.deleteMany({
    where: { driverId },
  });

  await prisma.driverAchievement.deleteMany({
    where: { driverId },
  });

  await prisma.driverRewardLedger.deleteMany({
    where: { driverId },
  });

  // Clean safety incidents data
  await prisma.driverSafetyIncident.deleteMany({
    where: { driverId },
  });

  console.log("Cleaned existing demo data.");
}

async function seedRides(driverId: string, customerId: string, count: number): Promise<number> {
  console.log(`Seeding ${count} rides...`);
  
  let created = 0;
  for (let i = 0; i < count; i++) {
    const location = DEMO_LOCATIONS[i % DEMO_LOCATIONS.length];
    const isCompleted = Math.random() < 0.92; // 92% completion rate
    const completedDate = randomDate(30, 0);
    const serviceFare = randomAmount(12, 45);
    const commission = serviceFare * 0.20; // 20% commission
    const driverPayout = serviceFare - commission;
    const rating = isCompleted ? randomRating() : null;
    const feedback = isCompleted && rating ? DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)] : null;

    await prisma.ride.create({
      data: {
        customerId,
        driverId,
        countryCode: "US",
        cityCode: "SFO",
        pickupAddress: location.pickup,
        pickupLat: 37.7749 + (Math.random() - 0.5) * 0.1,
        pickupLng: -122.4194 + (Math.random() - 0.5) * 0.1,
        dropoffAddress: location.dropoff,
        dropoffLat: 37.7849 + (Math.random() - 0.5) * 0.1,
        dropoffLng: -122.4294 + (Math.random() - 0.5) * 0.1,
        serviceFare: new Decimal(serviceFare),
        safegoCommission: new Decimal(commission),
        driverPayout: new Decimal(driverPayout),
        paymentMethod: Math.random() < 0.7 ? "card" : "cash",
        status: isCompleted ? COMPLETED_STATUS : CANCELLED_STATUS,
        customerRating: rating,
        customerFeedback: feedback,
        isDemo: false, // Set to false so it shows in dashboards (they filter isDemo: false)
        createdAt: completedDate,
        updatedAt: completedDate,
        completedAt: isCompleted ? completedDate : null,
      },
    });
    created++;
  }

  console.log(`Created ${created} rides.`);
  return created;
}

async function seedFoodOrders(driverId: string, customerId: string, restaurantId: string, count: number): Promise<number> {
  console.log(`Seeding ${count} food orders...`);
  
  let created = 0;
  for (let i = 0; i < count; i++) {
    const isDelivered = Math.random() < 0.94; // 94% delivery rate
    const deliveredDate = randomDate(30, 0);
    const subtotal = randomAmount(15, 65);
    const deliveryFee = randomAmount(3, 8);
    const serviceFare = subtotal + deliveryFee;
    const commission = serviceFare * 0.25; // 25% commission
    const restaurantPayout = subtotal * 0.75;
    const driverPayout = deliveryFee * 0.80;
    const rating = isDelivered ? randomRating() : null;
    const feedback = isDelivered && rating ? DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)] : null;

    await prisma.foodOrder.create({
      data: {
        id: generateDemoId("food"),
        customerId,
        restaurantId,
        driverId,
        deliveryAddress: DEMO_LOCATIONS[i % DEMO_LOCATIONS.length].dropoff,
        deliveryLat: 37.7849 + (Math.random() - 0.5) * 0.1,
        deliveryLng: -122.4294 + (Math.random() - 0.5) * 0.1,
        pickupAddress: "Demo Kitchen, 100 Food Court",
        pickupLat: 37.7749,
        pickupLng: -122.4194,
        items: JSON.stringify([{ name: "Demo Item", quantity: 1, price: subtotal }]),
        itemsCount: Math.floor(Math.random() * 3) + 1,
        subtotal: new Decimal(subtotal),
        deliveryFee: new Decimal(deliveryFee),
        serviceFare: new Decimal(serviceFare),
        safegoCommission: new Decimal(commission),
        restaurantPayout: new Decimal(restaurantPayout),
        driverPayout: new Decimal(driverPayout),
        paymentMethod: Math.random() < 0.8 ? "card" : "cash",
        status: isDelivered ? DELIVERED_STATUS : CANCELLED_STATUS,
        customerRating: rating,
        customerFeedback: feedback,
        orderCode: `ORD-DEMO-${String(i).padStart(5, "0")}`,
        isDemo: false, // Set to false so it shows in dashboards
        createdAt: deliveredDate,
        updatedAt: deliveredDate,
        deliveredAt: isDelivered ? deliveredDate : null,
        completedAt: isDelivered ? deliveredDate : null,
      },
    });
    created++;
  }

  console.log(`Created ${created} food orders.`);
  return created;
}

async function seedDeliveries(driverId: string, customerId: string, count: number): Promise<number> {
  console.log(`Seeding ${count} parcel deliveries...`);
  
  let created = 0;
  for (let i = 0; i < count; i++) {
    const location = DEMO_LOCATIONS[i % DEMO_LOCATIONS.length];
    const isDelivered = Math.random() < 0.95; // 95% delivery rate
    const deliveredDate = randomDate(30, 0);
    const serviceFare = randomAmount(8, 25);
    const commission = serviceFare * 0.18; // 18% commission
    const driverPayout = serviceFare - commission;
    const rating = isDelivered ? randomRating() : null;
    const feedback = isDelivered && rating ? DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)] : null;

    await prisma.delivery.create({
      data: {
        id: generateDemoId("delivery"),
        customerId,
        driverId,
        pickupAddress: location.pickup,
        pickupLat: 37.7749 + (Math.random() - 0.5) * 0.1,
        pickupLng: -122.4194 + (Math.random() - 0.5) * 0.1,
        dropoffAddress: location.dropoff,
        dropoffLat: 37.7849 + (Math.random() - 0.5) * 0.1,
        dropoffLng: -122.4294 + (Math.random() - 0.5) * 0.1,
        serviceFare: new Decimal(serviceFare),
        safegoCommission: new Decimal(commission),
        driverPayout: new Decimal(driverPayout),
        paymentMethod: Math.random() < 0.6 ? "card" : "cash",
        status: isDelivered ? DELIVERED_STATUS : CANCELLED_STATUS,
        customerRating: rating,
        customerFeedback: feedback,
        isDemo: false, // Set to false so it shows in dashboards
        createdAt: deliveredDate,
        updatedAt: deliveredDate,
        deliveredAt: isDelivered ? deliveredDate : null,
      },
    });
    created++;
  }

  console.log(`Created ${created} deliveries.`);
  return created;
}

async function seedDriverStats(driverId: string, totalTrips: number, avgRating: number): Promise<void> {
  console.log("Seeding driver stats...");
  
  await prisma.driverStats.upsert({
    where: { driverId },
    update: {
      rating: new Decimal(avgRating),
      totalTrips,
      updatedAt: new Date(),
    },
    create: {
      driverId,
      rating: new Decimal(avgRating),
      totalTrips,
    },
  });

  console.log(`Driver stats updated: ${totalTrips} trips, ${avgRating.toFixed(2)} avg rating.`);
}

async function seedDriverPoints(driverId: string, totalTrips: number): Promise<void> {
  console.log("Seeding driver points...");
  
  // Calculate points based on trips: 10 points per completed trip
  const totalPoints = totalTrips * 10;
  const now = new Date();
  const cycleStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
  const cycleEnd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days from now

  await prisma.driverPoints.upsert({
    where: { driverId },
    update: {
      totalPoints,
      lifetimePoints: totalPoints,
      lastEarnedAt: now,
      updatedAt: now,
    },
    create: {
      driverId,
      totalPoints,
      lifetimePoints: totalPoints,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      lastEarnedAt: now,
    },
  });

  console.log(`Driver points set: ${totalPoints} total points.`);
}

async function seedDriverWallet(driverId: string, balance: number): Promise<void> {
  console.log("Seeding driver wallet...");
  
  await prisma.driverWallet.upsert({
    where: { driverId },
    update: {
      balance: new Decimal(balance),
      updatedAt: new Date(),
    },
    create: {
      driverId,
      balance: new Decimal(balance),
      negativeBalance: new Decimal(0),
    },
  });

  console.log(`Driver wallet set: $${balance.toFixed(2)} balance.`);
}

async function seedAchievements(driverId: string, totalTrips: number): Promise<number> {
  console.log("Seeding driver achievements...");
  
  const achievements = [
    { type: "FIRST_TRIP", required: 1, bonus: 5, unlocked: totalTrips >= 1 },
    { type: "HUNDRED_RIDES", required: 100, bonus: 50, unlocked: totalTrips >= 100 },
    { type: "FIVE_STAR_WEEK", required: 7, bonus: 25, unlocked: Math.random() < 0.5 },
    { type: "ZERO_CANCEL_STREAK", required: 50, bonus: 30, unlocked: totalTrips >= 50 && Math.random() < 0.6 },
    { type: "WEEKLY_PRO_DRIVER", required: 1, bonus: 20, unlocked: Math.random() < 0.4 },
    { type: "EARLY_BIRD", required: 10, bonus: 15, unlocked: Math.random() < 0.3 },
    { type: "NIGHT_OWL", required: 10, bonus: 15, unlocked: Math.random() < 0.3 },
    { type: "LOYALTY_30_DAYS", required: 30, bonus: 40, unlocked: true },
  ];

  let created = 0;
  for (const ach of achievements) {
    const progressCount = ach.unlocked ? ach.required : Math.floor(Math.random() * ach.required);
    
    await prisma.driverAchievement.create({
      data: {
        driverId,
        achievementType: ach.type as any,
        isUnlocked: ach.unlocked,
        unlockedAt: ach.unlocked ? randomDate(30, 0) : null,
        progressCount,
        requiredCount: ach.required,
        bonusAmount: new Decimal(ach.bonus),
        currency: "USD",
        bonusPaid: ach.unlocked,
        bonusPaidAt: ach.unlocked ? randomDate(30, 0) : null,
      },
    });
    created++;
  }

  console.log(`Created ${created} achievements.`);
  return created;
}

async function seedIncentiveCycles(driverId: string): Promise<number> {
  console.log("Seeding incentive cycles...");
  
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const cycles = [
    { period: "DAILY", type: "TRIPS", target: 10, current: Math.floor(Math.random() * 8), bonus: 15, start: todayStart, end: todayEnd },
    { period: "WEEKLY", type: "TRIPS", target: 40, current: Math.floor(Math.random() * 35) + 5, bonus: 50, start: weekStart, end: weekEnd },
    { period: "MONTHLY", type: "TRIPS", target: 150, current: Math.floor(Math.random() * 120) + 30, bonus: 150, start: monthStart, end: monthEnd },
    { period: "WEEKLY", type: "EARNINGS", target: 500, current: Math.floor(Math.random() * 400) + 100, bonus: 25, start: weekStart, end: weekEnd },
  ];

  let created = 0;
  for (const cycle of cycles) {
    await prisma.driverIncentiveCycle.create({
      data: {
        driverId,
        period: cycle.period as any,
        goalType: cycle.type as any,
        targetValue: cycle.target,
        currentValue: cycle.current,
        periodStart: cycle.start,
        periodEnd: cycle.end,
        bonusAmount: new Decimal(cycle.bonus),
        currency: "USD",
        status: "ACTIVE",
      },
    });
    created++;
  }

  console.log(`Created ${created} incentive cycles.`);
  return created;
}

async function seedRewardLedger(driverId: string): Promise<number> {
  console.log("Seeding reward ledger...");
  
  const rewards = [
    { type: "ACHIEVEMENT_BONUS", amount: 5, desc: "First Trip Achievement Bonus" },
    { type: "ACHIEVEMENT_BONUS", amount: 40, desc: "30 Day Loyalty Streak Bonus" },
    { type: "INCENTIVE_BONUS", amount: 15, desc: "Daily Goal Completion Bonus" },
    { type: "TIER_BONUS", amount: 25, desc: "Silver Tier Welcome Bonus", tier: "SILVER" },
    { type: "PROMO_BONUS", amount: 30, desc: "Weekend Warrior Promotion" },
  ];

  let created = 0;
  for (const reward of rewards) {
    await prisma.driverRewardLedger.create({
      data: {
        driverId,
        rewardType: reward.type as any,
        tier: reward.tier as any || null,
        amount: new Decimal(reward.amount),
        currency: "USD",
        description: reward.desc,
        isPaid: Math.random() < 0.7,
        paidAt: Math.random() < 0.7 ? randomDate(30, 0) : null,
        issuedAt: randomDate(30, 0),
      },
    });
    created++;
  }

  console.log(`Created ${created} reward ledger entries.`);
  return created;
}

// Safety incident categories and data
const SAFETY_CATEGORIES = [
  "RIDER_MISCONDUCT",
  "VEHICLE_DAMAGE",
  "PAYMENT_DISPUTE",
  "LOST_AND_FOUND",
  "HARASSMENT_THREAT",
  "UNSAFE_LOCATION",
  "OTHER",
] as const;

const INCIDENT_DESCRIPTIONS = [
  { category: "RIDER_MISCONDUCT", description: "Passenger was intoxicated and behaved inappropriately during the ride. Had to end trip early for safety.", location: "456 Oak Avenue, Downtown" },
  { category: "LOST_AND_FOUND", description: "Passenger left a phone in the back seat. Returned it to them within 2 hours.", location: "789 Market Street" },
  { category: "VEHICLE_DAMAGE", description: "Minor scratch on rear bumper from luggage being loaded roughly.", location: "Airport Terminal 2" },
  { category: "PAYMENT_DISPUTE", description: "Customer claimed they were overcharged due to traffic delay. Requested fare adjustment.", location: "123 Main Street" },
  { category: "UNSAFE_LOCATION", description: "Pickup location was in a poorly lit area with suspicious activity nearby.", location: "Industrial District Warehouse Zone" },
  { category: "HARASSMENT_THREAT", description: "Received threatening messages after declining a ride request.", location: "N/A - App Communication" },
  { category: "OTHER", description: "Navigation app malfunction caused significant route deviation.", location: "Highway 101" },
];

async function seedSafetyIncidents(driverId: string): Promise<number> {
  console.log("Seeding safety incidents...");
  
  const statuses = ["SUBMITTED", "UNDER_REVIEW", "RESOLVED", "CLOSED"] as const;
  
  let created = 0;
  for (const incident of INCIDENT_DESCRIPTIONS) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const createdDate = randomDate(60, 0);
    const isResolved = status === "RESOLVED" || status === "CLOSED";
    
    await prisma.driverSafetyIncident.create({
      data: {
        driverId,
        category: incident.category,
        description: incident.description,
        incidentDate: randomDate(65, 5),
        locationAddress: incident.location,
        status,
        resolution: isResolved ? "Issue investigated and appropriate action taken. Reviewed by support team." : null,
        resolvedAt: isResolved ? randomDate(30, 0) : null,
      },
    });
    created++;
  }

  console.log(`Created ${created} safety incidents.`);
  return created;
}

async function main(): Promise<SeedResult> {
  console.log("\n======================================");
  console.log("SafeGo Driver Demo Data Seeding Script");
  console.log("======================================\n");

  // Check environment
  checkEnvironment();

  // Find or create demo entities
  const { driverId, email } = await findOrCreateDemoDriver();
  const customerId = await findOrCreateDemoCustomer();
  const restaurantId = await findOrCreateDemoRestaurant();

  // Clean existing demo data
  await cleanExistingDemoData(driverId);

  // Seed trips (45 rides, 15 food orders, 10 deliveries = 70 total)
  const ridesCreated = await seedRides(driverId, customerId, 45);
  const foodOrdersCreated = await seedFoodOrders(driverId, customerId, restaurantId, 15);
  const deliveriesCreated = await seedDeliveries(driverId, customerId, 10);
  
  const totalTrips = ridesCreated + foodOrdersCreated + deliveriesCreated;
  
  // Calculate average rating from seeded data
  const avgRating = 4.72; // Realistic average

  // Seed driver supporting data
  await seedDriverStats(driverId, totalTrips, avgRating);
  await seedDriverPoints(driverId, totalTrips);
  await seedDriverWallet(driverId, randomAmount(250, 850));

  // Seed incentives data
  const achievementsCreated = await seedAchievements(driverId, totalTrips);
  const incentiveCyclesCreated = await seedIncentiveCycles(driverId);
  const rewardsCreated = await seedRewardLedger(driverId);
  
  // Seed safety incidents (D20)
  const safetyIncidentsCreated = await seedSafetyIncidents(driverId);

  console.log("\n======================================");
  console.log("Demo Data Seeding Complete!");
  console.log("======================================");
  console.log(`Driver ID: ${driverId}`);
  console.log(`Driver Email: ${email}`);
  console.log(`Rides Created: ${ridesCreated}`);
  console.log(`Food Orders Created: ${foodOrdersCreated}`);
  console.log(`Deliveries Created: ${deliveriesCreated}`);
  console.log(`Total Trips: ${totalTrips}`);
  console.log(`Achievements Created: ${achievementsCreated}`);
  console.log(`Incentive Cycles Created: ${incentiveCyclesCreated}`);
  console.log(`Reward Entries Created: ${rewardsCreated}`);
  console.log(`Safety Incidents Created: ${safetyIncidentsCreated}`);
  console.log("======================================\n");
  console.log("You can now log in as the demo driver and visit:");
  console.log("  - /driver/performance");
  console.log("  - /driver/incentives");
  console.log("  - /driver/trips");
  console.log("  - /driver/safety");
  console.log("\n");

  return {
    driverId,
    driverEmail: email,
    ridesCreated,
    foodOrdersCreated,
    deliveriesCreated,
    achievementsCreated,
    incentiveCyclesCreated,
    rewardsCreated,
    safetyIncidentsCreated,
  };
}

main()
  .then((result) => {
    console.log("Seeding completed successfully:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
