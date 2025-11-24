# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. Its purpose is to provide a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, comprehensive multi-role support ticket management, and driver identity & profile management (Phase D1).

---

## Driver Phase D1 – Analysis & Implementation

### Existing Driver Infrastructure

**Database Models (Prisma):**
- `DriverProfile` - Comprehensive model with 50+ fields supporting:
  - **Bangladesh KYC**: nidNumber (encrypted), fatherName, presentAddress, permanentAddress, district, thana, village, postOffice
  - **USA KYC**: firstName, middleName, lastName, dmvLicenseNumber (encrypted), dmvLicenseExpiry, tlcLicenseNumber, tlcLicenseExpiry, ssnLast4 (encrypted), backgroundCheckStatus
  - **Common fields**: profilePhotoUrl, dateOfBirth, phoneNumber, emergencyContactName/Phone/Relationship
  - **Verification**: verificationStatus (pending/approved/rejected), isVerified, rejectionReason
  - **Tax compliance**: W-9 status, 1099-K/1099-NEC tracking, tax year
  - **Preferences**: Navigation app, auto-accept rides, notification settings, theme/language
  - **Security**: securityStatus (normal/flagged/suspended), securityNotes, isSuspended
  
- `Vehicle` (1:1 with driver) - Fields:
  - Basic: vehicleType, vehicleModel, make, year, color, licensePlate
  - Registration: registrationDocumentUrl, registrationExpiry, registrationStatus
  - Insurance: insuranceDocumentUrl, insuranceExpiry, insuranceStatus  
  - DMV Inspection: dmvInspectionType, dmvInspectionDate, dmvInspectionExpiry, verification status
  - **Limitation**: Current schema has `driverId @unique` - only supports 1 vehicle per driver

- `VehicleDocument` - Document storage with:
  - documentType, fileUrl, uploadedAt, expiresAt
  - Linked to both driver and vehicle (optional vehicleId)

- `DriverStats` (1:1) - rating, totalTrips
- `DriverWallet` (1:1) - balance, negativeBalance

**Backend Routes (`server/routes/driver.ts`):**
- GET `/api/driver/home` - Dashboard data (profile, vehicle, stats, wallet)
- PATCH `/api/driver/profile` - Update profile (USA/Bangladesh KYC fields)
- POST `/api/driver/vehicle` - Register vehicle
- PATCH `/api/driver/vehicle` - Update vehicle
- PATCH `/api/driver/status` - Toggle online/offline
- GET `/api/driver/wallet` - Wallet details + transactions
- GET `/api/driver/blocked-riders` - List blocked customers
- Account settings endpoints (name, email, password, preferences)

**Admin Routes (`server/routes/admin.ts`):**
- GET `/api/admin/drivers` - List drivers with filters
- GET `/api/admin/drivers/:id` - Driver detail view
- PATCH `/api/admin/kyc/:userId` - Approve/reject KYC

**Frontend Pages:**
- `/driver` - Home dashboard (`client/src/pages/driver/home.tsx`)
- `/driver/profile` - Public profile (`client/src/pages/driver/profile.tsx`)
- `/driver/vehicle` - Vehicle management (`client/src/pages/driver/vehicle.tsx`)
- `/driver/wallet` - Wallet & transactions (`client/src/pages/driver/wallet.tsx`)
- `/driver/kyc-documents` - Document upload (`client/src/pages/driver/kyc-documents.tsx`)
- `/driver/account/*` - Settings (payment, map, tax, preferences)
- `/driver/support/*` - Support center, chat, tickets
- `/admin/drivers` - Admin driver list
- `/admin/driver-details/:id` - Admin driver detail

### D1 Requirements Gap Analysis

**✅ Already Complete:**
1. DriverProfile model with USA (NYC) KYC fields (DMV license, TLC license, SSN last4)
2. Encryption for sensitive fields (nidEncrypted, ssnEncrypted, dmvLicenseNumber_encrypted)
3. Background check tracking (status, date, provider)
4. Emergency contact fields
5. Document upload system (VehicleDocument model)
6. Admin KYC approval workflow
7. Audit logging infrastructure (can extend for driver mutations)
8. Profile photo support
9. Existing driver routes and frontend pages

**🔧 Needs Enhancement:**
1. **Multi-vehicle support**: Change Vehicle.driverId from `@unique` to allow 1:N relationship, add `isPrimary` boolean
2. **Onboarding wizard**: No dedicated multi-step onboarding flow exists (only separate profile/vehicle pages)
3. **KYC status centralization**: Currently scattered across DriverProfile fields, need unified status model
4. **Document upload endpoints**: Need REST endpoints for profile picture, license images, vehicle photos (similar to restaurant image uploads)
5. **Enhanced vehicle model**: Add insurancePolicyNumber, isActive for soft-delete
6. **KYC timeline UI**: Frontend doesn't show KYC progression (NOT_STARTED → PENDING_REVIEW → VERIFIED)

**❌ Blocking Issues:**
None - existing infrastructure is solid, only needs extensions.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It incorporates a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Specific features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System. The SafeGo Eats restaurant portal features a professional UI/UX, including a redesigned header, unified feature placeholders, a comprehensive responsive layout system, and WCAG 2.1 AA compliant search and notification UX.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. A Generic Service Layer with Role Adapters is used for DRY principle implementation across various services.

Core systems and features include:
-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types, including US 1099 Tax System and Bangladesh Tax Reporting System.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, automatic/manual escalation, and an Admin Live Support Console. This system supports Live Chat, Phone Support, and Email/Ticket Support across all user roles with dedicated database models, a generic service layer with role-specific adapters, and comprehensive backend APIs.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles.
-   **Driver Wallet System**: Displays balance, payouts, and transaction timeline, supporting country-specific currencies.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Analytics & Management Systems**: Includes Performance Insights with KPI tracking, time-series charts, and recent orders table. Also includes Review & Rating Management, Media Gallery & Branding Management, and Operational Settings System.
-   **Restaurant Order Management System**: Production-ready order lifecycle management enabling restaurant staff to accept/reject/update order status with real-time synchronization. Implements React Query key factory pattern for hierarchical cache management.
-   **Restaurant Staff & Role Management System**: Enables restaurant owners to invite team members, assign granular permissions, and track staff activity.
-   **Restaurant Promotions & Coupon Management System**: Allows creation, management, and tracking of promotional campaigns. Features 8 promotion management endpoints with KYC-gated access control and full audit logging.
-   **Restaurant Reviews & Ratings System**: Enables customers to leave reviews, restaurants to reply, and admins to moderate content.
-   **Restaurant Earnings & Commission Center**: Manages commission tracking and earnings for the SafeGo Eats restaurant portal, including hierarchical commission calculation and wallet integration for reversals.
-   **Relational Menu Category System with Smart Search & Auto-Suggest**: Provides a fully relational categorization system for SafeGo Eats with smart category search and an auto-suggest engine.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade implementation for managing customer payment methods and payout rails by country, service type, actor type, and KYC level.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals across all user roles with unified API routes. Features include automatic weekly payout scheduling, bank verification, country-specific minimum payout amounts, and comprehensive withdrawal request validation.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.