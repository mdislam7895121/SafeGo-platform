# SafeGo Global Super-App

## Overview

SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management. The business vision is to become a leading global super-app, capitalizing on the growing demand for integrated urban services.

## User Preferences

**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## Recent Updates (November 2025)

### Restaurant Management System (Latest)
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
- Zod schema for input validation, role-based middleware, CSRF protection, and SQL injection prevention via Prisma.

**Database Schema Design:**
- User table linked to role-specific profiles.
- UUID primary keys, indexed foreign keys, decimal types for monetary values.
- `isSuspended`, `suspensionReason`, `suspendedAt` fields for drivers.
- `DriverComplaint` model linking driver, customer, and ride.

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