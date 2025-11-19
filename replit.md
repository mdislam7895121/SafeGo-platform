# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services, aiming to become a leading global super-app by integrating urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, React Hook Form with Zod.
- **Design System**: Custom HSL-based color palette (light/dark mode), Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control.
- **Key Features**: Admin panel for managing users and services, real-time data updates (5-10 second polling), interactive admin dashboard, customer ride history, optional GPS for ride requests, country-specific identity fields (Bangladesh NID, USA SSN with encryption), driver license and background check tracking, unified Document Center with tabbed interface (Drivers/Customers/Restaurants) for reviewing KYC submissions with approve/reject workflows and real-time refresh, enhanced Wallet Settlement System with overview stats, pending settlements table, transaction history breakdown, and quick settlement actions.

### Backend Architecture
- **Technology Stack**: Node.js 20+ with TypeScript (ESM), Express.js 4, Prisma Client 6 with PostgreSQL 14+, JWT authentication with bcrypt.
- **Core Features**: Multi-role authentication (customer, driver, restaurant, admin), country-specific KYC with admin approval, service lifecycle management (Ride-hailing, Food, Parcel), commission and wallet system (cash/online payments, negative balance), user notification system, management APIs for CRUD operations on users and complaints, country-based ride matching with FIFO ordering, centralized Document Center for reviewing KYC documents across all user types with search, filtering, and pagination, comprehensive Wallet Settlement System with transaction history aggregation from rides/deliveries/food orders, real-time balance tracking, and admin settlement processing.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt password hashing, AES-256-GCM encryption for sensitive data (NID, SSN), Zod input validation, role-based middleware, CSRF protection, SQL injection prevention via Prisma, admin-only decryption of sensitive data.
- **Database Schema Design**: UUID primary keys, indexed foreign keys, decimal types for monetary values, `isSuspended` fields, `DriverComplaint` model extended for restaurant complaints, country-specific identity fields for Bangladesh and USA drivers (nullable for backward compatibility), driver profile photos, structured USA driver names, DMV/TLC license images, `VehicleDocument` model for registration and insurance, Prisma schema uses PascalCase model names with @@map directives to snake_case table names for code clarity.

### Project Structure
- `client/`: React frontend
- `server/`: Express backend
- `prisma/`: Database schema
- `scripts/`: Seed data
- `attached_assets/`: Static assets
- `Documentation/`: Project documentation

## Recent Changes

### Step 33: Mandatory Postal Code for Bangladesh Driver Identity (November 19, 2025)
- **Schema Changes**:
  - Added `postalCode` field to both `DriverProfile` and `CustomerProfile` models (nullable for backward compatibility)
  - Successfully pushed schema changes to database using `npx prisma db push`
- **Backend Updates**:
  - Updated `updateDriverProfileSchema` and `updateCustomerProfileSchema` with 4-6 digit postal code validation (`/^[0-9]{4,6}$/`)
  - Added `postalCode` to PATCH `/api/admin/drivers/:id/profile` endpoint
  - Added `postalCode` to PATCH `/api/admin/customers/:id/profile` endpoint
  - Added `postalCode` to GET `/api/admin/documents/drivers/:id/details` response
  - Added `postalCode` to GET `/api/admin/documents/customers/:id/details` response
- **Frontend Updates**:
  - Added `postalCode` field to Document Review modal (`/admin/documents`) for Bangladesh drivers/customers
  - Added `postalCode` input to Admin Edit Bangladesh Profile modal (`/admin/drivers/:id`) with inline validation hint
  - Updated TypeScript interfaces: `Customer`, `DocumentDetails`, `DriverDetails`
  - Display shows "Not provided" for legacy records with null postal code (backward compatible)
- **Validation Rules**: Postal Code optional but must be 4-6 digits when provided (Bangladesh standard)
- **Impact**: NON-BREAKING - Nullable field, legacy data supported, no crashes with null values
- **Security**: Postal code treated as low-sensitivity address metadata, follows existing admin-only access patterns

### Step 31 Fix: Driver Management Regression (November 19, 2025)
- **Problem**: Driver Management page at `/admin/drivers` showed "No drivers found" despite 23 drivers in database
- **Root Cause**: Incorrect Prisma relation field name `stats` used instead of `driverStats` in 4 endpoints
  - GET /api/admin/drivers (list endpoint)
  - GET /api/admin/drivers/:id (detail endpoint)
  - PATCH /api/admin/drivers/:id/profile (Bangladesh profile update)
  - PATCH /api/admin/drivers/:id/usa-profile (USA profile update)
- **Fix**: Changed all `stats: true` includes to `driverStats: true` and updated all `driver.stats` accessors to `driver.driverStats`
- **Impact**: NON-BREAKING - Only field reference name changed, no schema changes, no logic changes
- **Verification**: 
  - Server logs clean (no more "Unknown field `stats`" Prisma validation errors)
  - No LSP/TypeScript errors
  - Admin dashboard stats endpoint working (shows 23 total drivers correctly)
- **Commission & Wallet**: No changes to commission calculation or wallet settlement logic (as required)

### Step 31: Enhanced Wallet Settlement System (November 2025)
- **Backend Enhancements**:
  - Added `/api/admin/settlement/overview` endpoint for platform-wide settlement statistics
  - Added `/api/admin/settlement/pending` endpoint with filtering and pagination for wallets needing settlement
  - Added `/api/admin/settlement/transaction-history/:type/:id` endpoint providing detailed service breakdowns from rides, deliveries, and food orders
  - All endpoints admin-only, no schema changes, fully backward compatible
- **Frontend Implementation**:
  - Complete rewrite of `/admin/settlement` page with comprehensive dashboard
  - Overview stats cards showing total pending settlements, wallets needing settlement, driver/restaurant breakdowns
  - Filterable pending settlements table (All/Drivers/Restaurants) with real-time data
  - Transaction history modal with service-level breakdown (rides, deliveries, food orders) and recent transactions table
  - Quick settlement actions with pre-filled amounts and immediate cache invalidation
  - Defensive error handling with optional chaining and fallback values
  - 10-second auto-refresh for real-time updates
- **Data Integrity**: All data fetched from existing `rides`, `deliveries`, `food_orders` tables; settlement operations update `driver_wallets` and `restaurant_wallets` negative balances without breaking existing workflows

### Step 30: Admin Document Center (November 2025)
- Unified document review interface with three tabs (Drivers, Customers, Restaurants)
- 12 new admin-only API endpoints for document listing, details, and approval workflows
- Search, country filter, status filter with URL persistence
- Real-time auto-refresh (5-second polling) for document submissions
- Fixed Prisma schema mapping (PascalCase models with @@map to snake_case tables)
- Secure implementation verified by architect (no exposure of decrypted NID/SSN)

## External Dependencies

### Production Dependencies
- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: JWT signing secret.
- `NODE_ENV`: Environment mode.
- `ENCRYPTION_KEY`: 32-byte encryption key for NID and SSN.