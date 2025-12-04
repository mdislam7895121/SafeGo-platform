# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global on-demand services like ride-hailing, food delivery, and parcel delivery. Its core purpose is to secure a significant market share by offering a scalable, secure, and feature-rich solution. The platform includes multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod, utilizing a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend uses Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, employing a Generic Service Layer with Role Adapters.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, and an Enterprise Admin Component Library for consistent UI.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs (with hash chain verification), Customer Account Lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, payout audit trails, and adheres to NYC TLC regulatory compliance.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails.
*   **Customer & Partner Onboarding**: Features Uber-level profiles, multi-step onboarding, country-specific KYC (with real-time ID verification, background checks, facial recognition, and a multi-stage review queue with risk signals and duplicate detection).
*   **Service Offerings**: Supports Food Delivery (Restaurant Management, Unified Eats, Driver Flow), Ride-Hailing (Rider Booking, Multi-Route Fare Engine, Multi-Category Vehicle System, Driver Workflow), and Parcel Delivery (scheduled pickup, Proof-of-Delivery, dynamic pricing).
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), Experience Intelligence with real-time ETA refinement, dynamic routing optimization, personalized push notifications, and Admin Notifications WebSocket (`/api/admin/notifications/ws`) with JWT auth, role-scoped broadcasts, real-time cache invalidation, and sound alerts.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation (e.g., Auto Assignment, Surge Pricing), security & fraud prevention, risk intelligence (e.g., Driver Fatigue Detection), experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system (SUPER_ADMIN, ADMIN, COUNTRY_ADMIN, etc.) with granular permissions, permission bundles, emergency lockdown controls (GLOBAL, COUNTRY, SERVICE), admin impersonation mode (view-only with audit trail), and secure internal messaging.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification, evidence packets, and regulator export mode.

## Recent Changes (Phase 2 - December 4, 2025)

*   **Feature Flags Management**: Enterprise UI with grouped categories, rollout sliders, environment previews
*   **Real-time Notifications**: WebSocket-based admin notifications with JWT auth, role-scoped broadcasts
*   **Global Theme System**: Dark/Light/System modes, 5 admin presets, accessibility modes (high-contrast, reduced-motion, large-text)
*   **Mobile Optimization**: 44px tap targets, responsive typography
*   **Audit Logging Expansion**: Multi-admin tracking, region scoping (countryCode, userAgent, environment fields), export APIs
*   **Environment Separation**: Dev/staging/prod configuration with feature gates
*   **Access Governance**: Role visualization with hierarchy tree, permission matrix, country scope map

## Phase 3A Enterprise Admin Features (December 4, 2025)

*   **Enterprise Search Engine**: Global fuzzy search across users, drivers, restaurants with type-ahead suggestions
*   **Data Export Center**: CSV/PDF/JSON exports with history tracking and scheduled exports
*   **Fraud Detection Dashboard**: Suspicious logins, device fingerprints, multi-account detection
*   **Session Security**: Active session management, IP blocking, suspicious IP detection
*   **Emergency Controls**: Platform pause, payment freeze, emergency resume capabilities
*   **Incident Response Playbook**: Incident management with timeline tracking and status workflow
*   **Customer Support Panel**: View-only impersonation with full audit logging
*   **Partner Compliance Center**: Document expiry tracking, missing docs, KYC revalidation requests
*   **System Health Monitor**: CPU, memory, database, and queue monitoring
*   **Push Notifications**: Geo and role targeted notifications
*   **Payment Verification Console**: Failed payments, disputes, and reconciliation
*   **Policy Manager**: Version-controlled policies with acceptance tracking
*   **Backup & Recovery**: Database snapshots, verification, and restore
*   **Full Audit Console**: Hash-chain verified audit logs with export capabilities

### Phase 3A RBAC Configuration:
*   **ADMIN**: View-only access (EXPORT_DATA, VIEW_INCIDENTS, VIEW_COMPLIANCE, VIEW_SYSTEM_HEALTH, VIEW_PAYMENT_ISSUES, VIEW_POLICIES, VIEW_FULL_AUDIT)
*   **COUNTRY_ADMIN**: Full access including emergency controls, impersonation, and manage permissions
*   **COMPLIANCE_ADMIN**: Compliance-focused access with incident and policy management
*   **SUPPORT_ADMIN**: Impersonation access with VIEW_SUPPORT_CONVERSATIONS
*   **FINANCE_ADMIN**: Payment-focused access with export capabilities
*   **RISK_ADMIN**: Security-focused access including session and emergency control management
*   **READONLY_ADMIN**: Limited view access (excludes sensitive audit data)
*   **SUPER_ADMIN**: Full access to all Phase 3A features

## Phase 3B UI/UX Polish (December 4, 2025)

