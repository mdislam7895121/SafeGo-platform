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
let testOperatorUserId: string = "";
let testOperatorId: string = "";
let testCustomerUserId: string = "";
let testCustomerProfileId: string = "";
let testAdminUserId: string = "";
let testListingId: string = "";
let testVehicleId: string = "";
let testTicketBookingId: string = "";
let testRentalBookingId: string = "";
let operatorToken: string = "";
let customerToken: string = "";
let adminToken: string = "";

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
      "e2e.ticket.operator@safego.bd",
      "e2e.ticket.customer@safego.bd",
      "e2e.ticket.admin@safego.bd",
    ];

    const users = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const operators = await prisma.ticketOperator.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const operatorIds = operators.map((o) => o.id);

      const customerProfiles = await prisma.customerProfile.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const customerProfileIds = customerProfiles.map((c) => c.id);

      if (operatorIds.length > 0) {
        const listings = await prisma.ticketListing.findMany({
          where: { operatorId: { in: operatorIds } },
          select: { id: true },
        });
        const listingIds = listings.map((l) => l.id);

        const vehicles = await prisma.rentalVehicle.findMany({
          where: { operatorId: { in: operatorIds } },
          select: { id: true },
        });
        const vehicleIds = vehicles.map((v) => v.id);

        await prisma.ticketBooking.deleteMany({
          where: { listingId: { in: listingIds } },
        });
        await prisma.rentalBooking.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        });
        await prisma.ticketListing.deleteMany({
          where: { operatorId: { in: operatorIds } },
        });
        await prisma.rentalVehicle.deleteMany({
          where: { operatorId: { in: operatorIds } },
        });
        await prisma.wallet.deleteMany({
          where: { ownerId: { in: operatorIds }, ownerType: "ticket_operator" },
        });
        await prisma.payoutAccount.deleteMany({
          where: { ownerId: { in: operatorIds }, ownerType: "ticket_operator" },
        });
      }

      await prisma.ticketOperator.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.customerProfile.deleteMany({
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
    const operatorUser = await prisma.user.create({
      data: {
        email: "e2e.ticket.operator@safego.bd",
        passwordHash,
        role: "pending_ticket_operator",
        countryCode: "BD",
      },
    });
    testOperatorUserId = operatorUser.id;
    log("Create Operator User", "PASS", `Created user: ${operatorUser.email}`);

    const customerUser = await prisma.user.create({
      data: {
        email: "e2e.ticket.customer@safego.bd",
        passwordHash,
        role: "customer",
        countryCode: "BD",
      },
    });
    testCustomerUserId = customerUser.id;

    const customerProfile = await prisma.customerProfile.create({
      data: {
        userId: customerUser.id,
        fullName: "E2E Test Customer",
        phoneNumber: "01799999999",
      },
    });
    testCustomerProfileId = customerProfile.id;
    log("Create Customer User", "PASS", `Created customer: ${customerUser.email}`);

    const adminUser = await prisma.user.create({
      data: {
        email: "e2e.ticket.admin@safego.bd",
        passwordHash,
        role: "admin",
        countryCode: "BD",
      },
    });
    testAdminUserId = adminUser.id;

    await prisma.adminProfile.create({
      data: {
        userId: adminUser.id,
        adminRole: "SUPER_ADMIN",
        countryCode: "BD",
      },
    });
    log("Create Admin User", "PASS", `Created admin: ${adminUser.email}`);
  } catch (error: any) {
    log("Create Test Users", "FAIL", error.message);
    throw error;
  }
}

async function authenticateUsers() {
  console.log("\n🔐 STEP 2: Authenticating users...");

  const operatorLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.ticket.operator@safego.bd", password: "Test@123456" },
  });
  if (operatorLogin.ok && operatorLogin.data.token) {
    operatorToken = operatorLogin.data.token;
    log("Operator Login", "PASS", "Operator authenticated");
  } else {
    log("Operator Login", "FAIL", "Failed to authenticate operator", operatorLogin.data);
  }

  const customerLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.ticket.customer@safego.bd", password: "Test@123456" },
  });
  if (customerLogin.ok && customerLogin.data.token) {
    customerToken = customerLogin.data.token;
    log("Customer Login", "PASS", "Customer authenticated");
  } else {
    log("Customer Login", "FAIL", "Failed to authenticate customer", customerLogin.data);
  }

  const adminLogin = await makeRequest("/api/auth/login", {
    method: "POST",
    body: { email: "e2e.ticket.admin@safego.bd", password: "Test@123456" },
  });
  if (adminLogin.ok && adminLogin.data.token) {
    adminToken = adminLogin.data.token;
    log("Admin Login", "PASS", "Admin authenticated");
  } else {
    log("Admin Login", "FAIL", "Failed to authenticate admin", adminLogin.data);
  }
}

