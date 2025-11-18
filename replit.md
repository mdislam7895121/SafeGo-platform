# SafeGo Global Super-App

## Overview

SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management. The business vision is to become a leading global super-app, capitalizing on the growing demand for integrated urban services.

## Recent Changes (November 18, 2025)

### Critical KYC Bug Fix - End-to-End Verification Flow
**Status:** ✅ Fully Tested & Working

**Issue:** Customer verification status wasn't updating in real-time after admin approval, preventing verified customers from requesting rides.

**Root Cause:**
1. Frontend relied solely on stale AuthContext data set during login
2. Customer dashboard didn't fetch fresh verification status from backend

**Solution Implemented:**
1. **Frontend Fix:** Updated `client/src/pages/customer/home.tsx` to fetch fresh data from `/api/customer/home` endpoint with 5-second polling
2. **Data Source:** Changed from `user?.profile?.isVerified` (AuthContext) to `customerData?.profile?.isVerified` (fresh API data)
3. **User Experience:** Added skeleton loading state while fetching, smooth transition when verification status updates

**Verified Working:**
- ✅ New customer registration creates profile with `verificationStatus="pending"`, `isVerified=false`
- ✅ Admin sees customer in pending KYC list at `/admin/kyc`
- ✅ Admin approval updates database: `verificationStatus="approved"`, `isVerified=true`
- ✅ Customer dashboard automatically refreshes and shows "✓ Verified" badge
- ✅ Verified customers can successfully request rides without 403 errors
- ✅ End-to-end test passed (registration → approval → verification → ride request)

## User Preferences

**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

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

**Architecture Pattern:**
- Component-based, role-specific page directories (`customer/`, `driver/`, `restaurant/`, `admin/`)
- Centralized API client with JWT authentication
- AuthContext for global authentication state

**Key Features:**
- Auto-redirect after login based on user role
- Protected routes with role-based access control
- Toast notifications, skeleton loading, error boundaries

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Framework**: Express.js 4 for REST API
- **ORM**: Prisma Client 6 with PostgreSQL
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: PostgreSQL 14+

**Core Features:**

1.  **Multi-Role Authentication System**
    -   Four distinct roles: customer, driver, restaurant, admin
    -   JWT token-based authentication with role-based middleware
    -   Country-specific registration and automatic profile creation

2.  **Country-Specific KYC System**
    -   Custom verification requirements for Bangladesh and United States
    -   Admin approval workflow with verification status tracking

3.  **Service Management**
    -   Lifecycle management for Ride-hailing, Food delivery, and Parcel delivery
    -   Status flow validation for each service

4.  **Commission & Wallet System**
    -   Defined commission structures for rides, food orders, and deliveries
    -   Supports cash payment model with negative balance tracking for commissions owed
    -   Online payment model with automatic commission deduction
    -   Admin wallet settlement functionality

5.  **Notification System**
    -   User notifications for service updates and KYC status changes

**Security Architecture:**
- JWT secret in environment variables, bcrypt password hashing
- Input validation using Zod schemas
- Role-based middleware, CSRF protection, SQL injection prevention (Prisma)

**Database Schema Design:**
- User table with role and linked role-specific profiles
- UUID primary keys, indexed foreign keys, decimal fields for monetary values
- Country-code based data separation

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