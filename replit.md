# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services, aiming to become a leading global super-app by integrating urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
- **Technology Stack**: React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, React Hook Form with Zod.
- **Design System**: Custom HSL-based color palette (light/dark mode), Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control.

### Technical Implementations
- **Frontend Features**: Admin panel for managing users and services, real-time data updates (5-10 second polling), interactive admin dashboard, customer ride history, optional GPS for ride requests, country-specific identity fields (Bangladesh NID, USA SSN with encryption), driver license and background check tracking, unified Document Center with tabbed interface for reviewing KYC submissions, and an enhanced Wallet Settlement System with overview stats, pending settlements, and transaction history.
- **Backend Technology Stack**: Node.js 20+ with TypeScript (ESM), Express.js 4, Prisma Client 6 with PostgreSQL 14+, JWT authentication with bcrypt.
- **Core Backend Features**: Multi-role authentication (customer, driver, restaurant, admin), country-specific KYC with admin approval, service lifecycle management (Ride-hailing, Food, Parcel), commission and wallet system (cash/online payments, negative balance), user notification system, management APIs for CRUD, country-based ride matching with FIFO ordering, centralized Document Center, and a comprehensive Wallet Settlement System.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt password hashing, AES-256-GCM encryption for sensitive data (NID, SSN), Zod input validation, role-based middleware, CSRF protection, SQL injection prevention via Prisma, admin-only decryption of sensitive data.
- **Database Schema Design**: UUID primary keys, indexed foreign keys, decimal types for monetary values, `isSuspended` fields, `DriverComplaint` model extended for restaurant complaints, country-specific identity fields, driver profile photos, structured USA driver names, DMV/TLC license images, `VehicleDocument` model for registration and insurance, Prisma schema uses PascalCase model names with @@map directives to snake_case table names.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL` (PostgreSQL connection string), `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY` (for NID and SSN).

## Recent Changes

### Step 37: Driver Commission & Wallet Summary Analytics (November 19, 2025)
- **Objective**: Read-only analytics dashboard showing commission breakdown, wallet balance, and transaction history for drivers without modifying commission calculation or payout logic
- **Backend API** (`server/routes/admin.ts`):
  * **GET `/api/admin/drivers/:id/wallet-summary`** - New endpoint providing comprehensive driver financial analytics
    - Aggregates total trips, earnings, commission across Rides, FoodOrders, Deliveries using efficient Prisma aggregations
    - Computes current wallet balance (balance - negativeBalance) with status indicator (positive/negative/zero)
    - **Country Breakdown** - Groups stats by customer country (BD vs US) via customer profile joins for accurate attribution
    - **Service Breakdown** - Separate stats for rides, food orders, parcel deliveries with counts/earnings/commission
    - **Recent Transactions** - Returns last 10 completed trips/orders merged and sorted by timestamp
    - Admin-only access via role-based middleware
- **Frontend UI** (`client/src/pages/admin/driver-details.tsx`):
  * **Commission & Wallet Summary Card** - New analytics card on Driver Details page displaying:
    - **At-a-glance Stats**: Total Trips, Total Earnings, Total Commission, Current Balance (4-column grid)
    - **Service Breakdown**: Rides, Food Orders, Parcel Deliveries sections showing trips/earnings/commission per service
    - **Country Breakdown**: BD vs US statistics with proper currency symbols (৳ for Bangladesh, $ for USA)
    - **Recent Transactions**: List of last 10 transactions with service type, amounts, commission, timestamps
  * **Currency Formatting** - New `formatCurrency()` helper function:
    - ৳ symbol for Bangladesh (BDT) amounts
    - $ symbol for USA (USD) amounts
    - Locale-aware number formatting with 2 decimal places
    - Graceful handling of invalid/null amounts (displays "—")
  * **Balance Status Indicators**: 
    - Green color for positive balance (SafeGo owes driver)
    - Red color for negative balance (Driver owes SafeGo)
    - Gray for zero balance
- **Performance Optimization**:
  * Uses Prisma `_count`, `_sum` aggregations instead of fetching all records
  * Customer joins optimize country attribution without N+1 queries
  * Transaction list limited to last 10 for efficient rendering
- **Data Integrity & Edge Cases**:
  * Handles drivers with no trips gracefully (shows zeros, no crashes)
  * Decimal precision maintained for financial calculations
  * Country breakdown only displays countries with actual transactions
  * Recent transactions conditionally rendered (only if data exists)
- **Security**: Admin-only endpoint, no sensitive data exposure, read-only operations
- **Backward Compatibility**: NON-BREAKING - New endpoint and UI component, no schema changes
- **Deferred Enhancements**: Optional Driver Management list page columns/filters (balance status) deferred for future iteration
- **Architect Review**: PASS - Confirmed read-only compliance, efficient aggregations, correct country breakdown, proper currency formatting, graceful degradation, no security issues
- **Impact**: PRODUCTION-READY - Read-only analytics feature providing comprehensive driver financial overview for admin decision-making

### Step 36: USA Driver DMV Inspection Module (November 19, 2025)
- **Database Schema Updates** - Extended Vehicle model with DMV inspection tracking:
  * Added `dmvInspectionType` (String, nullable) - Type of inspection (Safety, Emissions, Safety + Emissions, Other)
  * Added `dmvInspectionDate` (DateTime, nullable) - Date when inspection was performed
  * Added `dmvInspectionExpiry` (DateTime, nullable) - When inspection expires
  * Added `dmvInspectionImageUrl` (String, nullable) - URL to inspection certificate/document image
  * Added `dmvInspectionStatus` enum (MISSING, EXPIRED, VALID) - Server-computed status for validation
  * All fields nullable for backward compatibility with existing vehicles
- **Backend API** (`server/routes/admin.ts`):
  * **PATCH `/api/admin/drivers/:id/vehicle`** - Extended to accept DMV inspection fields
    - Accepts type, date, expiry, and imageUrl
    - Automatically computes `dmvInspectionStatus`: MISSING (no data), EXPIRED (past expiry), VALID (all fields present and not expired)
    - Server-side status computation prevents client-server divergence
  * **GET `/api/admin/drivers/:id`** - Returns all DMV inspection fields including computed status
  * **validateDriverKYC** - Extended for USA drivers to require:
    - DMV inspection type, date, expiry date, and document image
    - Only `dmvInspectionStatus === "VALID"` passes validation
    - Rejects MISSING, EXPIRED, null, undefined, or any unexpected status values
    - Provides specific error messages: "DMV inspection has expired", "DMV inspection is missing", "DMV inspection status is not valid"
- **Frontend Updates** - Driver Details Page (`/admin/drivers/:id` for USA drivers):
  * **DMV Inspection Section** - New card displayed below Vehicle Information card
    - Shows inspection type, date performed, expiry date
    - Status badge: Green "Valid", Red "Expired", Gray "Missing"
    - Warning banner for missing/expired inspections with clear messaging
    - Document link to view/download inspection certificate
    - Defensive coding: optional chaining (`driver.vehicle?.dmvInspectionStatus`) throughout
  * **Edit Vehicle Dialog** - Extended with DMV Inspection fields
    - Inspection Type dropdown: Safety, Emissions, Safety + Emissions, Other
    - Inspection Date picker
    - Inspection Expiry Date picker
    - Inspection Document URL input with helper text
    - Separator and section heading for visual clarity
    - All fields pre-populated when editing, handles missing data with empty defaults
- **Document Review Page Integration** (`client/src/pages/admin/documents.tsx`):
  * DMV Inspection document displayed in Vehicle Documents section for USA drivers
  * Shows inspection type, expiry date, and status badge (Valid/Expired/Missing)
  * View button to open inspection document in new tab
  * TypeScript interface updated: added 5 DMV inspection fields to `DocumentDetails.vehicle`
- **Validation & Error Handling**:
  * Robust edge case handling: null/undefined/unexpected status values treated as invalid
  * Only explicit "VALID" status passes KYC validation for USA drivers
  * Missing or expired inspections prevent driver verification approval
  * Clear error messages guide admins to complete missing data
- **Backward Compatibility**:
  * All DMV inspection fields nullable - existing vehicles work seamlessly
  * Bangladesh drivers unaffected (validation scoped to countryCode === "US")
  * USA drivers without inspection data display "No DMV inspection information" gracefully
  * Frontend TypeScript interfaces use `string | null` for all inspection fields
  * Legacy vehicle registration fallback does not bypass inspection requirement
- **Security & Architecture**:
  * Admin-only access via role-based middleware
  * URL validation for inspection document (same pattern as registration/insurance)
  * Server-side status computation ensures data integrity
  * No security vulnerabilities introduced (architect-verified)
- **Impact**: NON-BREAKING - Schema extension with nullable fields, enhanced KYC validation for USA drivers, production-ready with comprehensive edge case handling

### Step 35: USA Driver Vehicle Information Module (November 19, 2025)
- **Database Schema Updates** - Extended Vehicle model:
  * Added USA-specific fields to Vehicle model: `make`, `model`, `year` (Int), `color`, `licensePlate`
  * Added document tracking: `registrationDocumentUrl`, `registrationExpiry`, `insuranceDocumentUrl`, `insuranceExpiry`
  * All new fields nullable for backward compatibility with existing records
  * Maintains `isPrimary` boolean (default true) for future multi-vehicle support
- **Backend API** (`server/routes/admin.ts`):
  * New PATCH endpoint: `/api/admin/drivers/:id/vehicle` - Updates vehicle information for any driver
  * Validates year as integer, accepts URLs for registration/insurance documents with expiry dates
  * Returns updated vehicle data with success confirmation
  * Admin-only access with role-based middleware protection
- **Frontend Updates** - Driver Details Page (`/admin/drivers/:id`):
  * **Vehicle Information Card** - New section displayed after Emergency Contact section for all drivers
    - Displays vehicle type (sedan/suv/van/truck/motorcycle), make, model, year, color, license plate
    - Shows registration and insurance documents with upload status indicators
    - Document links open in new tabs with view/download functionality
    - Expiry dates displayed with visual formatting
    - Positioned at bottom of page after Emergency Contact section
  * **Edit Vehicle Dialog** - Modal form for updating vehicle information
    - Vehicle type dropdown (sedan, suv, van, truck, motorcycle, other)
    - Text inputs for make, model, year, color, license plate
    - URL inputs for registration and insurance documents with helper text
    - Date pickers for registration and insurance expiry dates
    - Save/Cancel buttons with loading states and error handling
    - Pre-populates existing values when opened, handles missing data gracefully
- **Document Review Page Integration**:
  * Vehicle documents (registration/insurance) displayed in dedicated section for USA drivers
  * Shows document upload status with pending/uploaded indicators
  * Links to view/download documents with expiry date information
- **Backward Compatibility**:
  * All vehicle fields nullable - existing drivers without vehicle data work seamlessly
  * Frontend handles missing vehicle gracefully (shows "No vehicle information" message)
  * Edit form backward-compatible with old `vehicleModel`/`vehiclePlate` fields
- **Impact**: NON-BREAKING - Schema extension with nullable fields, new admin UI module, maintains full backward compatibility

### HOTFIX: Driver Details Page Runtime Error Fix (November 19, 2025)
- **Issue**: Runtime error "undefined is not an object (evaluating 'driver.user.countryCode')" occurring after Step 35 updates
- **Root Cause**: Backend API response had flattened user properties (userId, email, countryCode) but frontend TypeScript interface expected nested user object
- **Backend Fixes** (`server/routes/admin.ts`):
  * Updated GET `/api/admin/drivers/:id` endpoint to include nested `user` object: `{ id, email, countryCode, isBlocked }`
  * Maintained backward compatibility by keeping flattened properties alongside nested object
  * Removed duplicate properties (dateOfBirth, emergencyContactName, emergencyContactPhone) from response
  * Added missing USA driver fields to response:
    - Profile photo: `profilePhotoUrl`
    - Name fields: `firstName`, `middleName`, `lastName`
    - DMV license: `dmvLicenseFrontUrl`, `dmvLicenseBackUrl`, `dmvLicenseExpiry`, `dmvLicenseNumber`
    - TLC license: `tlcLicenseFrontUrl`, `tlcLicenseBackUrl`, `tlcLicenseExpiry`, `tlcLicenseNumber`
    - Vehicle fields: `make`, `model`, `year`, `color`, `licensePlate`, `registrationDocumentUrl`, `registrationExpiry`, `insuranceDocumentUrl`, `insuranceExpiry`
- **Frontend Fixes** (`client/src/pages/admin/driver-details.tsx`):
  * Added defensive optional chaining: changed `driver.user.countryCode` to `driver.user?.countryCode` (line 1357)
  * Prevents runtime crash when user object is missing or undefined
- **Backward Compatibility**: Both flattened and nested user properties included in response, ensuring compatibility with all frontend consumers
- **Impact**: CRITICAL FIX - Resolves runtime crash in Driver Details page, adds missing fields, improves data consistency

### Step 34e: USA Driver Name Fields and Emergency Contact Layout Update (November 19, 2025)
- **Frontend Updates - Driver Details Page** (`/admin/drivers/:id` for USA drivers):
  - **Name Display Restructured**:
    * Read-only view now displays First Name / Middle Name / Last Name separately instead of single "Full Legal Name"
    * Uses helper function `splitFullName()` to parse existing `usaFullLegalName` field (first, middle, last)
    * Middle name conditionally displayed (only when present)
  - **Edit Form Updated**:
    * Replaced single "Full Legal Name" input with three separate fields: First Name, Middle Name (Optional), Last Name
    * Uses helper function `joinFullName()` to combine fields back into `usaFullLegalName` before saving
    * Maintains backward compatibility with existing database schema (no migration required)
  - **Layout Restructuring**:
    * Emergency Contact section moved to bottom of USA Identity Information card (after DMV and TLC sections)
    * Final layout order: Profile Photo → Identity Fields → Address → DMV Documents → TLC Documents (NY only) → Emergency Contact
    * All sections maintain border-top separators for visual clarity
- **Backward Compatibility**:
  - Helper functions: `splitFullName(fullName)` returns `{firstName, middleName, lastName}`
  - Helper functions: `joinFullName(first, middle, last)` returns combined string
  - Existing `usaFullLegalName` field in database unchanged
  - Display layer transformation only (no backend/schema changes)
- **Previous Changes (Step 34c)** - Still Active:
  - Profile Photo Status at top of USA Identity Information card
  - DMV License Documents section (all USA drivers)
  - TLC License Documents section (NY drivers only)
  - All document links and expiry dates displayed
- **Impact**: NON-BREAKING - Frontend-only changes using helper functions, maintains database schema, improves name clarity and layout consistency