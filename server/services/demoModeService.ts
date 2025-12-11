import { prisma } from "../db";
import bcrypt from "bcrypt";

type JurisdictionContext = {
  countryCode: string;
  cityCode?: string;
};

type DemoDataSummary = {
  users: number;
  drivers: number;
  customers: number;
  restaurants: number;
  rides: number;
  foodOrders: number;
  deliveries: number;
  wallets: number;
  transactions: number;
  payouts: number;
};

const JURISDICTIONS: JurisdictionContext[] = [
  { countryCode: "US", cityCode: "NYC" },
  { countryCode: "US", cityCode: "SF" },
  { countryCode: "BD", cityCode: "DHA" },
];

const ADDRESSES = {
  NYC: [
    "123 Broadway, New York, NY 10001",
    "456 5th Avenue, New York, NY 10018",
    "789 Madison Ave, New York, NY 10065",
    "321 Park Ave, New York, NY 10022",
    "654 Lexington Ave, New York, NY 10022",
  ],
  SF: [
    "100 Market St, San Francisco, CA 94105",
    "200 Mission St, San Francisco, CA 94105",
    "300 California St, San Francisco, CA 94104",
    "400 Montgomery St, San Francisco, CA 94104",
    "500 Van Ness Ave, San Francisco, CA 94102",
  ],
  DHA: [
    "House 10, Road 5, Dhanmondi, Dhaka 1205",
    "House 20, Road 7, Gulshan-1, Dhaka 1212",
    "House 30, Road 11, Banani, Dhaka 1213",
    "House 40, Road 15, Baridhara, Dhaka 1212",
    "House 50, Road 3, Mirpur DOHS, Dhaka 1216",
  ],
};

const RESTAURANT_NAMES = [
  "Pizza Palace",
  "Burger Junction",
  "Sushi Master",
  "Taco Fiesta",
  "Curry House",
  "BBQ Kingdom",
  "Pasta Paradise",
  "Thai Delight",
];

const PAYMENT_METHODS = ["cash", "card", "mobile_wallet"];

const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomInt = (min: number, max: number): number => 
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomDecimal = (min: number, max: number, decimals: number = 2): string => {
  const value = Math.random() * (max - min) + min;
  return value.toFixed(decimals);
};

const randomDate = (daysAgo: number): Date => {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime);
};

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

async function createDemoUser(
  email: string,
  role: string,
  countryCode: string,
  cityCode?: string
) {
  const passwordHash = await hashPassword("demo123");
  
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      countryCode,
      isDemo: true,
    },
  });

  if (role === "driver") {
    const driverProfile = await prisma.driverProfile.create({
      data: {
        userId: user.id,
        fullName: `Demo Driver ${user.id.substring(0, 6)}`,
        phoneNumber: `+1${randomInt(1000000000, 9999999999)}`,
        district: cityCode || "NYC",
        verificationStatus: "approved",
        isVerified: true,
        securityStatus: "normal",
      },
    });

    await prisma.wallet.create({
      data: {
        ownerId: user.id,
        ownerType: "driver",
        countryCode,
        currency: countryCode === "BD" ? "BDT" : "USD",
        availableBalance: randomDecimal(50, 500),
        negativeBalance: "0.00",
        isDemo: true,
      },
    });

    return { user, profileId: driverProfile.id };
  }

  if (role === "customer") {
    const customerProfile = await prisma.customerProfile.create({
      data: {
        userId: user.id,
        fullName: `Demo Customer ${user.id.substring(0, 6)}`,
        phoneNumber: `+1${randomInt(1000000000, 9999999999)}`,
        verificationStatus: "approved",
        isVerified: true,
        securityStatus: "normal",
      },
    });

    await prisma.wallet.create({
      data: {
        ownerId: user.id,
        ownerType: "customer",
        countryCode,
        currency: countryCode === "BD" ? "BDT" : "USD",
        availableBalance: randomDecimal(0, 100),
        negativeBalance: "0.00",
        isDemo: true,
      },
    });

    return { user, profileId: customerProfile.id };
  }

  if (role === "restaurant") {
    const restaurantProfile = await prisma.restaurantProfile.create({
      data: {
        userId: user.id,
        restaurantName: randomElement(RESTAURANT_NAMES),
        address: randomElement(ADDRESSES[cityCode as keyof typeof ADDRESSES] || ADDRESSES.NYC),
        verificationStatus: "approved",
        isVerified: true,
        securityStatus: "normal",
      },
    });

    await prisma.wallet.create({
      data: {
        ownerId: restaurantProfile.id,
        ownerType: "restaurant",
        countryCode,
        currency: countryCode === "BD" ? "BDT" : "USD",
        availableBalance: randomDecimal(100, 1000),
        negativeBalance: "0.00",
        isDemo: true,
      },
    });

    return { user, profileId: restaurantProfile.id };
  }

  return { user, profileId: user.id };
}

