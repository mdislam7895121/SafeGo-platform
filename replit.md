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

### Step 34c: Update USA Driver Identity UI with Document Status Display (November 19, 2025)
- **Frontend Updates - Driver Details Page** (`/admin/drivers/:id` for USA drivers):
  - Added **Profile Photo Status** at top of USA Identity Information card:
    * If uploaded: Shows 64x64px rounded thumbnail with "View Full Size" link
    * If missing: Shows red warning text "Profile photo not uploaded"
    * Matches Bangladesh driver profile photo display pattern
  - Added **DMV License Documents section** (for all USA drivers):
    * DMV License Front: Link to view image or "Missing" warning
    * DMV License Back: Link to view image or "Missing" warning
    * DMV License Expiry: Formatted date or "Not provided" fallback
    * DMV License Number: Displayed when available (optional field)
  - Added **TLC License Documents section** (for New York drivers only):
    * Conditional rendering when `usaState === "NY"`
    * TLC License Front: Link to view image or "Missing" warning
    * TLC License Back: Link to view image or "Missing" warning
    * TLC License Expiry: Formatted date or "Not provided" fallback
    * TLC License Number: Displayed when available (optional field)
- **TypeScript Interface Updates**:
  - Added fields: `dmvLicenseFrontUrl`, `dmvLicenseBackUrl`, `dmvLicenseExpiry`, `dmvLicenseNumber`
  - Added fields: `tlcLicenseFrontUrl`, `tlcLicenseBackUrl`, `tlcLicenseExpiry`, `tlcLicenseNumber`
  - All fields use existing database schema (no migration required)
- **Read-Only Display**: All sections display-only, no upload functionality on this page
- **Security Maintained**:
  - SSN masking unchanged (still requires "Show SSN" button click)
  - Admin-only access enforced by existing middleware
  - Document URLs use secure linking pattern (target="_blank", rel="noopener noreferrer")
- **Layout Structure**:
  - Profile photo status at top (with border separator)
  - Existing identity fields in two-column grid (unchanged)
  - Address section (unchanged)
  - Emergency contact section (unchanged)
  - DMV documents section (new, border-top separator)
  - TLC documents section (new, conditional on NY state, border-top separator)
- **Impact**: NON-BREAKING - Frontend-only changes using existing database fields, matches Bangladesh completeness, no schema changes required