# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its purpose is to be a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts. The project aims for global market leadership in the super-app space.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: Admin panel with interactive dashboard, real-time data, Document Center, Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics.
- **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, Global Admin Settings Panel, advanced Role-Based Access Control (RBAC) with 5 admin roles and 20 granular permissions (deny-by-default model), secure UX components, real-time threat monitoring, and a comprehensive fraud detection engine with automated incident response.
- **Wallet & Earnings System**: Financial management system tracking earnings, commissions, negative balances, and payout processing, including automated/manual payouts and reconciliation.
- **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides, supporting 7 tax types (VAT, Sales Tax, Government Service Fee, Marketplace Facilitator Tax, Trip Fee, Local Municipality Fee, Regulatory Fee), simple stacking calculation (taxAmount = baseFare × percentRate/100 + flatFee), and tax breakdown storage in all transaction records.
- **System Monitoring**: Real-time performance monitoring, system stability alerts, and an enterprise performance dashboard.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.
- **Demo Mode**: Comprehensive demo data generation system with realistic multi-jurisdiction data.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields and includes `isDemo: Boolean @default(false)`.

### Customer Web App (Step 47.1 - In Progress)
The customer-facing web application provides multi-step onboarding, country-specific KYC management, and service booking capabilities.

**Implemented Features:**
1. **Multi-Step Registration Flow** (`/customer-register`):
   - Step 1: Basic Info (full name, email, password, phone, country)
   - Step 2: Address (BD: present/permanent addresses, district, thana; US: home address)
   - Step 3: KYC Documents (BD: NID with photos; US: government ID type + last 4 digits)
   - Step 4: Emergency Contact (name + phone)

2. **KYC Management Page** (`/customer/profile/kyc`):
   - Displays masked NID/government ID numbers (only last 4 digits visible)
   - Document preview for uploaded NID images
   - Verification status tracking (pending/approved/rejected)
   - Rejection reason display
   - Country-specific field display (BD vs US)

3. **Service Tracking**:
   - Ride Tracking (`/customer/rides/:id`): Live status updates, driver info, cancel functionality
   - Wallet Page (`/customer/wallet`): Balance display, transaction history aggregated from rides/food/deliveries
   - Notifications Center (`/customer/notifications`): Real-time updates, read/unread states

4. **KYC Verification Gate**:
   - Dashboard blocks access to services (ride/food/parcel) until KYC verified
   - Warning banner for pending/rejected verification
   - Visual indication of locked services

**Backend API Endpoints Added:**
- `GET /api/customer/wallet` - Aggregates transactions from rides, food orders, and deliveries
- `GET /api/customer/notifications` - Returns user-specific notifications
- `PATCH /api/customer/profile` - Updated to handle fullName, phoneNumber, and all Bangladesh address fields (district, thana, postOffice, postalCode, village)

**Security:**
- Server-side KYC verification enforced in all booking endpoints (`POST /api/rides`, `POST /api/food-orders`, `POST /api/deliveries`)
- Frontend KYC gate provides UX feedback while backend enforces access control

**Pending Implementation:**
- Food ordering flow (restaurant listing, menu, cart, order placement)
- Food order tracking page
- Enhanced parcel tracking with sender/receiver details

## Tax & Fees System

### Overview
The Tax & Fees system implements Uber-style multi-country tax management with city-level overrides. It supports 7 tax types, simple stacking calculation logic, and stores complete tax breakdowns in all transaction records.

### Tax Types
1. **VAT** - Value Added Tax (common in Europe, Asia)
2. **SALES_TAX** - Sales Tax (common in USA)
3. **GOVERNMENT_SERVICE_FEE** - Government-mandated service fees
4. **MARKETPLACE_FACILITATOR_TAX** - Platform facilitator taxes
5. **TRIP_FEE** - Per-trip booking fees
6. **LOCAL_MUNICIPALITY_FEE** - City/municipality fees
7. **REGULATORY_FEE** - Regulatory compliance fees

### Tax Rule Fields
Each tax rule in the `TaxRule` model contains:
- **countryCode** (required): ISO country code (e.g., "US", "BD")
- **cityCode** (optional): City identifier for city-specific rules (e.g., "NYC", "SF", "DHK")
- **serviceType** (required): Service the tax applies to (RIDE, FOOD, PARCEL)
- **taxType** (required): Type of tax (see Tax Types above)
- **percentRate** (optional): Percentage rate (e.g., 7.5 for 7.5%)
- **flatFee** (optional): Fixed flat fee amount (e.g., 2.50 for $2.50)
- **isActive** (default: true): Whether the rule is currently active
- **isDemo** (default: false): Mark as demo data for testing

### Tax Calculation Logic
Taxes are calculated using simple stacking:
```
taxAmount = baseFare × (percentRate / 100) + flatFee
totalTax = sum of all applicable taxAmounts
```

**Rule Priority**: City rules override country rules (not additive). If a city has a specific rule for a tax type, the country-level rule for that same tax type is ignored.

### Demo Tax Rules
The system includes 10 pre-configured demo tax rules:

**USA (Country-level)**:
- Sales Tax: 7.5% for RIDE, FOOD, PARCEL

**USA - New York City (NYC)**:
- Trip Fee: 0.5% + $2.50 flat for RIDE
- Local Municipality Fee: $0.75 flat for FOOD

**USA - San Francisco (SF)**:
- Local Municipality Fee: $1.50 flat for RIDE

**Bangladesh (Country-level)**:
- VAT: 15% for RIDE, FOOD, PARCEL

**Bangladesh - Dhaka (DHK)**:
- Government Service Fee: 5% for RIDE

### Managing Tax Rules

#### Via Admin UI
1. Navigate to Admin Settings → Tax & Fees tab
2. Click "Add Tax Rule" to create new rules
3. Fill in required fields (country, service type, tax type)
4. Set either percentRate, flatFee, or both
5. Mark isActive to enable/disable rules

#### Via Seed Script
To regenerate demo data:
```bash
tsx scripts/seed.ts
```

#### Safety Guidelines
- **Validate inputs**: Always provide either percentRate or flatFee (or both)
- **Test first**: Create rules with `isActive: false`, test calculation, then activate
- **Use demo flag**: Mark test rules with `isDemo: true` for easy cleanup
- **Respect RBAC**: All tax rule changes require `EDIT_SETTINGS` permission
- **Audit trail**: All tax rule changes are automatically logged in AuditLog

#### Adding New Countries/Cities
1. Add country-level rules first (cityCode = null)
2. Add city-specific overrides as needed (cityCode = specific city)
3. Test calculations with sample fares
4. Activate rules only after verification

#### Tax Breakdown Storage
All transactions (Ride, FoodOrder, Delivery) store:
- **taxBreakdown** (Json): Array of individual tax items with type, description, and amount
- **totalTaxAmount** (Decimal): Sum of all taxes applied

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.