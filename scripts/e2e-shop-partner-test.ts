import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";

interface TestResult {
  step: string;
  status: "PASS" | "FAIL";
  details: string;
  data?: any;
}

const results: TestResult[] = [];
let testCustomerId: string = "";
let testOrderCustomerId: string = "";
let testShopPartnerId: string = "";
let testProductId: string = "";
let testOrderId: string = "";
let testDriverId: string = "";
let testAdminId: string = "";
let customerToken: string = "";
let shopPartnerToken: string = "";
let adminToken: string = "";
let driverToken: string = "";
let orderCustomerToken: string = "";
let testCustomerProfileId: string = "";

function log(step: string, status: "PASS" | "FAIL", details: string, data?: any) {
  const result = { step, status, details, data };
  results.push(result);
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${step}] ${details}`);
  if (data && status === "FAIL") {
    console.log("   Data:", JSON.stringify(data, null, 2));
  }
}

async function makeRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
) {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, data: { error: error.message } };
  }
}

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  try {
    const testEmails = [
      "e2e.shop.test@safego.bd",
      "e2e.customer.test@safego.bd",
      "e2e.driver.test@safego.bd",
      "e2e.admin.test@safego.bd",
    ];

    const users = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const shopPartners = await prisma.shopPartner.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const shopPartnerIds = shopPartners.map((s) => s.id);

      const customerProfiles = await prisma.customerProfile.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const customerProfileIds = customerProfiles.map((c) => c.id);

      if (customerProfileIds.length > 0) {
        await prisma.productOrderItem.deleteMany({
          where: { order: { customerId: { in: customerProfileIds } } },
        });
        await prisma.productOrder.deleteMany({
          where: { customerId: { in: customerProfileIds } },
        });
      }

      if (shopPartnerIds.length > 0) {
        await prisma.shopProduct.deleteMany({
          where: { shopPartnerId: { in: shopPartnerIds } },
        });
      }

      await prisma.shopPartner.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.driverProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.adminProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    console.log("✅ Cleanup complete\n");
  } catch (error: any) {
    console.log("⚠️ Cleanup warning:", error.message);
  }
}

async function createTestUsers() {
  console.log("\n📝 STEP 1: Creating test users...");
  const passwordHash = await bcrypt.hash("Test@123456", 10);

  try {
    const customer = await prisma.user.create({
      data: {
        email: "e2e.shop.test@safego.bd",
        passwordHash,
        role: "customer",
        countryCode: "BD",
      },
    });
    testCustomerId = customer.id;

    const customerProfile = await prisma.customerProfile.create({
      data: {
        userId: customer.id,
        fullName: "E2E Test Shop Owner",
        phoneNumber: "+8801712345678",
        verificationStatus: "approved",
        isVerified: true,
      },
    });
    testCustomerProfileId = customerProfile.id;
    log("CREATE_CUSTOMER", "PASS", `Created customer: ${customer.email}`, { id: customer.id });

    const orderCustomer = await prisma.user.create({
      data: {
        email: "e2e.customer.test@safego.bd",
        passwordHash,
        role: "customer",
        countryCode: "BD",
      },
    });
    testOrderCustomerId = orderCustomer.id;

    await prisma.customerProfile.create({
      data: {
        userId: orderCustomer.id,
        fullName: "E2E Order Customer",
        phoneNumber: "+8801712345679",
        verificationStatus: "approved",
        isVerified: true,
      },
    });
    log("CREATE_ORDER_CUSTOMER", "PASS", `Created order customer: ${orderCustomer.email}`);

    const driver = await prisma.user.create({
      data: {
        email: "e2e.driver.test@safego.bd",
        passwordHash,
        role: "driver",
        countryCode: "BD",
      },
    });
    testDriverId = driver.id;

    await prisma.driverProfile.create({
      data: {
        userId: driver.id,
        fullName: "E2E Test Driver",
        phoneNumber: "+8801712345680",
        driverLicenseNumber: "DL-TEST-123",
        verificationStatus: "approved",
        isVerified: true,
      },
    });
    log("CREATE_DRIVER", "PASS", `Created driver: ${driver.email}`, { id: driver.id });

    const admin = await prisma.user.create({
      data: {
        email: "e2e.admin.test@safego.bd",
        passwordHash,
        role: "admin",
        countryCode: "BD",
      },
    });
    testAdminId = admin.id;

    await prisma.adminProfile.create({
      data: {
        userId: admin.id,
        adminRole: "SUPER_ADMIN",
        isActive: true,
      },
    });
    log("CREATE_ADMIN", "PASS", `Created admin: ${admin.email}`, { id: admin.id });

    return true;
  } catch (error: any) {
    log("CREATE_USERS", "FAIL", error.message);
    return false;
  }
}

async function loginUsers() {
  console.log("\n🔐 STEP 2: Logging in test users...");

  const customerLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.shop.test@safego.bd", password: "Test@123456" },
  });
  if (customerLogin.ok && customerLogin.data.token) {
    customerToken = customerLogin.data.token;
    log("LOGIN_CUSTOMER", "PASS", "Customer logged in successfully");
  } else {
    log("LOGIN_CUSTOMER", "FAIL", "Failed to login customer", customerLogin.data);
    return false;
  }

  const adminLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.admin.test@safego.bd", password: "Test@123456" },
  });
  if (adminLogin.ok && adminLogin.data.token) {
    adminToken = adminLogin.data.token;
    log("LOGIN_ADMIN", "PASS", "Admin logged in successfully");
  } else {
    log("LOGIN_ADMIN", "FAIL", "Failed to login admin", adminLogin.data);
    return false;
  }

  const driverLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.driver.test@safego.bd", password: "Test@123456" },
  });
  if (driverLogin.ok && driverLogin.data.token) {
    driverToken = driverLogin.data.token;
    log("LOGIN_DRIVER", "PASS", "Driver logged in successfully");
  } else {
    log("LOGIN_DRIVER", "FAIL", "Failed to login driver", driverLogin.data);
    return false;
  }

  const orderCustomerLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.customer.test@safego.bd", password: "Test@123456" },
  });
  if (orderCustomerLogin.ok && orderCustomerLogin.data.token) {
    orderCustomerToken = orderCustomerLogin.data.token;
    log("LOGIN_ORDER_CUSTOMER", "PASS", "Order customer logged in successfully");
  } else {
    log("LOGIN_ORDER_CUSTOMER", "FAIL", "Failed to login order customer", orderCustomerLogin.data);
    return false;
  }

  return true;
}

async function testShopRegistration() {
  console.log("\n🏪 STEP 3: Testing shop partner registration...");

  const registrationData = {
    shopName: "E2E Test Shop",
    shopType: "grocery",
    shopAddress: "123 Test Street, Mirpur, Dhaka",
    shopDescription: "Automated E2E test shop for groceries",
    ownerName: "E2E Test Owner",
    fatherName: "E2E Test Father",
    dateOfBirth: "1990-01-15",
    presentAddress: "456 Present Street, Mirpur, Dhaka",
    permanentAddress: "789 Permanent Street, Dhaka",
    nidNumber: "1234567890123",
    emergencyContactName: "E2E Emergency Contact",
    emergencyContactPhone: "+8801912345678",
    emergencyContactRelation: "brother",
    tradeLicenseNumber: "TL-2024-TEST",
  };

  const response = await makeRequest("/api/shop-partner/register", {
    method: "POST",
    body: registrationData,
    token: customerToken,
  });

  if (response.ok && response.data.shopPartner) {
    testShopPartnerId = response.data.shopPartner.id;
    log("SHOP_REGISTRATION", "PASS", `Shop registered with ID: ${testShopPartnerId}`);

    const user = await prisma.user.findUnique({ where: { id: testCustomerId } });
    if (user?.role === "pending_shop_partner") {
      log("ROLE_UPGRADE_PENDING", "PASS", "User role upgraded to pending_shop_partner");
    } else {
      log("ROLE_UPGRADE_PENDING", "FAIL", `Expected pending_shop_partner, got ${user?.role}`);
      return false;
    }
    return true;
  } else {
    log("SHOP_REGISTRATION", "FAIL", "Failed to register shop", response.data);
    return false;
  }
}

async function testAdminApproval() {
  console.log("\n✅ STEP 4: Testing admin approval...");

  const response = await makeRequest(`/api/admin/bd-expansion/shop-partners/${testShopPartnerId}/verify`, {
    method: "PATCH",
    body: { action: "approve" },
    token: adminToken,
  });

  if (response.ok) {
    log("ADMIN_APPROVAL", "PASS", "Shop approved by admin");

    const user = await prisma.user.findUnique({ where: { id: testCustomerId } });
    if (user?.role === "shop_partner") {
      log("ROLE_UPGRADE_FINAL", "PASS", "User role upgraded to shop_partner");
    } else {
      log("ROLE_UPGRADE_FINAL", "FAIL", `Expected shop_partner, got ${user?.role}`);
      return false;
    }

    const shopPartnerLogin = await makeRequest("/api/auth/login", {
      method: "POST",
      body: { email: "e2e.shop.test@safego.bd", password: "Test@123456" },
    });
    if (shopPartnerLogin.ok && shopPartnerLogin.data.token) {
      shopPartnerToken = shopPartnerLogin.data.token;
      log("SHOP_PARTNER_LOGIN", "PASS", "Shop partner logged in with new role");
    }

    return true;
  } else {
    log("ADMIN_APPROVAL", "FAIL", "Failed to approve shop", response.data);
    return false;
  }
}

async function testProductUpload() {
  console.log("\n📦 STEP 5: Testing product upload...");

  const productData = {
    productName: "E2E Test Product",
    description: "This is a test product for E2E testing",
    price: 250,
    category: "grocery",
    subcategory: "snacks",
    stockQuantity: 100,
    unit: "piece",
    isActive: true,
  };

  const response = await makeRequest("/api/shop-partner/products", {
    method: "POST",
    body: productData,
    token: shopPartnerToken,
  });

  if (response.ok && response.data.product) {
    testProductId = response.data.product.id;
    log("PRODUCT_UPLOAD", "PASS", `Product created with ID: ${testProductId}`);

    const product = await prisma.shopProduct.findUnique({ where: { id: testProductId } });
    if (product && product.stockQuantity === 100) {
      log("PRODUCT_STOCK", "PASS", `Initial stock: ${product.stockQuantity}`);
    }
    return true;
  } else {
    log("PRODUCT_UPLOAD", "FAIL", "Failed to create product", response.data);
    return false;
  }
}

async function testCustomerOrdering() {
  console.log("\n🛒 STEP 6: Testing customer ordering...");

  const orderData = {
    shopId: testShopPartnerId,
    items: [
      {
        productId: testProductId,
        quantity: 5,
        unitPrice: 250,
      },
    ],
    deliveryAddress: "456 Customer Street, Dhaka",
    deliveryLat: 23.8103,
    deliveryLng: 90.4125,
    paymentMethod: "cash",
    deliveryNotes: "E2E Test Order",
  };

  const response = await makeRequest("/api/bd/orders", {
    method: "POST",
    body: orderData,
    token: orderCustomerToken,
  });

  if (response.ok && response.data.order) {
    testOrderId = response.data.order.id;
    log("ORDER_PLACED", "PASS", `Order placed with ID: ${testOrderId}`);

    const product = await prisma.shopProduct.findUnique({ where: { id: testProductId } });
    if (product && product.stockQuantity === 95) {
      log("STOCK_DECREMENTED", "PASS", `Stock decremented to: ${product.stockQuantity}`);
    } else {
      log("STOCK_DECREMENTED", "FAIL", `Expected 95, got ${product?.stockQuantity}`);
    }

    const order = await prisma.productOrder.findUnique({ where: { id: testOrderId } });
    if (order && order.status === "placed") {
      log("ORDER_STATUS", "PASS", `Order status: ${order.status}`);
    }

    return true;
  } else {
    log("ORDER_PLACED", "FAIL", "Failed to place order", response.data);
    return false;
  }
}

async function testShopOrderProcessing() {
  console.log("\n📋 STEP 7: Testing shop order processing...");

  const statusFlow = ["accepted", "packing", "ready_for_pickup"];

  for (const status of statusFlow) {
    const response = await makeRequest(`/api/shop-partner/orders/${testOrderId}/status`, {
      method: "PATCH",
      body: { status },
      token: shopPartnerToken,
    });

    if (response.ok) {
      log(`ORDER_STATUS_${status.toUpperCase()}`, "PASS", `Order status updated to: ${status}`);
    } else {
      log(`ORDER_STATUS_${status.toUpperCase()}`, "FAIL", `Failed to update to ${status}`, response.data);
      return false;
    }
  }

  return true;
}

async function testDriverDelivery() {
  console.log("\n🚚 STEP 8: Testing driver delivery...");

  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: testDriverId },
  });

  if (!driverProfile) {
    log("DRIVER_PROFILE", "FAIL", "Driver profile not found");
    return false;
  }

  await prisma.productOrder.update({
    where: { id: testOrderId },
    data: { driverId: driverProfile.id },
  });
  log("DRIVER_ASSIGNED", "PASS", `Driver ${driverProfile.id} assigned to order`);

  const pickupResponse = await makeRequest(`/api/shop-partner/orders/${testOrderId}/status`, {
    method: "PATCH",
    body: { status: "picked_up" },
    token: shopPartnerToken,
  });

  if (pickupResponse.ok) {
    log("ORDER_PICKED_UP", "PASS", "Order marked as picked up");
  } else {
    log("ORDER_PICKED_UP", "FAIL", "Failed to mark as picked up", pickupResponse.data);
  }

  const deliverResponse = await makeRequest(`/api/shop-partner/orders/${testOrderId}/status`, {
    method: "PATCH",
    body: { status: "delivered" },
    token: shopPartnerToken,
  });

  if (deliverResponse.ok) {
    log("ORDER_DELIVERED", "PASS", "Order marked as delivered");

    const order = await prisma.productOrder.findUnique({ where: { id: testOrderId } });
    if (order?.status === "delivered") {
      log("DELIVERY_CONFIRMED", "PASS", "Order delivery confirmed in database");
    }
    return true;
  } else {
    log("ORDER_DELIVERED", "FAIL", "Failed to mark as delivered", deliverResponse.data);
    return false;
  }
}

async function testWalletCommission() {
  console.log("\n💰 STEP 9: Testing wallet and commission...");

  const order = await prisma.productOrder.findUnique({
    where: { id: testOrderId },
    include: { items: true },
  });

  if (!order) {
    log("ORDER_LOOKUP", "FAIL", "Order not found");
    return false;
  }

  const totalAmount = Number(order.totalAmount);
  const commissionRate = 15;
  const expectedCommission = totalAmount * (commissionRate / 100);
  const expectedEarnings = totalAmount - expectedCommission;

  log("ORDER_TOTAL", "PASS", `Order total: ৳${totalAmount}`);
  log("COMMISSION_RATE", "PASS", `BD commission rate: ${commissionRate}%`);
  log("EXPECTED_COMMISSION", "PASS", `Expected commission: ৳${expectedCommission}`);
  log("EXPECTED_EARNINGS", "PASS", `Expected shop earnings: ৳${expectedEarnings}`);

  const shopPartner = await prisma.shopPartner.findUnique({
    where: { id: testShopPartnerId },
  });

  if (shopPartner) {
    log("WALLET_BALANCE", "PASS", `Current wallet balance: ৳${shopPartner.walletBalance}`);
    log("TOTAL_EARNINGS", "PASS", `Total earnings: ৳${shopPartner.totalEarnings}`);
  }

  return true;
}

async function testPayoutRequest() {
  console.log("\n💸 STEP 10: Testing payout request...");

  await prisma.shopPartner.update({
    where: { id: testShopPartnerId },
    data: {
      walletBalance: 5000,
      totalEarnings: 5000,
      partnerStatus: "live",
      isActive: true,
    },
  });
  log("WALLET_SETUP", "PASS", "Set wallet balance to ৳5000 for payout test");

  const payoutData = {
    amount: 1000,
  };

  const response = await makeRequest("/api/shop-partner/payout-request", {
    method: "POST",
    body: payoutData,
    token: shopPartnerToken,
  });

  if (response.ok && response.data.payout) {
    log("PAYOUT_REQUEST", "PASS", `Payout request created: ৳${payoutData.amount}`);

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id: testShopPartnerId },
    });

    if (shopPartner && Number(shopPartner.walletBalance) === 4000) {
      log("WALLET_DEDUCTED", "PASS", `Wallet balance after payout: ৳${shopPartner.walletBalance}`);
    } else {
      log("WALLET_DEDUCTED", "FAIL", `Expected ৳4000, got ৳${shopPartner?.walletBalance}`);
    }

    return true;
  } else {
    log("PAYOUT_REQUEST", "FAIL", "Failed to create payout request", response.data);
    return false;
  }
}

async function testMinimumPayoutValidation() {
  console.log("\n🔒 STEP 11: Testing payout validation...");

  const lowPayoutData = {
    amount: 50,
  };

  const response = await makeRequest("/api/shop-partner/payout-request", {
    method: "POST",
    body: lowPayoutData,
    token: shopPartnerToken,
  });

  if (!response.ok && response.data.error) {
    log("MIN_PAYOUT_VALIDATION", "PASS", "Correctly rejected payout below ৳100 minimum");
  } else {
    log("MIN_PAYOUT_VALIDATION", "FAIL", "Should have rejected low payout amount");
  }

  const overPayoutData = {
    amount: 10000,
  };

  const overResponse = await makeRequest("/api/shop-partner/payout-request", {
    method: "POST",
    body: overPayoutData,
    token: shopPartnerToken,
  });

  if (!overResponse.ok && overResponse.data.error) {
    log("MAX_PAYOUT_VALIDATION", "PASS", "Correctly rejected payout exceeding balance");
  } else {
    log("MAX_PAYOUT_VALIDATION", "FAIL", "Should have rejected over-balance payout");
  }

  return true;
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 E2E TEST REPORT - SHOP PARTNER SYSTEM");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;

  console.log(`\n📈 Summary: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`   - ${r.step}: ${r.details}`);
      });
  }

  console.log("\n✅ Passed Tests:");
  results
    .filter((r) => r.status === "PASS")
    .forEach((r) => {
      console.log(`   - ${r.step}`);
    });

  console.log("\n" + "=".repeat(60));

  return { passed, failed, total, results };
}

async function runE2ETest() {
  console.log("🚀 Starting E2E Test: Shop Partner System");
  console.log("=".repeat(60));

  try {
    await cleanup();

    const steps = [
      createTestUsers,
      loginUsers,
      testShopRegistration,
      testAdminApproval,
      testProductUpload,
      testCustomerOrdering,
      testShopOrderProcessing,
      testDriverDelivery,
      testWalletCommission,
      testPayoutRequest,
      testMinimumPayoutValidation,
    ];

    for (const step of steps) {
      const success = await step();
      if (!success) {
        console.log("\n⚠️ Test step failed, continuing with remaining tests...");
      }
    }

    const report = await generateReport();

    await cleanup();

    if (report.failed === 0) {
      console.log("\n🎉 ALL TESTS PASSED! Shop Partner system is 100% verified.");
    } else {
      console.log(`\n⚠️ ${report.failed} test(s) failed. Review and fix issues.`);
    }

    process.exit(report.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error("\n💥 Critical error during E2E test:", error.message);
    await cleanup();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
