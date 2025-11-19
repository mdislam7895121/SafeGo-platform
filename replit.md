# SafeGo Global Super-App

## Overview

SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management. The business vision is to become a leading global super-app, capitalizing on the growing demand for integrated urban services.

## User Preferences

**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## Recent Updates (November 2025)

### Bangladesh Identity Fields with Encrypted NID Storage (Latest - Nov 19, 2025)
**Comprehensive Bangladesh-specific identity fields for customers and drivers with secure NID encryption:**

**Security Implementation:**
- **AES-256-GCM Encryption**: NID numbers encrypted at rest using authenticated encryption
- **Secure Key Management**: 32-byte ENCRYPTION_KEY required via environment variable (fails fast if missing)
- **Admin-Only Decryption**: Dedicated endpoints for NID decryption accessible only to admins
- **Data Integrity**: Authentication tags prevent tampering, legacy CBC fallback for existing data
- **No Data Exposure**: nidEncrypted explicitly excluded from all detail API responses

**Database Schema Changes:**
- `CustomerProfile` and `DriverProfile` tables extended with Bangladesh fields:
  - `fullName` (String, optional) - Complete legal name
  - `fatherName` (String, optional) - Father's name
  - `phoneNumber` (String, optional) - Bangladesh mobile number
  - `village` (String, optional) - Village name
  - `postOffice` (String, optional) - Post office
  - `thana` (String, optional) - Thana/Upazila
  - `district` (String, optional) - District
  - `presentAddress` (String, optional) - Current address
  - `permanentAddress` (String, optional) - Permanent address
  - `nidEncrypted` (String, optional) - Encrypted National ID (AES-256-GCM)
- All fields optional for backward compatibility with existing US/other country data
- Legacy `nidNumber` field preserved for fallback

**API Endpoints:**
- `GET /api/admin/customers/:id` - Returns all Bangladesh fields except nidEncrypted
- `GET /api/admin/drivers/:id` - Returns all Bangladesh fields except nidEncrypted
- `GET /api/admin/customers/:id/nid` - Decrypt and return customer NID (admin-only, secure)
- `GET /api/admin/drivers/:id/nid` - Decrypt and return driver NID (admin-only, secure)

**Frontend Features:**
- **Customer Details Page**: Bangladesh Identity Information card (BD users only) with Show/Hide NID button
- **Driver Details Page**: Bangladesh Identity Information card (BD users only) with Show/Hide NID button
- **Secure NID Display**: Click "Show NID" to decrypt and display, "Hide" to conceal
- **Conditional Rendering**: Bangladesh section only visible for countryCode === "BD"
- **NID Image Links**: View NID front/back images if available

**Encryption Utility (`server/utils/encryption.ts`):**
- `encrypt(text)`: AES-256-GCM encryption returning `iv:authTag:ciphertext`
- `decrypt(encryptedText)`: Verifies auth tag and decrypts, throws on tampering
- Legacy CBC fallback for migrating old data
- Validation helpers: `isValidBdNid()`, `isValidBdPhone()`

**Environment Variables:**
- `ENCRYPTION_KEY` (required): 32-byte encryption key for NID protection

### Customer Management System
**Complete admin-side customer management capabilities:**
- **Customer List** (`/admin/customers`): Comprehensive table showing all customers with email, country, KYC status, account status, and usage statistics (rides, food orders, parcels)
- **Search & Filters**: Search by email, filter by status (All/Active/Suspended/Blocked)
- **Customer Details** (`/admin/customers/:id`): Detailed view with profile info, KYC status, usage statistics, recent activity (rides, food orders, deliveries), and complaints
- **Admin Actions**:
  - **Suspend/Unsuspend**: Temporary suspension preventing order placement (requires reason)
  - **Block/Unblock**: Permanent account disablement (affects user.isBlocked)
- **Usage Statistics**: Real-time tracking of customer activity:
  - Total and completed rides
  - Total and completed food orders
  - Total and completed parcel deliveries
  - Open complaints count
- **Dashboard Integration**: 
  - Customers card is clickable → `/admin/customers`
  - Customer Management section in main management area
  - Total customers count displayed in Platform Overview