async function createDemoRide(
  customerId: string,
  driverId: string,
  driverUserId: string,
  context: JurisdictionContext,
  createdAt: Date
) {
  const cityAddresses = ADDRESSES[context.cityCode as keyof typeof ADDRESSES] || ADDRESSES.NYC;
  const fare = parseFloat(randomDecimal(15, 50));
  const commission = fare * 0.2;
  const payout = fare - commission;

  const ride = await prisma.ride.create({
    data: {
      id: `ride_${Date.now()}_${randomInt(1000, 9999)}`,
      customerId,
      driverId,
      pickupAddress: randomElement(cityAddresses),
      dropoffAddress: randomElement(cityAddresses),
      serviceFare: fare.toFixed(2),
      safegoCommission: commission.toFixed(2),
      driverPayout: payout.toFixed(2),
      paymentMethod: randomElement(PAYMENT_METHODS),
      status: "completed",
      customerRating: randomInt(3, 5),
      driverRating: randomInt(3, 5),
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
      completedAt: new Date(createdAt.getTime() + randomInt(10, 45) * 60 * 1000),
    },
  });

  const wallet = await prisma.wallet.findFirst({
    where: { ownerId: driverUserId, ownerType: "driver", isDemo: true },
  });

  if (wallet) {
    const newBalance = parseFloat(wallet.availableBalance.toString()) + payout;
    
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { availableBalance: newBalance.toFixed(2) },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        ownerType: "driver",
        countryCode: context.countryCode,
        serviceType: "ride",
        direction: "credit",
        amount: payout.toFixed(2),
        balanceSnapshot: newBalance.toFixed(2),
        negativeBalanceSnapshot: "0.00",
        referenceType: "ride",
        referenceId: ride.id,
        description: `Ride earnings: ${ride.id}`,
        isDemo: true,
        createdAt,
      },
    });
  }

  return ride;
}

