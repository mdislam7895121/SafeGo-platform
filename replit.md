# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services such as ride-hailing, food delivery, and parcel delivery. The project's vision is to become a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC with admin approval, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts. SafeGo aims for global market leadership in the super-app space.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading states, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout. The Customer Web App includes multi-step onboarding, country-specific KYC management, service booking, and a dedicated Food System with restaurant and menu browsing.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: An interactive admin panel with a dashboard, Document Center, Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics.
- **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, Global Admin Settings Panel, advanced Role-Based Access Control (RBAC) with granular permissions, secure UX components, real-time threat monitoring, and a fraud detection engine.
- **Wallet & Earnings System**: A financial management system tracking earnings, commissions, negative balances, and automated/manual payout processing.
- **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, supporting 7 tax types (VAT, Sales Tax, Government Service Fee, Marketplace Facilitator Tax, Trip Fee, Local Municipality Fee, Regulatory Fee). Tax calculations use a simple stacking method, and a detailed tax breakdown is stored in all transaction records.
- **System Monitoring**: Real-time performance monitoring, stability alerts, and an enterprise performance dashboard.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields and an `isDemo` flag.

### Profile UX Upgrade (November 2025)
Both Customer and Driver profile experiences have been upgraded to Uber-level quality with modern UI, enhanced features, and comprehensive information architecture:

**Customer Profile Enhancements** (`/customer/profile`):
- Modern profile header card with circular avatar, full name, location (country flag + city), email with verified badge, star rating, and total trip count
- Quick action row with 4 shortcuts: Payment Methods, Saved Places, Safety/KYC Status, and Edit Profile
- Structured sections:
  - **Personal Information**: Full name, phone number, email, date of birth displayed in a clean grid layout
  - **Addresses & Saved Places**: Home, Work, and Favorites with icons, edit buttons, and placeholder support
  - **KYC & Verification**: Visual verification status card with badges, review dates, and action buttons
  - **Preferences**: Language selection and notification settings management
- Mobile-first responsive design with bottom navigation bar
- Skeleton loading states for better perceived performance
- Integration with existing KYC system and wallet functionality

**Driver Profile UI - Current State (November 21, 2025)**:
- **Status**: Legacy driver profile, vehicle, and wallet UI completely removed
- **Placeholder Pages**: `/driver/profile`, `/driver/vehicle`, and `/driver/wallet` now display "Under Reconstruction" messages
- **Backend Preserved**: All backend APIs, database models, and services remain untouched and fully functional
- **Ready for Rebuild**: Clean codebase prepared for fresh Uber-style driver profile implementation
- **Navigation Intact**: Unified DriverLayout navigation system fully operational with 12-item sidebar menu

### Driver Web App with Unified Navigation Layout (November 2025)
Built a comprehensive Driver Web App featuring a unified navigation system with top bar, sidebar, dashboard, and complete feature set while preserving backward compatibility with legacy onboarding flow:

**Unified Navigation Structure**:
- **DriverLayout Component**: Wrapper providing consistent top navigation + sidebar layout for all NEW driver pages
- **DriverTopBar**: Sticky top bar (h-16) with SafeGo logo, notification bell, language toggle, profile dropdown, and mobile SidebarTrigger
- **DriverSidebar**: Collapsible 12-item sidebar menu (Dashboard, Refer, Opportunity, Premium, Wallet, Documents, Vehicles, Tax Info, Account Settings, Map Theme, Dark Mode, Help Center)
- **Mobile Responsive**: SidebarTrigger in DriverTopBar provides hamburger menu on mobile/tablet (md:hidden)
- **Legacy Compatibility**: `/driver` route uses standalone DriverHome (preserves onboarding flow), all new routes wrapped with DriverLayout

**Dashboard with Real-Time Widgets** (`/driver`):
- **Performance Metrics**: Rating (5.0/5.0), Total Trips Completed, Daily Earnings, Weekly Earnings displayed as widget cards with icons
- **Bonus Zones Section**: Interactive cards showing surge pricing areas (Downtown 1.5x, Airport 2.0x, Business District 1.3x) with active time indicators
- **Analytics Placeholder**: Reserved space for future heatmap and performance trend charts
- **Real-Time Data**: All stats pulled from `/api/driver/home` endpoint with skeleton loading states

**Refer & Earn Page** (`/driver/refer`):
- **Reward Display**: ৳500 per successful referral with gift icon
- **Referral Code**: Auto-generated from driver profile ID (e.g., "AHMED2025" or user-specific code)
- **Share Buttons**: Three specific share methods:
  - Copy Code button (clipboard)
  - Share via WhatsApp button (green, opens WhatsApp with pre-filled message)
  - Share via Email button (opens email client with formatted invitation)
- **How It Works**: 3-step visual guide explaining referral process
- **Terms & Conditions**: Clear policy on earning conditions and restrictions

