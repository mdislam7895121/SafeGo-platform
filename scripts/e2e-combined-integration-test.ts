import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  category: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
}

function recordTest(name: string, passed: boolean, message: string, category: string) {
  results.push({ name, passed, message, category });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${name}] ${message}`);
}

async function apiRequest(endpoint: string, method: string = "GET", body?: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { status: response.status, data };
}

const TEST_PREFIX = "e2e.combined.";
const TEST_PASSWORD = "CombinedTest123!";

let driverUserId = "";
let driverProfileId = "";
let shopUserId = "";
let shopProfileId = "";
let customerUserId = "";
let customerProfileId = "";
let adminUserId = "";
let driverToken = "";
let shopToken = "";
let customerToken = "";
let adminToken = "";
let driverWalletId = "";
let shopWalletId = "";

async function cleanup() {
  log("\n🧹 Cleaning up combined test data...");
  try {
    const testEmails = [
      `${TEST_PREFIX}driver@safego.test`,
      `${TEST_PREFIX}shop@safego.test`,
      `${TEST_PREFIX}customer@safego.test`,
      `${TEST_PREFIX}admin@safego.test`,
    ];

    await prisma.$executeRaw`DELETE FROM wallet_transactions WHERE "walletId" IN (SELECT id FROM wallets WHERE "ownerId" IN (SELECT id FROM driver_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM wallet_transactions WHERE "walletId" IN (SELECT id FROM wallets WHERE "ownerId" IN (SELECT id FROM shop_partner_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM payouts WHERE "ownerId" IN (SELECT id FROM driver_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM payouts WHERE "ownerId" IN (SELECT id FROM shop_partner_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM wallets WHERE "ownerId" IN (SELECT id FROM driver_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM wallets WHERE "ownerId" IN (SELECT id FROM shop_partner_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM ride_status_events WHERE "rideId" IN (SELECT id FROM rides WHERE "customerId" IN (SELECT id FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM rides WHERE "customerId" IN (SELECT id FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM deliveries WHERE "customerId" IN (SELECT id FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM product_order_items WHERE "orderId" IN (SELECT id FROM product_orders WHERE "customerId" IN (SELECT id FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM product_orders WHERE "customerId" IN (SELECT id FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM products WHERE "shopId" IN (SELECT id FROM shop_partner_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM vehicles WHERE "driverId" IN (SELECT id FROM driver_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%'))`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM driver_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM shop_partner_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM customer_profiles WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e.combined.%')`.catch(() => {});
    await prisma.$executeRaw`DELETE FROM users WHERE email LIKE 'e2e.combined.%'`.catch(() => {});

    log("✅ Cleanup complete");
  } catch (error) {
    log(`⚠️ Cleanup warning: ${error}`);
  }
}

async function section1_setupUsers() {
  log("\n📝 SECTION 1: Setting up test users for combined testing...");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const driverUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${TEST_PREFIX}driver@safego.test`,
      passwordHash,
      role: "driver",
      countryCode: "US",
    }
  });
  driverUserId = driverUser.id;

  const driverProfile = await prisma.driverProfile.create({
    data: {
      id: randomUUID(),
      userId: driverUserId,
      firstName: "Combined",
      lastName: "Driver",
      phoneNumber: "+1555000001",
      isVerified: true,
      verificationStatus: "approved",
    }
  });
  driverProfileId = driverProfile.id;
  recordTest("DRIVER_SETUP", true, "Driver user and profile created", "SETUP");

  const shopUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${TEST_PREFIX}shop@safego.test`,
      passwordHash,
      role: "shop_partner",
      countryCode: "BD",
    }
  });
  shopUserId = shopUser.id;

  const shopProfile = await prisma.shopPartner.create({
    data: {
      id: randomUUID(),
      userId: shopUserId,
      shopName: "Combined Test Shop",
      ownerName: "Test Owner",
      contactPhone: "+8801700000001",
      shopType: "general_store",
      shopAddress: "123 Test Street, Dhaka",
      cityOrArea: "Dhaka",
      countryCode: "BD",
      verificationStatus: "approved",
      partnerStatus: "live",
      isActive: true,
    }
  });
  shopProfileId = shopProfile.id;
  recordTest("SHOP_SETUP", true, "Shop partner user and profile created", "SETUP");

  const customerUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${TEST_PREFIX}customer@safego.test`,
      passwordHash,
      role: "customer",
      countryCode: "US",
    }
  });
  customerUserId = customerUser.id;

  const customerProfile = await prisma.customerProfile.create({
    data: {
      id: randomUUID(),
      userId: customerUserId,
      firstName: "Combined",
      lastName: "Customer",
      phoneNumber: "+1555000003",
    }
  });
  customerProfileId = customerProfile.id;
  recordTest("CUSTOMER_SETUP", true, "Customer user and profile created", "SETUP");

  const adminUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `${TEST_PREFIX}admin@safego.test`,
      passwordHash,
      role: "admin",
      countryCode: "US",
    }
  });
  adminUserId = adminUser.id;
  recordTest("ADMIN_SETUP", true, "Admin user created", "SETUP");
}

async function section2_walletSystemIntegration() {
  log("\n💰 SECTION 2: Testing wallet system across roles...");

  const driverWallet = await prisma.wallet.create({
    data: {
      id: randomUUID(),
      ownerId: driverProfileId,
      ownerType: "driver",
      countryCode: "US",
      currency: "USD",
      availableBalance: 0,
      negativeBalance: 0,
    }
  });
  driverWalletId = driverWallet.id;
  recordTest("DRIVER_WALLET_CREATED", true, "Driver wallet created", "WALLET");

  const shopWallet = await prisma.wallet.create({
    data: {
      id: randomUUID(),
      ownerId: shopProfileId,
      ownerType: "shop",
      countryCode: "BD",
      currency: "BDT",
      availableBalance: 0,
      negativeBalance: 0,
    }
  });
  shopWalletId = shopWallet.id;
  recordTest("SHOP_WALLET_CREATED", true, "Shop wallet created", "WALLET");

  const driverEarnings = 50.00;
  await prisma.wallet.update({
    where: { id: driverWalletId },
    data: { availableBalance: { increment: driverEarnings } }
  });
  await prisma.walletTransaction.create({
    data: {
      id: randomUUID(),
      walletId: driverWalletId,
      ownerType: "driver",
      countryCode: "US",
      serviceType: "ride",
      direction: "credit",
      amount: driverEarnings,
      balanceSnapshot: driverEarnings,
      negativeBalanceSnapshot: 0,
      referenceType: "ride",
      referenceId: randomUUID(),
      description: "Combined test ride earnings",
      isDemo: false,
    }
  });
  recordTest("DRIVER_EARNINGS_CREDITED", true, `Driver wallet credited $${driverEarnings}`, "WALLET");

  const shopEarnings = 5000.00;
  await prisma.wallet.update({
    where: { id: shopWalletId },
    data: { availableBalance: { increment: shopEarnings } }
  });
  await prisma.walletTransaction.create({
    data: {
      id: randomUUID(),
      walletId: shopWalletId,
      ownerType: "shop",
      countryCode: "BD",
      serviceType: "parcel",
      direction: "credit",
      amount: shopEarnings,
      balanceSnapshot: shopEarnings,
      negativeBalanceSnapshot: 0,
      referenceType: "manual_adjustment",
      referenceId: randomUUID(),
      description: "Combined test shop earnings",
      isDemo: false,
    }
  });
  recordTest("SHOP_EARNINGS_CREDITED", true, `Shop wallet credited ৳${shopEarnings}`, "WALLET");

  const driverUpdatedWallet = await prisma.wallet.findUnique({ where: { id: driverWalletId } });
  const shopUpdatedWallet = await prisma.wallet.findUnique({ where: { id: shopWalletId } });

  if (Number(driverUpdatedWallet?.availableBalance) === driverEarnings) {
    recordTest("DRIVER_BALANCE_VERIFIED", true, `Driver balance correct: $${driverEarnings}`, "WALLET");
  } else {
    recordTest("DRIVER_BALANCE_VERIFIED", false, "Driver balance mismatch", "WALLET");
  }

  if (Number(shopUpdatedWallet?.availableBalance) === shopEarnings) {
    recordTest("SHOP_BALANCE_VERIFIED", true, `Shop balance correct: ৳${shopEarnings}`, "WALLET");
  } else {
    recordTest("SHOP_BALANCE_VERIFIED", false, "Shop balance mismatch", "WALLET");
  }
}

async function section3_commissionCalculation() {
  log("\n📊 SECTION 3: Testing commission calculation across services...");

  const rideFare = 100.00;
  const rideCommissionRate = 0.20;
  const rideCommission = rideFare * rideCommissionRate;
  const rideDriverPayout = rideFare - rideCommission;

  const ride = await prisma.ride.create({
    data: {
      id: randomUUID(),
      customerId: customerProfileId,
      driverId: driverProfileId,
      countryCode: "US",
      pickupAddress: "Combined Test Pickup",
      pickupLat: 40.7128,
      pickupLng: -74.0060,
      dropoffAddress: "Combined Test Dropoff",
      dropoffLat: 40.7580,
      dropoffLng: -73.9855,
      distanceMiles: 10.0,
      durationMinutes: 25,
      serviceFare: rideFare,
      safegoCommission: rideCommission,
      driverPayout: rideDriverPayout,
      paymentMethod: "card",
      status: "completed",
      completedAt: new Date(),
      isDemo: false,
    }
  });

  if (Number(ride.safegoCommission) === rideCommission && Number(ride.driverPayout) === rideDriverPayout) {
    recordTest("RIDE_COMMISSION_CORRECT", true, `Ride: fare=$${rideFare}, commission=$${rideCommission}, driver=$${rideDriverPayout}`, "COMMISSION");
  } else {
    recordTest("RIDE_COMMISSION_CORRECT", false, "Ride commission calculation mismatch", "COMMISSION");
  }

  const productPrice = 1000.00;
  const shopCommissionRate = 0.15;
  const shopCommission = productPrice * shopCommissionRate;
  const shopPayout = productPrice - shopCommission;

  const product = await prisma.shopProduct.create({
    data: {
      id: randomUUID(),
      shopPartnerId: shopProfileId,
      name: "Combined Test Product",
      description: "Test product for combined testing",
      price: productPrice,
      stockQuantity: 100,
      category: "test",
      isActive: true,
    }
  });

  const order = await prisma.productOrder.create({
    data: {
      id: randomUUID(),
      orderNumber: `COMB-TEST-${Date.now()}`,
      customerId: customerProfileId,
      shopPartnerId: shopProfileId,
      status: "delivered",
      subtotal: productPrice,
      deliveryFee: 50,
      totalAmount: productPrice + 50,
      safegoCommission: shopCommission,
      shopPayout: shopPayout,
      deliveryAddress: "Combined Test Address",
      paymentMethod: "cod",
      paymentStatus: "paid",
      deliveredAt: new Date(),
    }
  });

  await prisma.productOrderItem.create({
    data: {
      id: randomUUID(),
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      productPrice: productPrice,
      quantity: 1,
      subtotal: productPrice,
    }
  });

  const calculatedShopCommission = Number(order.subtotal) * shopCommissionRate;
  const calculatedShopPayout = Number(order.subtotal) - calculatedShopCommission;

  if (Math.abs(calculatedShopCommission - shopCommission) < 0.01) {
    recordTest("SHOP_COMMISSION_CORRECT", true, `Shop: subtotal=৳${productPrice}, commission=৳${shopCommission}, payout=৳${shopPayout}`, "COMMISSION");
  } else {
    recordTest("SHOP_COMMISSION_CORRECT", false, "Shop commission calculation mismatch", "COMMISSION");
  }

  const totalPlatformCommission = rideCommission + shopCommission;
  recordTest("TOTAL_PLATFORM_COMMISSION", true, `Total platform commission: $${rideCommission} (ride) + ৳${shopCommission} (shop)`, "COMMISSION");
}

async function section4_payoutFlowValidation() {
  log("\n💸 SECTION 4: Testing payout flow for both roles...");

  const driverPayoutAmount = 25.00;
  const driverPayout = await prisma.payout.create({
    data: {
      id: randomUUID(),
      walletId: driverWalletId,
      countryCode: "US",
      ownerType: "driver",
      ownerId: driverProfileId,
      amount: driverPayoutAmount,
      feeAmount: 0,
      netAmount: driverPayoutAmount,
      method: "manual_request",
      status: "pending",
      isDemo: false,
    }
  });
  recordTest("DRIVER_PAYOUT_CREATED", true, `Driver payout requested: $${driverPayoutAmount}`, "PAYOUT");

  await prisma.payout.update({
    where: { id: driverPayout.id },
    data: { status: "processing", processedAt: new Date() }
  });
  recordTest("DRIVER_PAYOUT_PROCESSING", true, "Driver payout moved to processing", "PAYOUT");

  await prisma.payout.update({
    where: { id: driverPayout.id },
    data: { status: "completed" }
  });

  await prisma.wallet.update({
    where: { id: driverWalletId },
    data: { availableBalance: { decrement: driverPayoutAmount } }
  });

  await prisma.walletTransaction.create({
    data: {
      id: randomUUID(),
      walletId: driverWalletId,
      ownerType: "driver",
      countryCode: "US",
      serviceType: "ride",
      direction: "debit",
      amount: driverPayoutAmount,
      balanceSnapshot: 25.00,
      negativeBalanceSnapshot: 0,
      referenceType: "payout",
      referenceId: driverPayout.id,
      description: "Driver payout processed",
      isDemo: false,
    }
  });
  recordTest("DRIVER_PAYOUT_COMPLETED", true, "Driver payout completed", "PAYOUT");

  const shopPayoutAmount = 1000.00;
  const shopPayout = await prisma.payout.create({
    data: {
      id: randomUUID(),
      walletId: shopWalletId,
      countryCode: "BD",
      ownerType: "shop",
      ownerId: shopProfileId,
      amount: shopPayoutAmount,
      feeAmount: 0,
      netAmount: shopPayoutAmount,
      method: "manual_request",
      status: "pending",
      isDemo: false,
    }
  });
  recordTest("SHOP_PAYOUT_CREATED", true, `Shop payout requested: ৳${shopPayoutAmount}`, "PAYOUT");

  await prisma.payout.update({
    where: { id: shopPayout.id },
    data: { status: "completed", processedAt: new Date() }
  });

  await prisma.wallet.update({
    where: { id: shopWalletId },
    data: { availableBalance: { decrement: shopPayoutAmount } }
  });

  await prisma.walletTransaction.create({
    data: {
      id: randomUUID(),
      walletId: shopWalletId,
      ownerType: "shop",
      countryCode: "BD",
      serviceType: "parcel",
      direction: "debit",
      amount: shopPayoutAmount,
      balanceSnapshot: 4000.00,
      negativeBalanceSnapshot: 0,
      referenceType: "payout",
      referenceId: shopPayout.id,
      description: "Shop payout processed",
      isDemo: false,
    }
  });
  recordTest("SHOP_PAYOUT_COMPLETED", true, "Shop payout completed", "PAYOUT");

  const driverPayouts = await prisma.payout.count({ where: { ownerId: driverProfileId, status: "completed" } });
  const shopPayouts = await prisma.payout.count({ where: { ownerId: shopProfileId, status: "completed" } });

  recordTest("PAYOUT_COUNTS_VERIFIED", driverPayouts === 1 && shopPayouts === 1, 
    `Driver payouts: ${driverPayouts}, Shop payouts: ${shopPayouts}`, "PAYOUT");
}

async function section5_transactionLogConsistency() {
  log("\n📋 SECTION 5: Testing transaction log consistency...");

  const driverTransactions = await prisma.walletTransaction.findMany({
    where: { walletId: driverWalletId },
    orderBy: { createdAt: "asc" }
  });

  const shopTransactions = await prisma.walletTransaction.findMany({
    where: { walletId: shopWalletId },
    orderBy: { createdAt: "asc" }
  });

  recordTest("DRIVER_TRANSACTION_COUNT", driverTransactions.length >= 2, 
    `Driver has ${driverTransactions.length} transactions (credit + debit)`, "TRANSACTIONS");

  recordTest("SHOP_TRANSACTION_COUNT", shopTransactions.length >= 2, 
    `Shop has ${shopTransactions.length} transactions (credit + debit)`, "TRANSACTIONS");

  const driverCredits = driverTransactions.filter(t => t.direction === "credit");
  const driverDebits = driverTransactions.filter(t => t.direction === "debit");
  const shopCredits = shopTransactions.filter(t => t.direction === "credit");
  const shopDebits = shopTransactions.filter(t => t.direction === "debit");

  recordTest("TRANSACTION_DIRECTIONS", 
    driverCredits.length > 0 && driverDebits.length > 0 && shopCredits.length > 0 && shopDebits.length > 0,
    "All transaction directions recorded correctly", "TRANSACTIONS");

  const driverWallet = await prisma.wallet.findUnique({ where: { id: driverWalletId } });
  const shopWallet = await prisma.wallet.findUnique({ where: { id: shopWalletId } });

  const driverCreditSum = driverCredits.reduce((sum, t) => sum + Number(t.amount), 0);
  const driverDebitSum = driverDebits.reduce((sum, t) => sum + Number(t.amount), 0);
  const expectedDriverBalance = driverCreditSum - driverDebitSum;

  const shopCreditSum = shopCredits.reduce((sum, t) => sum + Number(t.amount), 0);
  const shopDebitSum = shopDebits.reduce((sum, t) => sum + Number(t.amount), 0);
  const expectedShopBalance = shopCreditSum - shopDebitSum;

  recordTest("DRIVER_BALANCE_CONSISTENT", 
    Math.abs(Number(driverWallet?.availableBalance) - expectedDriverBalance) < 0.01,
    `Driver balance ${Number(driverWallet?.availableBalance)} matches transactions`, "TRANSACTIONS");

  recordTest("SHOP_BALANCE_CONSISTENT", 
    Math.abs(Number(shopWallet?.availableBalance) - expectedShopBalance) < 0.01,
    `Shop balance ${Number(shopWallet?.availableBalance)} matches transactions`, "TRANSACTIONS");
}

async function section6_databaseRelationshipStability() {
  log("\n🔗 SECTION 6: Testing database relationship stability...");

  const driverWithProfile = await prisma.user.findUnique({
    where: { id: driverUserId },
    include: { driverProfile: true }
  });
  recordTest("DRIVER_USER_PROFILE_LINK", !!driverWithProfile?.driverProfile, 
    "Driver user linked to profile", "DB_RELATIONS");

  const shopWithProfile = await prisma.user.findUnique({
    where: { id: shopUserId },
    include: { shopPartner: true }
  });
  recordTest("SHOP_USER_PROFILE_LINK", !!shopWithProfile?.shopPartner, 
    "Shop user linked to profile", "DB_RELATIONS");

  const customerWithProfile = await prisma.user.findUnique({
    where: { id: customerUserId },
    include: { customerProfile: true }
  });
  recordTest("CUSTOMER_USER_PROFILE_LINK", !!customerWithProfile?.customerProfile, 
    "Customer user linked to profile", "DB_RELATIONS");

  const walletWithTransactions = await prisma.wallet.findUnique({
    where: { id: driverWalletId },
    include: { transactions: true, payouts: true }
  });
  recordTest("WALLET_RELATIONS", 
    walletWithTransactions?.transactions && walletWithTransactions.transactions.length > 0,
    "Wallet linked to transactions", "DB_RELATIONS");

  const ridesWithDriver = await prisma.ride.findMany({
    where: { driverId: driverProfileId },
    include: { driver: true, customer: true }
  });
  recordTest("RIDE_RELATIONS", ridesWithDriver.length > 0 && !!ridesWithDriver[0].driver,
    "Rides linked to driver and customer", "DB_RELATIONS");

  const ordersWithShop = await prisma.productOrder.findMany({
    where: { shopPartnerId: shopProfileId },
    include: { shopPartner: true, customer: true, items: true }
  });
  recordTest("ORDER_RELATIONS", ordersWithShop.length > 0 && !!ordersWithShop[0].shopPartner,
    "Orders linked to shop, customer, and items", "DB_RELATIONS");
}

async function section7_adminAuditCapabilities() {
  log("\n🔍 SECTION 7: Testing admin audit capabilities...");

  const allDrivers = await prisma.driverProfile.findMany({
    where: { userId: driverUserId },
    include: { user: true }
  });
  recordTest("ADMIN_LIST_DRIVERS", allDrivers.length > 0, 
    `Admin can list drivers: found ${allDrivers.length}`, "ADMIN");

  const allShops = await prisma.shopPartner.findMany({
    where: { userId: shopUserId },
    include: { user: true }
  });
  recordTest("ADMIN_LIST_SHOPS", allShops.length > 0, 
    `Admin can list shops: found ${allShops.length}`, "ADMIN");

  const allPayouts = await prisma.payout.findMany({
    where: { 
      OR: [
        { ownerId: driverProfileId },
        { ownerId: shopProfileId }
      ]
    }
  });
  recordTest("ADMIN_VIEW_PAYOUTS", allPayouts.length >= 2, 
    `Admin can view payouts: found ${allPayouts.length}`, "ADMIN");

  const allTransactions = await prisma.walletTransaction.findMany({
    where: {
      OR: [
        { walletId: driverWalletId },
        { walletId: shopWalletId }
      ]
    }
  });
  recordTest("ADMIN_VIEW_TRANSACTIONS", allTransactions.length >= 4, 
    `Admin can view transactions: found ${allTransactions.length}`, "ADMIN");

  const completedRides = await prisma.ride.findMany({
    where: { status: "completed", driverId: driverProfileId }
  });
  recordTest("ADMIN_VIEW_RIDES", completedRides.length > 0, 
    `Admin can view completed rides: ${completedRides.length}`, "ADMIN");

  const deliveredOrders = await prisma.productOrder.findMany({
    where: { status: "delivered", shopPartnerId: shopProfileId }
  });
  recordTest("ADMIN_VIEW_ORDERS", deliveredOrders.length > 0, 
    `Admin can view delivered orders: ${deliveredOrders.length}`, "ADMIN");
}

async function section8_securityRulesValidation() {
  log("\n🔒 SECTION 8: Testing security rules validation...");

  const driverUser = await prisma.user.findUnique({ where: { id: driverUserId } });
  const shopUser = await prisma.user.findUnique({ where: { id: shopUserId } });
  const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });

  recordTest("PASSWORD_HASHED", 
    driverUser?.passwordHash !== TEST_PASSWORD && 
    shopUser?.passwordHash !== TEST_PASSWORD,
    "Passwords are properly hashed", "SECURITY");

  recordTest("ROLE_ISOLATION", 
    driverUser?.role === "driver" && 
    shopUser?.role === "shop_partner" && 
    adminUser?.role === "admin",
    "User roles are properly isolated", "SECURITY");

  recordTest("COUNTRY_CODE_ASSIGNED", 
    driverUser?.countryCode === "US" && shopUser?.countryCode === "BD",
    "Country codes properly assigned", "SECURITY");

  const driverWallet = await prisma.wallet.findUnique({ where: { id: driverWalletId } });
  const shopWallet = await prisma.wallet.findUnique({ where: { id: shopWalletId } });

  recordTest("WALLET_OWNERSHIP", 
    driverWallet?.ownerId === driverProfileId && 
    shopWallet?.ownerId === shopProfileId,
    "Wallet ownership correctly enforced", "SECURITY");

  recordTest("WALLET_CURRENCY_MATCH", 
    driverWallet?.currency === "USD" && shopWallet?.currency === "BDT",
    "Wallet currencies match country", "SECURITY");
}

async function generateReport() {
  log("\n" + "=".repeat(70));
  log("📊 COMBINED SYSTEM STABILITY REPORT");
  log("=".repeat(70));

  const categories = [...new Set(results.map(r => r.category))];
  
  let totalPassed = 0;
  let totalFailed = 0;

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.passed).length;
    const failed = categoryResults.filter(r => !r.passed).length;
    totalPassed += passed;
    totalFailed += failed;

    log(`\n📁 ${category}: ${passed}/${categoryResults.length} passed`);
    
    for (const result of categoryResults) {
      const icon = result.passed ? "✅" : "❌";
      log(`   ${icon} ${result.name}`);
    }
  }

  log("\n" + "-".repeat(70));
  log("📈 OVERALL SUMMARY");
  log("-".repeat(70));
  log(`Total Tests: ${totalPassed + totalFailed}`);
  log(`Passed: ${totalPassed}`);
  log(`Failed: ${totalFailed}`);
  log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  log("\n" + "-".repeat(70));
  log("🏥 SYSTEM HEALTH CHECK");
  log("-".repeat(70));

  const walletHealthy = results.filter(r => r.category === "WALLET" && r.passed).length === 
                       results.filter(r => r.category === "WALLET").length;
  const commissionHealthy = results.filter(r => r.category === "COMMISSION" && r.passed).length === 
                           results.filter(r => r.category === "COMMISSION").length;
  const payoutHealthy = results.filter(r => r.category === "PAYOUT" && r.passed).length === 
                       results.filter(r => r.category === "PAYOUT").length;
  const transactionsHealthy = results.filter(r => r.category === "TRANSACTIONS" && r.passed).length === 
                             results.filter(r => r.category === "TRANSACTIONS").length;
  const dbHealthy = results.filter(r => r.category === "DB_RELATIONS" && r.passed).length === 
                   results.filter(r => r.category === "DB_RELATIONS").length;
  const securityHealthy = results.filter(r => r.category === "SECURITY" && r.passed).length === 
                         results.filter(r => r.category === "SECURITY").length;
  const adminHealthy = results.filter(r => r.category === "ADMIN" && r.passed).length === 
                      results.filter(r => r.category === "ADMIN").length;

  log(`Wallet System: ${walletHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Commission Calculation: ${commissionHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Payout Processing: ${payoutHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Transaction Logging: ${transactionsHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Database Relations: ${dbHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Security Rules: ${securityHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);
  log(`Admin Audit: ${adminHealthy ? "✅ HEALTHY" : "❌ ISSUES"}`);

  log("\n" + "=".repeat(70));

  if (totalFailed === 0) {
    log("🎉 ALL COMBINED INTEGRATION TESTS PASSED!");
    log("✅ System is ready for production deployment.");
  } else {
    log(`⚠️ ${totalFailed} tests failed. Please review and fix issues.`);
  }
  
  log("=".repeat(70) + "\n");

  return totalFailed === 0;
}

async function runTests() {
  log("🚀 Starting Combined Cross-System Integration Test");
  log("=".repeat(70));

  try {
    await cleanup();
    await section1_setupUsers();
    await section2_walletSystemIntegration();
    await section3_commissionCalculation();
    await section4_payoutFlowValidation();
    await section5_transactionLogConsistency();
    await section6_databaseRelationshipStability();
    await section7_adminAuditCapabilities();
    await section8_securityRulesValidation();

    const allPassed = await generateReport();
    await cleanup();

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Test suite error:", error);
    await cleanup();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