- **Auto-refresh**: 5-second polling on all customer management pages
- **Security**: All routes protected with admin-only middleware

**Database Schema Changes:**
- `CustomerProfile` table: Added `isSuspended`, `suspensionReason`, `suspendedAt` fields
- All changes backward-compatible with existing data

**API Endpoints:**
- `GET /api/admin/customers?search=<email>&status=<active|suspended|blocked>` - List with filters and usage stats
- `GET /api/admin/customers/:id` - Details with full activity history
- `PATCH /api/admin/customers/:id/suspend` - Suspend with reason
- `PATCH /api/admin/customers/:id/unsuspend` - Remove suspension
- `PATCH /api/admin/customers/:id/block` - Block account
- `PATCH /api/admin/customers/:id/unblock` - Unblock account
- `GET /api/admin/stats` - Now includes `totalCustomers` count

**Bug Fix (Nov 19, 2025):**
- Fixed malformed URL construction in customer list query - was calling `/api/admin/customers/list/[object Object]` instead of `/api/admin/customers`
- Updated query key pattern to match driver/restaurant management (build full URL with query params)
- Fixed mutation functions to use correct apiRequest signature

### Restaurant Management System
**Complete admin-side restaurant management capabilities:**
- **Restaurant List** (`/admin/restaurants`): Simple table showing all restaurants with email, name, country, KYC status, account status, wallet balance, and total orders
- **Search & Filters**: Search by email, filter by status (All/Active/Suspended/Blocked)
- **Restaurant Details** (`/admin/restaurants/:id`): Comprehensive view with profile info, KYC status, wallet details (balance, owed amounts), order statistics, recent orders, and complaints
- **Admin Actions**:
  - **Suspend/Unsuspend**: Temporary suspension preventing order reception (requires reason)
  - **Block/Unblock**: Permanent account disablement (affects user.isBlocked)
- **KYC Integration**: Restaurants tab in `/admin/kyc` for approving/rejecting restaurant verification
- **Dashboard Integration**: 
  - Restaurants card is clickable → `/admin/restaurants`
  - Pending KYC count includes drivers + customers + restaurants
  - Open Complaints includes both driver and restaurant complaints
- **Auto-refresh**: 5-second polling on all restaurant management pages
- **Security**: All routes protected with admin-only middleware

**Database Schema Changes:**
- `RestaurantProfile` table: Added `isSuspended`, `suspensionReason`, `suspendedAt` fields
- `DriverComplaint` table extended for restaurants: Added `type` field (driver/restaurant), made `driverId` optional, added `restaurantId` field
- All changes backward-compatible with existing data

**API Endpoints:**
- `GET /api/admin/restaurants` - List with filters
- `GET /api/admin/restaurants/:id` - Details with stats
- `PATCH /api/admin/restaurants/:id/suspend` - Suspend with reason
- `PATCH /api/admin/restaurants/:id/unsuspend` - Remove suspension
- `PATCH /api/admin/restaurants/:id/block` - Block account
- `PATCH /api/admin/restaurants/:id/unblock` - Unblock account
- `GET /api/admin/stats` - Now includes `pendingRestaurants` count
- `POST /api/admin/kyc/approve` - Supports `role: "restaurant"`
- `POST /api/admin/kyc/reject` - Supports `role: "restaurant"`

### Interactive Admin Dashboard
**All statistic cards are now fully interactive** with proper navigation, hover effects, and security:
- Total Users → /admin/users (with role filtering)
- Total Drivers → /admin/drivers (with full search and filters)
- Active Drivers → /admin/drivers?status=active (filtered view)
- Restaurants → /admin/restaurants (NEW - with search and filters)
- Pending KYC → /admin/kyc (includes all roles: drivers, customers, restaurants)
- Suspended Drivers → /admin/drivers?status=suspended
- Blocked Drivers → /admin/drivers?status=blocked
- Open Complaints → /admin/complaints (includes driver and restaurant complaints)

