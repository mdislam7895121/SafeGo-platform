# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its primary purpose is to be a leading global super-app by offering a comprehensive, scalable, and secure solution for integrated urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, and unified payout/payment section layouts.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL-based color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control, and a unified payout/payment section layout.

### Technical Implementations
The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. It supports multi-role authentication, country-specific KYC with admin approval, and comprehensive service lifecycle management.

Key architectural features include:
- **Admin Capabilities**: An admin panel with an interactive dashboard, real-time data, a Document Center, a Wallet Settlement System, Global Earnings & Payout Analytics, and advanced analytics dashboards for drivers, customers, restaurants, revenue, and security risk. The analytics dashboard includes comprehensive defensive null checks across all tabs (Overview, Drivers, Customers, Restaurants, Revenue, Risk) to gracefully handle missing data fields, preventing runtime crashes with optional chaining and default values.
- **Security & Compliance**: Admin Activity Audit Trail with IP tracking and PII masking, Global Admin Notification Center, Global Admin Settings Panel, advanced RBAC with 5 admin roles and 20 granular permissions (deny-by-default model), environment guard, security status indicators, secure UX components, real-time threat monitoring, and a comprehensive fraud detection engine.
- **Wallet & Earnings System**: A financial management system tracking earnings, commissions, negative balances, and payout processing, including automated payout scheduling, manual payout capabilities, and a reconciliation engine.
- **System Monitoring**: Real-time performance monitoring system with telemetry hooks, system stability alerts, and an enterprise performance dashboard.
- **Automated Incident Response**: Fully automated incident response system including auto-locking suspicious users, token revocation, session invalidation, and automated fraud responses.
- **Support Chat System**: Real-time WebSocket-integrated support chat with full CRUD and RBAC checks.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, decimal types for monetary values, and includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, and `PaymentMethod`. It supports country-specific identity fields, driver profile photos, and vehicle documents.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.

## Development History

### Step 49: Analytics Security Hardening & RBAC Enforcement (November 2025)

**Objective**: Strengthen RBAC enforcement across all analytics endpoints and ensure defensive null-check patterns prevent runtime crashes in all analytics tabs.

**Backend Improvements**:
1. **RBAC Filtering System** (`server/routes/analytics.ts`)
   - Added `getRBACFilter()` helper for role-based data access control
   - **SUPER_ADMIN**: Full access to all analytics data (no filtering)
   - **COUNTRY_ADMIN**: Limited to data from their assigned country
   - **CITY_ADMIN**: Limited to data from their assigned city and country
   - **Other roles**: Denied access with 403 error
   - Applied to all 6 analytics endpoints: `/overview`, `/drivers`, `/customers`, `/restaurants`, `/revenue`, `/risk`

2. **Defensive Data Patterns** (`server/routes/analytics.ts`)
   - Added safe data helpers: `safeNumber()`, `safeArray()`, `safeString()`
   - All numeric fields use `safeNumber(value, 0)` for guaranteed non-null defaults
   - All array fields use `safeArray(value, [])` for guaranteed empty array defaults
   - All financial metrics use safe fallback to `0` to prevent NaN errors
   - Applied across all analytics endpoint responses

3. **Field Naming Consistency**
   - Fixed schema field mapping: `Ride.completedAt`, `FoodOrder.deliveredAt`, `Delivery.deliveredAt`
   - Corrected Prisma SQL queries to use camelCase column names (e.g., `"driverId"` not `driver_id`)
   - Aligned driver analytics response structure with frontend expectations (`driverName`, `revenue`, `performanceTrend`)

**Frontend Improvements**:
1. **Defensive Null Checks** (`client/src/pages/admin/analytics.tsx`)
   - All analytics tabs use optional chaining: `data?.field ?? defaultValue`
   - Numeric displays: `(data?.count ?? 0).toLocaleString()`
   - Currency displays: `formatCurrency(data?.revenue ?? 0)`
   - Chart data: `data?.chartData ?? []` to prevent crashes on undefined arrays
   - Applied across all 6 tabs: Overview, Drivers, Customers, Restaurants, Revenue, Risk

2. **Safe Fallback Behavior**
   - Loading states: Skeleton components during data fetch
   - Error states: Alert components with user-friendly messages
   - Empty states: Default values displayed when no data available
   - Zero runtime TypeErrors in browser console

**Key Defensive Patterns**:
```typescript
// Backend: Safe response with defaults
res.json({
  totalRevenue: safeNumber(revenue, 0),
  topDrivers: safeArray(drivers, []),
  performanceTrend: safeArray(trend, []),
});

// Frontend: Optional chaining with defaults
<div>{(data?.totalRevenue ?? 0).toLocaleString()}</div>
<Chart data={data?.performanceTrend ?? []} />
<p>{formatCurrency(data?.earnings ?? 0)}</p>
```

**Security Benefits**:
- **RBAC Enforcement**: Prevents unauthorized cross-jurisdiction data access
- **Audit Trail**: All analytics views logged with admin role and jurisdiction
- **Graceful Degradation**: Missing data doesn't crash the dashboard
- **Predictable Behavior**: All endpoints return consistent JSON structures

**Testing Validation**:
- Zero runtime crashes across all analytics tabs
- RBAC properly restricts data by admin jurisdiction
- All charts render without errors when data is missing
- Safe defaults prevent blank screens and TypeErrors