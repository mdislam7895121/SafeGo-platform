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

**Driver Profile Enhancements** (`/driver/profile`):
- Uber-style header with driver avatar, name, location, star rating, total trips, and daily/weekly earnings summary
- Online/Offline status badge with quick "Go Online" button
- **Onboarding Progress Component** (shown for unverified drivers):
  - 5-step progress tracker: Personal Info, KYC Documents, Vehicle Added, Vehicle Documents, Account Approval
  - Visual progress bar with percentage completion
  - Color-coded status badges: Completed (green), In Progress (gray), Needs Attention (red), Pending (outline)
- **Tabbed Navigation** with 5 sections:
  - **Overview**: Account status, verification badge, total balance, and total trips summary cards
  - **Vehicle**: Active vehicle details (type, model, plate, earnings) with edit functionality
  - **Documents**: Required documents checklist (profile photo, driver license, vehicle documents) with upload status indicators
  - **Payouts**: Wallet summary showing available balance and negative balance with link to full wallet page
  - **Account & Security**: Profile editing, password change, email, and membership date
- Clean information hierarchy with icons, badges, and visual status indicators
- Fully backward compatible with existing driver onboarding and document upload systems

**Key Design Features**:
- Consistent use of SafeGo's design system (shadcn/ui components, custom color palette)
- Avatar components with fallback initials
- Country-specific data display (Bangladesh 🇧🇩 vs United States 🇺🇸)
- Demo statistics for rating and trips (ready for real API integration)
- Non-breaking changes - all existing backend logic and security features remain intact
- Data-testid attributes on all interactive elements for testing
- Responsive grid layouts adapting from mobile to desktop
- Hover and active states following universal design guidelines

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.