async function createDemoFoodOrder(
  customerId: string,
  restaurantId: string,
  driverId: string,
  driverUserId: string,
  context: JurisdictionContext,
  createdAt: Date
) {
  const cityAddresses = ADDRESSES[context.cityCode as keyof typeof ADDRESSES] || ADDRESSES.NYC;
  const fare = parseFloat(randomDecimal(20, 60));
  const commission = fare * 0.15;
  const restaurantPayout = fare * 0.7;
  const driverPayout = fare * 0.15;

  const order = await prisma.foodOrder.create({
    data: {
      id: `food_${Date.now()}_${randomInt(1000, 9999)}`,
      customerId,
      restaurantId,
      driverId,
      deliveryAddress: randomElement(cityAddresses),
      serviceFare: fare.toFixed(2),
      safegoCommission: commission.toFixed(2),
      restaurantPayout: restaurantPayout.toFixed(2),
      driverPayout: driverPayout.toFixed(2),
      paymentMethod: randomElement(PAYMENT_METHODS),
      status: "delivered",
      customerRating: randomInt(3, 5),
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
      deliveredAt: new Date(createdAt.getTime() + randomInt(20, 60) * 60 * 1000),
    },
  });

  const driverWallet = await prisma.wallet.findFirst({
    where: { ownerId: driverUserId, ownerType: "driver", isDemo: true },
  });

  if (driverWallet) {
    const newBalance = parseFloat(driverWallet.availableBalance.toString()) + driverPayout;
    
    await prisma.wallet.update({
      where: { id: driverWallet.id },
      data: { availableBalance: newBalance.toFixed(2) },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: driverWallet.id,
        ownerType: "driver",
        countryCode: context.countryCode,
        serviceType: "food",
        direction: "credit",
        amount: driverPayout.toFixed(2),
        balanceSnapshot: newBalance.toFixed(2),
        negativeBalanceSnapshot: "0.00",
        referenceType: "food_order",
        referenceId: order.id,
        description: `Food delivery earnings: ${order.id}`,
        isDemo: true,
        createdAt,
      },
    });
  }

  const restaurantWallet = await prisma.wallet.findFirst({
    where: { ownerId: restaurantId, ownerType: "restaurant", isDemo: true },
  });

  if (restaurantWallet) {
    const newBalance = parseFloat(restaurantWallet.availableBalance.toString()) + restaurantPayout;
    
    await prisma.wallet.update({
      where: { id: restaurantWallet.id },
      data: { availableBalance: newBalance.toFixed(2) },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: restaurantWallet.id,
        ownerType: "restaurant",
        countryCode: context.countryCode,
        serviceType: "food",
        direction: "credit",
        amount: restaurantPayout.toFixed(2),
        balanceSnapshot: newBalance.toFixed(2),
        negativeBalanceSnapshot: "0.00",
        referenceType: "food_order",
        referenceId: order.id,
        description: `Restaurant earnings: ${order.id}`,
        isDemo: true,
        createdAt,
      },
    });
  }

  return order;
}

async function createDemoDelivery(
  customerId: string,
  driverId: string,
  driverUserId: string,
  context: JurisdictionContext,
  createdAt: Date
) {
  const cityAddresses = ADDRESSES[context.cityCode as keyof typeof ADDRESSES] || ADDRESSES.NYC;
  const fare = parseFloat(randomDecimal(10, 30));
  const commission = fare * 0.2;
  const payout = fare - commission;

  const delivery = await prisma.delivery.create({
    data: {
      id: `delivery_${Date.now()}_${randomInt(1000, 9999)}`,
      customerId,
      driverId,
      pickupAddress: randomElement(cityAddresses),
      dropoffAddress: randomElement(cityAddresses),
      serviceFare: fare.toFixed(2),
      safegoCommission: commission.toFixed(2),
      driverPayout: payout.toFixed(2),
      paymentMethod: randomElement(PAYMENT_METHODS),
      status: "delivered",
      customerRating: randomInt(3, 5),
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
      deliveredAt: new Date(createdAt.getTime() + randomInt(15, 40) * 60 * 1000),
    },
  });

  const wallet = await prisma.wallet.findFirst({
    where: { ownerId: driverUserId, ownerType: "driver", isDemo: true },
  });

  if (wallet) {
    const newBalance = parseFloat(wallet.availableBalance.toString()) + payout;
    
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { availableBalance: newBalance.toFixed(2) },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        ownerType: "driver",
        countryCode: context.countryCode,
        serviceType: "parcel",
        direction: "credit",
        amount: payout.toFixed(2),
        balanceSnapshot: newBalance.toFixed(2),
        negativeBalanceSnapshot: "0.00",
        referenceType: "delivery",
        referenceId: delivery.id,
        description: `Parcel delivery earnings: ${delivery.id}`,
        isDemo: true,
        createdAt,
      },
    });
  }

  return delivery;
}