### Accessibility Enhancements (WCAG 2.1 AA Compliance)
*   **Focus Rings**: Visible focus indicators with 4.5:1 contrast ratio for all interactive elements
*   **Skip Navigation**: Skip-to-content links for keyboard users
*   **Reduced Motion**: `prefers-reduced-motion` media query support with reduced animation mode
*   **High Contrast Mode**: Enhanced contrast mode for visually impaired users
*   **Large Text Mode**: Scalable typography for users who need larger text
*   **Screen Reader**: ARIA labels and landmarks for screen reader compatibility

### New Components
*   **QuickActionsPanel**: Enterprise quick actions (Suspend User, Reset Password, Verify KYC, Review Risk) with keyboard shortcuts
*   **RealTimeAnalytics**: WebSocket-powered live metrics dashboard with sparkline charts for Active Users, Partner Growth, Orders, Rides, Failure Rate
*   **GlobalSearch**: Enhanced enterprise fuzzy search with type-ahead suggestions

### Mobile Responsive Design
*   **Breakpoint 360px**: Optimized for small phones with reduced padding, single-column grid
*   **Breakpoint 768px**: Tablet layout with collapsible sidebar, responsive header
*   **Breakpoint 1024px**: Small laptop optimization with collapsible sidebar labels
*   **Touch Targets**: Minimum 44px height for all interactive elements
*   **Safe Area Insets**: iPhone notch/home indicator support
*   **Enterprise Typography Scale**: Responsive `clamp()` typography for headers and body text

### Admin Dashboard Enhancements
*   Real-Time Analytics integrated into admin home page
*   Quick Actions Panel in AdminHeader
*   Global Search in AdminHeader
*   Connection status badge for WebSocket analytics

## Admin System Verification (December 4, 2025)

*   **WebSocket Fix**: Fixed `adminNotificationsWs.ts` to use `prisma.adminProfile` with user relation instead of non-existent `adminAccount` model
*   **Phase 2 Guard**: Added `PHASE2_FEATURES_ENABLED` environment flag with secure middleware guard (placed after auth) for unimplemented Phase 2 routes
*   **Verified Features**: All 10 core admin features verified for enterprise security standards (People & KYC, Safety Center, Feature Flags, Notifications, Theme, Access Governance, Audit Logging, Environment Config, Security Hardening)
*   **Security**: 216 permission checks verified across admin routes with authenticateToken, requireAdmin(), and granular checkPermission()

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.

## Key Files & Directories (Phase 2)

*   `server/config/environmentConfig.ts` - Environment separation configuration
*   `server/services/tamperProofAuditService.ts` - Hash chain audit verification
*   `server/utils/audit.ts` - Enhanced audit logging with new fields
*   `client/src/contexts/ThemeContext.tsx` - Global theme provider
*   `client/src/pages/admin/feature-flags.tsx` - Feature flags management
*   `client/src/pages/admin/notifications.tsx` - Notification center
*   `client/src/pages/admin/access-governance.tsx` - Role visualization
*   `docs/PHASE2_REPORT.md` - Complete Phase 2 documentation
*   `docs/CHANGELOG_PHASE2.md` - Phase 2 changelog

## Key Files & Directories (Phase 3A)

*   `server/routes/admin-phase3a.ts` - All Phase 3A backend endpoints
*   `server/utils/permissions.ts` - Updated RBAC permissions for all admin roles
*   `client/src/components/admin/AdminSidebar.tsx` - Phase 3A navigation section
*   `client/src/pages/admin/enterprise-search.tsx` - Enterprise search engine
*   `client/src/pages/admin/export-center.tsx` - Data export center
*   `client/src/pages/admin/fraud-detection.tsx` - Fraud detection dashboard
*   `client/src/pages/admin/session-security.tsx` - Session security management
*   `client/src/pages/admin/emergency-controls.tsx` - Emergency controls
*   `client/src/pages/admin/incident-response.tsx` - Incident response playbook
*   `client/src/pages/admin/customer-support-panel.tsx` - Customer support panel
*   `client/src/pages/admin/compliance-center.tsx` - Partner compliance center
*   `client/src/pages/admin/health-monitor.tsx` - System health monitor
*   `client/src/pages/admin/push-notifications.tsx` - Push notifications
*   `client/src/pages/admin/payment-verification.tsx` - Payment verification console
*   `client/src/pages/admin/policy-manager.tsx` - Policy manager
*   `client/src/pages/admin/backup-recovery.tsx` - Backup and recovery
*   `client/src/pages/admin/audit-console.tsx` - Full audit console

## Key Files & Directories (Phase 3B)

*   `client/src/index.css` - Mobile responsive styles, WCAG accessibility utilities, enterprise typography
*   `client/src/contexts/ThemeContext.tsx` - Enhanced theme provider with reduced motion support
*   `client/src/components/admin/QuickActionsPanel.tsx` - Enterprise quick actions panel
*   `client/src/components/admin/RealTimeAnalytics.tsx` - WebSocket-powered live metrics dashboard
*   `client/src/components/admin/GlobalSearch.tsx` - Enhanced enterprise search
*   `client/src/components/admin/AdminHeader.tsx` - Updated header with quick actions and global search
*   `client/src/pages/admin/home.tsx` - Admin dashboard with real-time analytics