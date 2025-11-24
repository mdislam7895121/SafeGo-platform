# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. Its purpose is to provide a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, comprehensive multi-role support ticket management, and driver identity & profile management. The platform aims to be a comprehensive solution for integrated urban services, providing a competitive edge in the global on-demand services market.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

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
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, automatic/manual escalation, and an Admin Live Support Console.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Management Systems**: Includes Performance Insights, Review & Rating Management, Media Gallery & Branding, and Operational Settings.
-   **Restaurant Order Management System**: Production-ready order lifecycle management enabling staff to accept/reject/update order status with real-time synchronization.
-   **Restaurant Staff & Role Management System**: Enables restaurant owners to invite team members, assign granular permissions, and track staff activity.
-   **Restaurant Promotions & Coupon Management System**: Allows creation, management, and tracking of promotional campaigns.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade implementation for managing customer payment methods and payout rails by country, service type, actor type, and KYC level.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals across all user roles with unified API routes. Features include automatic weekly payout scheduling, bank verification, and comprehensive withdrawal request validation.
-   **Driver Profile System**: Supports multi-vehicle management with `isPrimary` and `isActive` flags, encrypted sensitive KYC fields (e.g., `nidNumber`, `dmvLicenseNumber`, `ssnLast4`), and a comprehensive document upload system.
-   **Driver Image Upload System**: Production-ready profile photo upload with field name alignment, proper error handling, and null-safe responses.
-   **API Design**: Robust API endpoints for driver vehicle and profile photo management, enforcing KYC, ownership validation, UUID format validation, and Zod schema validation. Includes atomic transactions and consistent error handling. Corrected `apiRequest` usage to ensure proper data handling and prevent common frontend errors.

### Recent Driver Phase Updates

**D1-A: Multi-Vehicle Backend (COMPLETED)**
- Implemented 5 vehicle management endpoints with comprehensive validation
- Database constraint `idx_primary_vehicle_per_driver` enforces single primary vehicle per driver
- Endpoints: GET /api/driver/vehicles, POST /api/driver/vehicles, PATCH /api/driver/vehicles/:id, DELETE /api/driver/vehicles/:id, PATCH /api/driver/vehicles/:id/set-primary

**D1-IMG: Driver Profile Photo Upload (COMPLETED)**
- Fixed field name mismatch between frontend (`profilePhoto`) and backend expectation
- Enhanced error handling for null-safe responses across profile photo upload flow

**D1-BUGS: Comprehensive Frontend Mutation Fix (COMPLETED)**
- **Root Cause**: Incorrect `apiRequest` usage pattern across ~25+ driver mutations in 17 files
- **Issue**: Frontend code used deprecated 3-argument signature `apiRequest(method, url, data)` and attempted to call `.json()` on result
- **Fix**: Updated all driver mutations to use correct 2-argument signature: `apiRequest(url, { method, body, headers })`
- **Pattern**: apiRequest returns parsed JSON or null (never a Response object requiring `.json()` call)
- **Exception**: FormData uploads use `fetch` directly (profile photos, KYC documents) since apiRequest doesn't handle multipart/form-data
- **Files Fixed**: manage.tsx, address.tsx, vehicle.tsx, navigation.tsx, privacy.tsx, language.tsx, work-hub.tsx, notifications.tsx, dark-mode.tsx, payout-methods.tsx, tax-info-edit.tsx, blocked-users.tsx, kyc-documents.tsx, support-chat.tsx, wallet.tsx
- **Impact**: Eliminated "Cannot read properties of null (reading 'json'/'status')" errors across entire driver account experience

**D1-KYC-PROFILE-PHOTO: Field Name Mismatch Fix (COMPLETED)**
- **Issue**: KYC documents page profile photo upload failed with `{"message":"Unexpected field"}` error
- **Root Cause**: Frontend (kyc-documents.tsx) sent field name "profilePhoto" but backend Multer middleware expected "file"
- **Fix**: Updated kyc-documents.tsx to use "file" field name, matching the existing working pattern in manage.tsx
- **Endpoint**: POST /api/driver/upload/profile-photo
- **Field Name**: "file" (multipart form field)
- **Security**: Driver-only authentication, 5MB limit, image types only (JPEG, PNG, WebP)
- **Impact**: Profile photo upload now works on both /driver/kyc-documents and /driver/account/manage pages

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for wallets, payouts, audit logs, notifications, platform settings, payment/payout accounts, opportunity settings, driver tiers and points, blocked riders, reviews, restaurant branding, media, hours, operational settings, delivery zones, surge settings, country payment/payout configurations, restaurant payout methods, categories, subcategories, menu item categories, promotion usage, and multi-role support models. It supports country-specific identity fields with AES-256-GCM encryption and includes flags for demo mode, US tax fields, driver preferences, and enhancements for promotions/coupons and review replies.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.