async function createDemoPayout(
  walletId: string,
  ownerId: string,
  ownerType: "driver" | "restaurant",
  countryCode: string,
  amount: number
): Promise<{ payout: any; transactionCreated: boolean }> {
  const payout = await prisma.payout.create({
    data: {
      walletId,
      countryCode,
      ownerType,
      ownerId,
      amount: amount.toFixed(2),
      method: "auto_weekly",
      status: Math.random() > 0.2 ? "completed" : "pending",
      isDemo: true,
      scheduledAt: randomDate(7),
      processedAt: Math.random() > 0.2 ? randomDate(5) : null,
    },
  });

  let transactionCreated = false;

  if (payout.status === "completed") {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (wallet) {
      const newBalance = Math.max(0, parseFloat(wallet.availableBalance.toString()) - amount);
      await prisma.wallet.update({
        where: { id: walletId },
        data: { availableBalance: newBalance.toFixed(2) },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId,
          ownerType,
          countryCode,
          serviceType: ownerType === "driver" ? "ride" : "food",
          direction: "debit",
          amount: amount.toFixed(2),
          balanceSnapshot: newBalance.toFixed(2),
          negativeBalanceSnapshot: "0.00",
          referenceType: "payout",
          referenceId: payout.id,
          description: `Payout: ${payout.id}`,
          isDemo: true,
        },
      });
      transactionCreated = true;
    }
  }

  return { payout, transactionCreated };
}