async function testOperatorRegistration() {
  console.log("\n🚌 STEP 3: Testing Ticket Operator registration...");

  const registerResponse = await makeRequest("/api/ticket-operator/register", {
    method: "POST",
    token: operatorToken,
    body: {
      operatorName: "E2E Test Bus Service",
      operatorType: "both",
      description: "Test bus and rental service",
      officeAddress: "123 Test Road, Motijheel, Dhaka-1000",
      officePhone: "01711111111",
      ownerName: "E2E Test Owner",
      fatherName: "Test Father Name",
      dateOfBirth: "1985-05-15",
      presentAddress: "123 Present Address, Dhaka",
      permanentAddress: "456 Permanent Address, Chittagong",
      nidNumber: "1234567890123",
      emergencyContactName: "Emergency Contact",
      emergencyContactPhone: "01722222222",
    },
  });

  if (registerResponse.ok && registerResponse.data.operator) {
    testOperatorId = registerResponse.data.operator.id;
    log("Operator Registration", "PASS", `Registered operator: ${registerResponse.data.operator.operatorName}`);
  } else {
    log("Operator Registration", "FAIL", "Failed to register operator", registerResponse.data);
  }
}

async function testKYCSubmission() {
  console.log("\n📄 STEP 4: Testing KYC document submission (Stage 2)...");

  const kycResponse = await makeRequest("/api/ticket-operator/stages/2", {
    method: "POST",
    token: operatorToken,
    body: {
      ownerName: "E2E Test Owner",
      fatherName: "Test Father Name",
      dateOfBirth: "1985-05-15",
      presentAddress: "123 Present Address, Dhaka",
      permanentAddress: "456 Permanent Address, Chittagong",
      nidNumber: "1234567890123",
      nidFrontImage: "https://example.com/nid-front.jpg",
      nidBackImage: "https://example.com/nid-back.jpg",
      emergencyContactName: "Emergency Contact",
      emergencyContactPhone: "01722222222",
    },
  });

  if (kycResponse.ok && (kycResponse.data.success || kycResponse.data.operator)) {
    log("KYC Submission", "PASS", "KYC documents submitted successfully, status: kyc_pending");
  } else {
    log("KYC Submission", "FAIL", "Failed to submit KYC", kycResponse.data);
  }
}

async function testAdminKYCApproval() {
  console.log("\n✅ STEP 5: Testing Admin KYC approval...");

  if (!testOperatorId) {
    log("Admin KYC Approval", "FAIL", "No operator ID available");
    return;
  }

  const approveResponse = await makeRequest(`/api/admin/bd-expansion/ticket-operators/${testOperatorId}/approve-kyc`, {
    method: "PATCH",
    token: adminToken,
  });

  if (approveResponse.ok && (approveResponse.data.success || approveResponse.data.operator)) {
    log("Admin KYC Approval", "PASS", "KYC approved, operator can now create listings");
  } else {
    log("Admin KYC Approval", "FAIL", "Failed to approve KYC", approveResponse.data);
  }
}

async function testTicketListingCreation() {
  console.log("\n🎫 STEP 6: Testing Ticket Listing creation...");

  const listingResponse = await makeRequest("/api/ticket-operator/tickets", {
    method: "POST",
    token: operatorToken,
    body: {
      routeName: "Dhaka to Chittagong",
      vehicleType: "ac_bus",
      vehicleBrand: "Hino",
      vehicleNumber: "Dhaka Metro-1234",
      originCity: "Dhaka",
      originStation: "Sayedabad Bus Terminal",
      destinationCity: "Chittagong",
      destinationStation: "Dampara Bus Stand",
      departureTime: "08:00",
      arrivalTime: "14:00",
      durationMinutes: 360,
      basePrice: 850,
      totalSeats: 40,
      amenities: ["AC", "WiFi", "Water", "Snacks"],
      daysOfOperation: ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"],
    },
  });

  if (listingResponse.ok && listingResponse.data.listing) {
    testListingId = listingResponse.data.listing.id;
    log("Create Ticket Listing", "PASS", `Created listing: ${listingResponse.data.listing.routeName}`);
  } else {
    log("Create Ticket Listing", "FAIL", "Failed to create listing", listingResponse.data);
  }
}

