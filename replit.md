# SafeGo Global Super-App

## Overview

SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management. The business vision is to become a leading global super-app, capitalizing on the growing demand for integrated urban services.

## User Preferences

**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## Recent Updates (November 2025)

### Interactive Admin Dashboard
**All statistic cards are now fully interactive** with proper navigation, hover effects, and security:
- Total Users → /admin/users (with role filtering)
- Total Drivers → /admin/drivers (with full search and filters)
- Active Drivers → /admin/drivers?status=active (filtered view)
- Pending KYC → /admin/kyc
- Suspended Drivers → /admin/drivers?status=suspended
- Blocked Drivers → /admin/drivers?status=blocked
- Open Complaints → /admin/complaints

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