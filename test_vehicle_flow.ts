// Test AI-suggested categories for different vehicle types
import { suggestVehicleCategory, isCategoryCompatible, VEHICLE_CATEGORIES, DISPATCH_ELIGIBILITY_MATRIX, canVehicleServeCategory } from './shared/vehicleCategories';

console.log("=== TEST 1: AI Category Suggestions ===\n");

// Test cases with correct property names
const testVehicles = [
  { name: "Basic Toyota Sedan", props: { bodyType: "SEDAN", seats: 4, year: 2020, make: "Toyota", luxury: false, wheelchairAccessible: false, exteriorColor: "black" } },
  { name: "Mercedes S-Class (Luxury)", props: { bodyType: "SEDAN", seats: 4, year: 2023, make: "Mercedes-Benz", luxury: true, wheelchairAccessible: false, exteriorColor: "black", interiorColor: "black" } },
  { name: "Chevy Suburban SUV", props: { bodyType: "SUV", seats: 7, year: 2022, make: "Chevrolet", luxury: false, wheelchairAccessible: false, exteriorColor: "white" } },
  { name: "Cadillac Escalade (Luxury SUV)", props: { bodyType: "SUV", seats: 7, year: 2023, make: "Cadillac", luxury: true, wheelchairAccessible: false, exteriorColor: "black", interiorColor: "black" } },
  { name: "Toyota Sienna WAV", props: { bodyType: "VAN", seats: 6, year: 2021, make: "Toyota", luxury: false, wheelchairAccessible: true, exteriorColor: "white" } },
  { name: "Honda Accord (Comfort)", props: { bodyType: "SEDAN", seats: 5, year: 2022, make: "Honda", luxury: false, wheelchairAccessible: false, exteriorColor: "silver" } },
  { name: "Chrysler Pacifica (XL)", props: { bodyType: "MINIVAN", seats: 7, year: 2021, make: "Chrysler", luxury: false, wheelchairAccessible: false, exteriorColor: "gray" } },
  { name: "Old Toyota Corolla", props: { bodyType: "SEDAN", seats: 4, year: 2014, make: "Toyota", luxury: false, wheelchairAccessible: false, exteriorColor: "blue" } },
];

for (const vehicle of testVehicles) {
  const suggestion = suggestVehicleCategory(vehicle.props);
  console.log(`${vehicle.name}:`);
  console.log(`  Suggested: ${suggestion.suggestedCategory}`);
  console.log(`  Confidence: ${suggestion.confidence}`);
  console.log(`  Reasons: ${suggestion.reasons.join("; ")}\n`);
}

console.log("=== TEST 2: Category Definitions with Fare Multipliers ===\n");

for (const [id, cat] of Object.entries(VEHICLE_CATEGORIES)) {
  console.log(`${id}:`);
  console.log(`  Display: ${cat.displayName}`);
  console.log(`  Base Multiplier: ${cat.baseMultiplier}x`);
  console.log(`  Per-Mile Multiplier: ${cat.perMileMultiplier}x`);
  console.log(`  Per-Minute Multiplier: ${cat.perMinuteMultiplier}x`);
  console.log(`  Min Fare: $${cat.minimumFare}`);
  console.log(`  Seats: ${cat.seatCount}`);
  console.log(`  Active: ${cat.isActive}\n`);
}

console.log("=== TEST 3: Dispatch Eligibility Matrix (Driver Can Serve) ===\n");

const categories = ["SAFEGO_X", "SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", "SAFEGO_BLACK", "SAFEGO_BLACK_SUV", "SAFEGO_WAV"] as const;

console.log("Driver Category -> Can Serve These Request Types:");
for (const driverCat of categories) {
  const canServe = DISPATCH_ELIGIBILITY_MATRIX[driverCat];
  console.log(`  ${driverCat.replace("SAFEGO_", "")}: ${canServe.map(c => c.replace("SAFEGO_", "")).join(", ")}`);
}

console.log("\n=== TEST 4: Strict Category Matching (isCategoryCompatible) ===\n");

console.log("Testing strict matching (requestedCategory === driverCategory):");
const testCases = [
  { request: "SAFEGO_X", driver: "SAFEGO_X", expected: true },
  { request: "SAFEGO_X", driver: "SAFEGO_COMFORT", expected: false },
  { request: "SAFEGO_BLACK", driver: "SAFEGO_BLACK", expected: true },
  { request: "SAFEGO_BLACK", driver: "SAFEGO_BLACK_SUV", expected: false },
  { request: "SAFEGO_WAV", driver: "SAFEGO_WAV", expected: true },
  { request: "SAFEGO_WAV", driver: "SAFEGO_XL", expected: false },
];

for (const tc of testCases) {
  const result = isCategoryCompatible(tc.request as any, tc.driver as any);
  const status = result === tc.expected ? "PASS" : "FAIL";
  console.log(`  ${status}: ${tc.request} + ${tc.driver} => ${result} (expected: ${tc.expected})`);
}

console.log("\n=== TEST 5: canVehicleServeCategory (Hierarchical) ===\n");

console.log("Testing hierarchical matching:");
const hierarchyTests = [
  { vehicle: "SAFEGO_BLACK_SUV", request: "SAFEGO_X" },
  { vehicle: "SAFEGO_BLACK_SUV", request: "SAFEGO_COMFORT" },
  { vehicle: "SAFEGO_BLACK_SUV", request: "SAFEGO_BLACK" },
  { vehicle: "SAFEGO_BLACK_SUV", request: "SAFEGO_BLACK_SUV" },
  { vehicle: "SAFEGO_BLACK", request: "SAFEGO_XL" },
  { vehicle: "SAFEGO_XL", request: "SAFEGO_X" },
  { vehicle: "SAFEGO_WAV", request: "SAFEGO_X" },
];

for (const tc of hierarchyTests) {
  const result = canVehicleServeCategory(tc.vehicle as any, tc.request as any);
  const icon = result.isEligible ? "✓" : "✗";
  console.log(`  ${icon} ${tc.vehicle} serving ${tc.request}: ${result.isEligible ? "ELIGIBLE" : result.reason}`);
}

console.log("\n=== All Tests Complete ===");