async function testRentalVehicleCreation() {
  console.log("\n🚗 STEP 7: Testing Rental Vehicle creation...");

  const vehicleResponse = await makeRequest("/api/ticket-operator/vehicles", {
    method: "POST",
    token: operatorToken,
    body: {
      vehicleType: "micro",
      brand: "Toyota",
      model: "Hiace",
      year: 2022,
      color: "White",
      registrationNumber: "Dhaka Metro-5678",
      passengerCapacity: 12,
      pricePerDay: 5000,
      pricePerKm: 15,
      securityDeposit: 10000,
      features: ["AC", "Music System", "Comfortable Seats"],
      currentLocation: "Dhaka, Bangladesh",
    },
  });

  if (vehicleResponse.ok && vehicleResponse.data.vehicle) {
    testVehicleId = vehicleResponse.data.vehicle.id;
    log("Create Rental Vehicle", "PASS", `Created vehicle: ${vehicleResponse.data.vehicle.brand} ${vehicleResponse.data.vehicle.model}`);
  } else {
    log("Create Rental Vehicle", "FAIL", "Failed to create vehicle", vehicleResponse.data);
  }
}

async function testSetupCompletion() {
  console.log("\n📋 STEP 8: Testing Setup completion (Stage 3)...");

  const setupResponse = await makeRequest("/api/ticket-operator/stages/3", {
    method: "POST",
    token: operatorToken,
    body: {
      logo: "https://example.com/logo.png",
      officeAddress: "123 Test Road, Motijheel, Dhaka-1000",
      officePhone: "01711111111",
      officeEmail: "test@e2etest.com",
    },
  });

  if (setupResponse.ok && (setupResponse.data.success || setupResponse.data.operator)) {
    log("Setup Completion", "PASS", "Operator setup completed, waiting for final approval");
  } else {
    log("Setup Completion", "FAIL", "Failed to complete setup", setupResponse.data);
  }
}

async function testAdminGoLive() {
  console.log("\n🚀 STEP 9: Testing Admin Go-Live approval...");

  if (!testOperatorId) {
    log("Admin Go-Live", "FAIL", "No operator ID available");
    return;
  }

  const goLiveResponse = await makeRequest(`/api/admin/bd-expansion/ticket-operators/${testOperatorId}/go-live`, {
    method: "PATCH",
    token: adminToken,
    body: { 
      ticketCommissionRate: 10,
      rentalCommissionRate: 12,
    },
  });

  if (goLiveResponse.ok && (goLiveResponse.data.success || goLiveResponse.data.operator)) {
    log("Admin Go-Live", "PASS", "Operator is now LIVE");
  } else {
    log("Admin Go-Live", "FAIL", "Failed to approve go-live", goLiveResponse.data);
  }
}

async function testCustomerTicketSearch() {
  console.log("\n🔍 STEP 10: Testing Customer ticket search...");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const journeyDate = tomorrow.toISOString().split("T")[0];

  const searchResponse = await makeRequest(
    `/api/tickets/search?originCity=Dhaka&destinationCity=Chittagong&journeyDate=${journeyDate}`
  );

  if (searchResponse.ok && searchResponse.data.listings) {
    log("Customer Ticket Search", "PASS", `Found ${searchResponse.data.listings.length} listings`);
  } else {
    log("Customer Ticket Search", "FAIL", "Failed to search tickets", searchResponse.data);
  }
}