**Implementation Details:**
- All cards use `hover-elevate` class for interactive feedback
- Frontend reads query params from URL on mount for proper filtering
- Backend supports `status` query parameter for active/suspended/blocked filtering
- New /admin/users page with user listing, role filtering, and auto-refresh
- All routes protected with ProtectedRoute (admin-only access)
- Auto-refresh every 5 seconds on dashboard and all admin list pages

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Library**: shadcn/ui components (Radix UI primitives)
- **Styling**: Tailwind CSS 3
- **State Management**: TanStack Query v5
- **Routing**: wouter
- **Form Handling**: React Hook Form with Zod validation

**Design System:**
- Custom HSL-based color palette with light/dark mode
- Typography: Inter (primary), Manrope (secondary)
- Mobile-first responsive design
- Skeleton loading states, toast notifications, error boundaries
- Auto-redirect after login based on user role, protected routes with role-based access control.

**Key Features:**
- Comprehensive admin panel for managing drivers (listing, suspension, blocking, complaints, statistics).
- Real-time data updates via 5-second polling for critical dashboards and lists.
- Driver management actions (suspend, block, delete) with confirmation dialogs and cache invalidation.
- Complaint tracking and resolution workflow.
- Customer ride history display.
- Enhanced Admin Dashboard with driver-specific metrics.
- GPS coordinates for ride requests are optional, enabling address-based matching.

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Framework**: Express.js 4 for REST API
- **ORM**: Prisma Client 6 with PostgreSQL
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: PostgreSQL 14+

**Core Features:**
- **Multi-Role Authentication System**: Supports customer, driver, restaurant, and admin roles with JWT-based, role-specific access.
- **Country-Specific KYC System**: Custom verification for Bangladesh and United States with admin approval.
- **Service Management**: Lifecycle management for Ride-hailing, Food delivery, and Parcel delivery with status flow validation.
- **Commission & Wallet System**: Supports cash and online payments with commission tracking, negative balance support, and admin settlement.
- **Notification System**: User notifications for service updates and KYC status.
- **Driver Management API**: Endpoints for driver listing, details, suspension, blocking, and deletion (with validation).
- **Complaint Management API**: Endpoints for listing, viewing details, and resolving complaints.
- **Ride Matching**: Country-based ride matching, filtering rides by driver's country and status, FIFO ordering.

**Security Architecture:**
- Environment variable-based JWT secret, bcrypt hashing for passwords.
- AES-256-GCM encryption for sensitive data (NID numbers) with 32-byte ENCRYPTION_KEY.
- Zod schema for input validation, role-based middleware, CSRF protection, and SQL injection prevention via Prisma.
- Admin-only endpoints for decrypting sensitive data with authentication tag verification.

**Database Schema Design:**
- User table linked to role-specific profiles.
- UUID primary keys, indexed foreign keys, decimal types for monetary values.
- `isSuspended`, `suspensionReason`, `suspendedAt` fields for drivers, customers, and restaurants.
- `DriverComplaint` model linking driver, customer, and ride.
- Bangladesh-specific identity fields (fullName, fatherName, phoneNumber, village, postOffice, thana, district, addresses, nidEncrypted) for customers and drivers.

### Project Structure:
- `client/`: React frontend
- `server/`: Express backend with routes and middleware
- `prisma/`: Database schema
- `scripts/`: Seed data
- `attached_assets/`: Static assets
- `Documentation/`: Project documentation

## External Dependencies

### Production Dependencies

**Backend Core:**
- `@prisma/client`: Type-safe database client
- `express`: Web framework
- `bcrypt`: Password hashing
- `jsonwebtoken`: JWT authentication
- `@neondatabase/serverless`: PostgreSQL driver

**Frontend Core:**
- `react`, `react-dom`: UI library
- `wouter`: Client-side routing
- `@tanstack/react-query`: Server state management
- `react-hook-form`: Form management
- `zod`: Schema validation

**UI Components (shadcn/ui):**
- `@radix-ui/*`: Headless component primitives
- `lucide-react`: Icon library
- `class-variance-authority`: Component variants
- `tailwind-merge`, `clsx`: CSS utilities

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `NODE_ENV`: Environment mode (development/production)