export async function enableDemoMode(): Promise<DemoDataSummary> {
  console.log("🚀 Enabling Demo Mode for SafeGo...");

  const summary: DemoDataSummary = {
    users: 0,
    drivers: 0,
    customers: 0,
    restaurants: 0,
    rides: 0,
    foodOrders: 0,
    deliveries: 0,
    wallets: 0,
    transactions: 0,
    payouts: 0,
  };

  for (const jurisdiction of JURISDICTIONS) {
    console.log(`\n📍 Generating demo data for ${jurisdiction.cityCode}, ${jurisdiction.countryCode}...`);

    const driversCount = randomInt(5, 8);
    const customersCount = randomInt(8, 12);
    const restaurantsCount = randomInt(3, 5);

    const drivers: Array<{ userId: string; profileId: string }> = [];
    const customers: Array<{ userId: string; profileId: string }> = [];
    const restaurants: Array<{ userId: string; profileId: string }> = [];

    for (let i = 0; i < driversCount; i++) {
      const result = await createDemoUser(
        `driver${summary.drivers + 1}@demo-${jurisdiction.cityCode}.com`,
        "driver",
        jurisdiction.countryCode,
        jurisdiction.cityCode
      );
      drivers.push({ userId: result.user.id, profileId: result.profileId });
      summary.drivers++;
      summary.users++;
      summary.wallets++;
    }

    for (let i = 0; i < customersCount; i++) {
      const result = await createDemoUser(
        `customer${summary.customers + 1}@demo-${jurisdiction.cityCode}.com`,
        "customer",
        jurisdiction.countryCode,
        jurisdiction.cityCode
      );
      customers.push({ userId: result.user.id, profileId: result.profileId });
      summary.customers++;
      summary.users++;
      summary.wallets++;
    }

    for (let i = 0; i < restaurantsCount; i++) {
      const result = await createDemoUser(
        `restaurant${summary.restaurants + 1}@demo-${jurisdiction.cityCode}.com`,
        "restaurant",
        jurisdiction.countryCode,
        jurisdiction.cityCode
      );
      restaurants.push({ userId: result.user.id, profileId: result.profileId });
      summary.restaurants++;
      summary.users++;
      summary.wallets++;
    }

    const ridesCount = randomInt(15, 20);
    for (let i = 0; i < ridesCount; i++) {
      const customer = randomElement(customers);
      const driver = randomElement(drivers);
      const createdAt = randomDate(90);
      
      await createDemoRide(customer.profileId, driver.profileId, driver.userId, jurisdiction, createdAt);
      summary.rides++;
      summary.transactions++;
    }

    const foodOrdersCount = randomInt(12, 15);
    for (let i = 0; i < foodOrdersCount; i++) {
      const customer = randomElement(customers);
      const restaurant = randomElement(restaurants);
      const driver = randomElement(drivers);
      const createdAt = randomDate(90);
      
      await createDemoFoodOrder(customer.profileId, restaurant.profileId, driver.profileId, driver.userId, jurisdiction, createdAt);
      summary.foodOrders++;
      summary.transactions += 2;
    }

    const deliveriesCount = randomInt(6, 10);
    for (let i = 0; i < deliveriesCount; i++) {
      const customer = randomElement(customers);
      const driver = randomElement(drivers);
      const createdAt = randomDate(90);
      
      await createDemoDelivery(customer.profileId, driver.profileId, driver.userId, jurisdiction, createdAt);
      summary.deliveries++;
      summary.transactions++;
    }

    for (const driver of drivers) {
      const wallet = await prisma.wallet.findFirst({
        where: { ownerId: driver.userId, ownerType: "driver", isDemo: true },
      });
      
      if (wallet && parseFloat(wallet.availableBalance.toString()) > 100) {
        const payoutAmount = parseFloat(randomDecimal(50, 150));
        const result = await createDemoPayout(wallet.id, driver.userId, "driver", jurisdiction.countryCode, payoutAmount);
        summary.payouts++;
        if (result.transactionCreated) {
          summary.transactions++;
        }
      }
    }

    for (const restaurant of restaurants) {
      const wallet = await prisma.wallet.findFirst({
        where: { ownerId: restaurant.profileId, ownerType: "restaurant", isDemo: true },
      });
      
      if (wallet && parseFloat(wallet.availableBalance.toString()) > 200) {
        const payoutAmount = parseFloat(randomDecimal(100, 300));
        const result = await createDemoPayout(wallet.id, restaurant.profileId, "restaurant", jurisdiction.countryCode, payoutAmount);
        summary.payouts++;
        if (result.transactionCreated) {
          summary.transactions++;
        }
      }
    }
  }

  console.log("\n✅ Demo Mode enabled successfully!");
  console.log("\n📊 Summary:");
  console.log(`   Users: ${summary.users}`);
  console.log(`   Drivers: ${summary.drivers}`);
  console.log(`   Customers: ${summary.customers}`);
  console.log(`   Restaurants: ${summary.restaurants}`);
  console.log(`   Rides: ${summary.rides}`);
  console.log(`   Food Orders: ${summary.foodOrders}`);
  console.log(`   Deliveries: ${summary.deliveries}`);
  console.log(`   Wallets: ${summary.wallets}`);
  console.log(`   Transactions: ${summary.transactions}`);
  console.log(`   Payouts: ${summary.payouts}`);

  return summary;
}

export async function clearDemoMode(): Promise<void> {
  console.log("🧹 Clearing all demo data...");

  await prisma.$transaction(async (tx) => {
    await tx.walletTransaction.deleteMany({ where: { isDemo: true } });
    await tx.payout.deleteMany({ where: { isDemo: true } });
    await tx.wallet.deleteMany({ where: { isDemo: true } });
    await tx.delivery.deleteMany({ where: { isDemo: true } });
    await tx.foodOrder.deleteMany({ where: { isDemo: true } });
    await tx.ride.deleteMany({ where: { isDemo: true } });
    await tx.restaurantProfile.deleteMany({
      where: { user: { isDemo: true } },
    });
    await tx.customerProfile.deleteMany({
      where: { user: { isDemo: true } },
    });
    await tx.driverProfile.deleteMany({
      where: { user: { isDemo: true } },
    });
    await tx.user.deleteMany({ where: { isDemo: true } });
  });

  console.log("✅ All demo data cleared successfully!");
}