async function testCustomerTicketBooking() {
  console.log("\n🎫 STEP 11: Testing Customer ticket booking...");

  if (!testListingId) {
    log("Customer Ticket Booking", "FAIL", "No listing ID available");
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const bookingResponse = await makeRequest("/api/tickets/book", {
    method: "POST",
    token: customerToken,
    body: {
      listingId: testListingId,
      journeyDate: tomorrow.toISOString(),
      seatNumbers: ["A1", "A2"],
      passengerName: "E2E Test Passenger",
      passengerPhone: "01799999999",
      passengerEmail: "test@example.com",
      paymentMethod: "bkash",
    },
  });

  if (bookingResponse.ok && bookingResponse.data.booking) {
    testTicketBookingId = bookingResponse.data.booking.id;
    log("Customer Ticket Booking", "PASS", `Booked ticket: ${bookingResponse.data.booking.bookingCode}`);
  } else {
    log("Customer Ticket Booking", "FAIL", "Failed to book ticket", bookingResponse.data);
  }
}

async function testCustomerRentalSearch() {
  console.log("\n🔍 STEP 12: Testing Customer rental search...");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 2);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 4);

  const searchResponse = await makeRequest(
    `/api/rentals/search?location=Dhaka`
  );

  if (searchResponse.ok && searchResponse.data.vehicles) {
    log("Customer Rental Search", "PASS", `Found ${searchResponse.data.vehicles.length} vehicles`);
  } else {
    log("Customer Rental Search", "FAIL", "Failed to search rentals", searchResponse.data);
  }
}

async function testCustomerRentalBooking() {
  console.log("\n🚗 STEP 13: Testing Customer rental booking...");

  if (!testVehicleId) {
    log("Customer Rental Booking", "FAIL", "No vehicle ID available");
    return;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 2);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 4);

  const bookingResponse = await makeRequest("/api/rentals/book", {
    method: "POST",
    token: customerToken,
    body: {
      vehicleId: testVehicleId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      renterName: "E2E Test Renter",
      renterPhone: "01799999999",
      renterEmail: "test@example.com",
      pickupLocation: "Dhaka Airport",
      includesDriver: true,
      paymentMethod: "nagad",
    },
  });

  if (bookingResponse.ok && bookingResponse.data.booking) {
    testRentalBookingId = bookingResponse.data.booking.id;
    log("Customer Rental Booking", "PASS", `Booked rental: ${bookingResponse.data.booking.bookingCode}`);
  } else {
    log("Customer Rental Booking", "FAIL", "Failed to book rental", bookingResponse.data);
  }
}

async function testOperatorWallet() {
  console.log("\n💰 STEP 14: Testing Operator wallet...");

  const walletResponse = await makeRequest("/api/ticket-operator/wallet", {
    token: operatorToken,
  });

  if (walletResponse.ok && walletResponse.data.balance !== undefined) {
    log("Operator Wallet", "PASS", `Wallet balance: ${walletResponse.data.balance.available} ${walletResponse.data.currency}`);
  } else {
    log("Operator Wallet", "FAIL", "Failed to get wallet", walletResponse.data);
  }
}

async function testOperatorEarningsSummary() {
  console.log("\n📊 STEP 15: Testing Operator earnings summary...");

  const earningsResponse = await makeRequest("/api/ticket-operator/earnings/summary", {
    token: operatorToken,
  });

  if (earningsResponse.ok && earningsResponse.data.totalEarnings !== undefined) {
    log("Earnings Summary", "PASS", `Total earnings: ${earningsResponse.data.totalEarnings}`);
  } else {
    log("Earnings Summary", "FAIL", "Failed to get earnings", earningsResponse.data);
  }
}

async function testPayoutAccountCreation() {
  console.log("\n🏦 STEP 16: Testing Payout account creation...");

  const accountResponse = await makeRequest("/api/ticket-operator/payout-accounts", {
    method: "POST",
    token: operatorToken,
    body: {
      payoutType: "mobile_wallet",
      provider: "bkash",
      accountNumber: "01711111111",
      accountHolderName: "E2E Test Owner",
      isDefault: true,
    },
  });

  if (accountResponse.ok && accountResponse.data.success) {
    log("Payout Account", "PASS", `Created payout account: ${accountResponse.data.account.displayName}`);
  } else {
    log("Payout Account", "FAIL", "Failed to create payout account", accountResponse.data);
  }
}