**SafeGo Premium Page** (`/driver/premium`):
- **Pricing**: ৳499/month (Bangladesh) or $49/month (US) with cancel-anytime policy
- **5 Premium Benefits**: Priority trip requests, lower commission rates (5% savings), exclusive bonus zones, 24/7 premium support, advanced analytics
- **ROI Calculator**: Visual comparison showing standard driver vs premium driver earnings with monthly profit calculation
- **FAQ Section**: Addressing common questions about cancellation, commission savings, and priority access

**Help Center Page** (`/driver/help`):
- **4 Support Channels**: Live chat, phone support, email support, FAQ & guides
- **Common Topics**: Quick links to frequently asked questions (vehicle documents, earnings, passenger issues, tax info)
- **Contact Information**: Displayed support phone number and email address

**Route Architecture**:
- **Legacy Route** `/driver`: DriverHome standalone (NOT wrapped) - preserves onboarding, vehicle registration, online/offline toggle
- **New Routes** (25+ routes wrapped with DriverLayout):
  - `/driver/dashboard`: Dashboard with 4 performance widgets
  - `/driver/refer`: Refer & Earn with Copy/WhatsApp/Email share
  - `/driver/premium`: SafeGo Premium subscription page
  - `/driver/help`: Help Center with 4 support channels
  - `/driver/profile`: Placeholder page (UI under reconstruction)
  - `/driver/vehicle`: Placeholder page (UI under reconstruction)
  - `/driver/wallet`: Placeholder page (UI under reconstruction)
  - `/driver/kyc-documents`: Document management page
  - All `/driver/account/*` routes: Account settings and preferences
- Page titles dynamically set per route via DriverLayout
- Protected routes requiring driver role authentication
- No conflicting sticky headers or double framing issues

**Design Compliance**:
- All pages use shadcn/ui primitives (Card, Button, Badge) with stock variants
- No custom background/text classes on Badge components per SafeGo design guidelines
- Proper icon usage from lucide-react and react-icons/si
- Data-testid attributes on all interactive elements for E2E testing
- Mobile-first responsive design with Tailwind utility classes
- Single sticky DriverTopBar (no stacked headers) with clean scroll behavior
- Removed conflicting sticky headers from 20+ driver subpages to prevent overlap
- Avatar in sidebar: simple clickable link without hover-elevate interaction

### Driver Onboarding Backend (November 2025)
Fixed critical driver onboarding issues to enable complete end-to-end flow:

**Backend Fixes**:
- **Vehicle Registration** (`POST /api/driver/vehicle`): Now properly creates vehicle records with all required fields (id, updatedAt), preventing 500 errors
- **Document Upload** (`POST /api/driver/upload/vehicle-document`): Fixed to handle profile photos, driver licenses, and vehicle documents with proper UUID generation
- **Driver Home API** (`GET /api/driver/home`): Refactored to separately query user, vehicle, stats, and wallet data to avoid Prisma include errors
- **Vehicle Documents Query** (`GET /api/driver/vehicle-documents`): Corrected field names (vehicleModel vs model) to match schema

**Security & Validation**:
- All endpoints require authentication with driver role
- RBAC filters ensure drivers can only access their own data
- Proper validation for file uploads (5MB profile photos, 10MB documents)
- Clear error messages for validation failures (400) vs server errors (500)

**Driver Onboarding QA Testing**:

1. **Login as Demo Driver**:
   - Email: `demo_driver@safego.com` (or register as new driver)
   - Password: `password123`
   - Navigate to `/driver` after login

2. **Vehicle Registration Flow**:
   - Go to Driver Home → Click "Register Vehicle" button
   - Fill in form: Vehicle Type (e.g., "Sedan"), Model (e.g., "Toyota Camry"), License Plate (e.g., "ABC123")
   - Submit form → Should see success toast "Vehicle registered successfully"
   - Vehicle tab should now show vehicle details instead of "No vehicle registered"
   - Onboarding Progress: "Vehicle Added" step should change from Pending to Completed

3. **Document Upload Flow**:
   - Navigate to Driver Profile → Documents tab
   - Upload Profile Photo: Select image (max 5MB) → Should see "Uploaded" status
   - Upload Driver License: Select image/PDF (max 10MB) → Should see "Uploaded" status
   - Upload Vehicle Documents: Select document → Should see count update to "1 uploaded"
   - Onboarding Progress: "KYC Documents" and "Vehicle Documents" steps should update accordingly

4. **Verify Dashboard Updates**:
   - Check Driver Home → Overview tab shows vehicle and stats
   - Check onboarding progress percentage increases with each step
   - Verify all 5 steps track correctly: Personal Info, KYC Documents, Vehicle Added, Vehicle Documents, Account Approval

5. **Error Handling**:
   - Try uploading file >10MB → Should see clear error message
   - Try registering vehicle twice → Should see "Vehicle already registered" message
   - Try uploading without selecting file → Should see "No file uploaded" error

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.