async function testTicketGeneration() {
  console.log("\n🎟️ STEP 17: Testing Ticket/QR generation...");

  if (!testTicketBookingId) {
    log("Ticket Generation", "FAIL", "No booking ID available");
    return;
  }

  const ticketResponse = await makeRequest(
    `/api/tickets/bookings/${testTicketBookingId}/ticket?format=json`,
    { token: customerToken }
  );

  if (ticketResponse.ok && ticketResponse.data.qrCodeImage) {
    log("Ticket Generation", "PASS", `Generated ticket with QR code for booking ${ticketResponse.data.bookingCode}`);
  } else {
    log("Ticket Generation", "FAIL", "Failed to generate ticket", ticketResponse.data);
  }
}

async function testTicketVerification() {
  console.log("\n✅ STEP 18: Testing Ticket verification...");

  if (!testTicketBookingId) {
    log("Ticket Verification", "FAIL", "No booking ID available");
    return;
  }

  const verifyResponse = await makeRequest(`/api/tickets/verify/${testTicketBookingId}`);

  if (verifyResponse.ok && verifyResponse.data.valid) {
    log("Ticket Verification", "PASS", "Ticket is valid");
  } else {
    log("Ticket Verification", "FAIL", "Ticket verification failed", verifyResponse.data);
  }
}

async function testRentalVoucherGeneration() {
  console.log("\n🎟️ STEP 19: Testing Rental voucher generation...");

  if (!testRentalBookingId) {
    log("Rental Voucher", "FAIL", "No rental booking ID available");
    return;
  }

  const voucherResponse = await makeRequest(
    `/api/rentals/my-bookings/${testRentalBookingId}/voucher?format=json`,
    { token: customerToken }
  );

  if (voucherResponse.ok && voucherResponse.data.qrCodeImage) {
    log("Rental Voucher", "PASS", `Generated voucher with QR code for booking ${voucherResponse.data.bookingCode}`);
  } else {
    log("Rental Voucher", "FAIL", "Failed to generate voucher", voucherResponse.data);
  }
}

async function testAdminOperatorList() {
  console.log("\n📋 STEP 20: Testing Admin operator listing...");

  const listResponse = await makeRequest("/api/admin/bd-expansion/ticket-operators", {
    token: adminToken,
  });

  if (listResponse.ok && listResponse.data.operators) {
    log("Admin Operator List", "PASS", `Found ${listResponse.data.operators.length} operators`);
  } else {
    log("Admin Operator List", "FAIL", "Failed to list operators", listResponse.data);
  }
}

async function testOperatorBookingHistory() {
  console.log("\n📜 STEP 21: Testing Operator booking history...");

  const bookingsResponse = await makeRequest("/api/ticket-operator/ticket-bookings", {
    token: operatorToken,
  });

  if (bookingsResponse.ok && bookingsResponse.data.bookings) {
    log("Operator Bookings", "PASS", `Found ${bookingsResponse.data.bookings.length} bookings`);
  } else {
    log("Operator Bookings", "FAIL", "Failed to get bookings", bookingsResponse.data);
  }
}

async function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 E2E TICKET & RENTAL PARTNER TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log("Failed Tests:");
    results.filter((r) => r.status === "FAIL").forEach((r) => {
      console.log(`  ❌ ${r.step}: ${r.details}`);
    });
  }

  console.log("\n" + "=".repeat(60));

  return { passed, failed, total };
}

async function runTests() {
  console.log("🚀 Starting E2E Ticket & Rental Partner System Test");
  console.log("=".repeat(60));

  try {
    await cleanup();
    await createTestUsers();
    await authenticateUsers();
    await testOperatorRegistration();
    await testKYCSubmission();
    await testAdminKYCApproval();
    await testTicketListingCreation();
    await testRentalVehicleCreation();
    await testSetupCompletion();
    await testAdminGoLive();
    await testCustomerTicketSearch();
    await testCustomerTicketBooking();
    await testCustomerRentalSearch();
    await testCustomerRentalBooking();
    await testOperatorWallet();
    await testOperatorEarningsSummary();
    await testPayoutAccountCreation();
    await testTicketGeneration();
    await testTicketVerification();
    await testRentalVoucherGeneration();
    await testAdminOperatorList();
    await testOperatorBookingHistory();
  } catch (error: any) {
    console.error("\n❌ Test suite error:", error.message);
  }

  const summary = await printSummary();
  await cleanup();
  await prisma.$disconnect();

  process.exit(summary.failed > 0 ? 1 : 0);
}

runTests();
