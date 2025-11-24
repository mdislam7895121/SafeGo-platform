# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform designed for global market leadership in on-demand services such as ride-hailing, food delivery, and parcel delivery. It offers a comprehensive, scalable, and secure solution for integrated urban services, featuring multi-role authentication, country-specific KYC, commission tracking with negative balance support, full service lifecycle management, unified payment/payout layouts, and comprehensive multi-role support ticket management system.

## User Preferences
**Preferred communication style**: Simple, everyday language.
**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, and role-based access controlled routes. Specific features include Uber-level profile experiences, multi-step onboarding, country-specific KYC, a dedicated Food System, and a robust Driver Profile System. The SafeGo Eats restaurant portal has a professional UI/UX, including a redesigned header, unified feature placeholders, a comprehensive responsive layout system, and WCAG 2.1 AA compliant search and notification UX.

### Technical Implementations
The backend is built with Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+. Key architectural patterns include a Generic Service Layer with Role Adapters for DRY principle implementation across services like support, live chat, and callbacks.

Key systems and features:
-   **Admin Capabilities**: Interactive admin panel with dashboard, Document Center, Wallet Settlement, Global Earnings & Payout Analytics, and advanced analytics.
-   **Security & Compliance**: Admin Activity Audit Trail, Global Admin Notification Center, RBAC, secure UX, real-time threat monitoring, and fraud detection.
-   **Wallet & Earnings System**: Manages earnings, commissions, negative balances, and automated/manual payouts.
-   **Tax & Fees System**: Uber-style multi-country tax management with city-level overrides and 7 tax types, including US 1099 Tax System and Bangladesh Tax Reporting System.
-   **Multi-Role Multi-Channel Support Center**: AI-first chat with 4-role support, two-tier escalation, automatic/manual escalation, and an Admin Live Support Console. This production-ready, enterprise-grade system supports Live Chat, Phone Support, and Email/Ticket Support across all user roles (Restaurant, Driver, Customer, Admin) with dedicated database models, a generic service layer with role-specific adapters, and comprehensive backend APIs. It includes real-time messaging, callback scheduling, searchable articles, role-scoped ticket management with collision-free codes (RST/DST/CST/AST prefixes), attachment support, and comprehensive security measures.
-   **Demo Mode**: Comprehensive demo data generation for multi-jurisdiction scenarios.
-   **Opportunity Bonus Management System**: Admin-managed ride incentives with country-specific amounts, campaigns, and zone-based targeting for drivers.
-   **SafeGo Points System**: Uber Pro-style gamified loyalty program with 3 exclusive tiers and 90-day cycles.
-   **Driver Wallet System**: Displays balance, payouts, and transaction timeline, supporting country-specific currencies.
-   **Identity Verification System**: Country-specific identity document management with AES-256-GCM encryption.
-   **Driver Account Settings & Preferences System**: Comprehensive account management with APIs for personal info updates and preference management.
-   **Blocked Riders System**: Allows drivers to block specific customers.
-   **Restaurant Analytics & Management Systems**: Includes Order Analytics & Performance Dashboard, Review & Rating Management, Media Gallery & Branding Management, and Operational Settings System (business hours, delivery/pickup settings, delivery zones, surge pricing).
-   **Restaurant Order Management System**: Production-ready order lifecycle management enabling restaurant staff to accept/reject/update order status through UI action buttons with real-time synchronization. Implements React Query key factory pattern for hierarchical cache management ensuring single invalidation point refreshes all consumer views (orders list/detail, live board, overview dashboard, home widget). Status workflow: placed → accepted/cancelled_restaurant → preparing → ready_for_pickup → picked_up → on_the_way → delivered. Backend APIs for listing, detailing, and updating order statuses include KYC enforcement, audit logging, and notifications.
-   **Relational Menu Category System with Smart Search & Auto-Suggest**: Production-ready, fully relational categorization system for SafeGo Eats restaurant portal featuring 50+ global main categories with 500+ subcategories. Uses proper database normalization with Category, SubCategory, and MenuItemCategory pivot models. Frontend forms feature Smart Category Search with real-time client-side filtering, text highlighting, and hierarchical navigation. Auto-Suggest engine analyzes menu item titles and descriptions using keyword matching with synonym mappings to suggest relevant categories with confidence scoring.
-   **Customer-Facing Dynamic Pricing Display**: Real-time pricing transparency system showing surge multipliers, active promotions, coupon eligibility, and pricing breakdowns.
-   **Payment & Payout Configuration System**: Enterprise-grade implementation for managing customer payment methods and payout rails by country, service type, actor type, and KYC level, featuring anti-spoofing measures, AES-256-GCM encryption, and full audit logging.
-   **Unified Payout System**: Production-ready payout infrastructure for individual withdrawals only across all user roles (Restaurant, Driver, Customer) with unified `/api/payout/*` routes protected by RBAC. Features include automatic weekly payout scheduling, bank verification service with country-specific KYC rules (Bangladesh, USA), country-specific minimum payout amounts, payout method management (bank_transfer, mobile_money, Stripe Connect), comprehensive withdrawal request validation, full transaction history, KYC-gated access control, and seamless integration with existing Wallet + Earnings infrastructure.

### Database Schema Design
The schema uses UUID primary keys, indexed foreign keys, and decimal types for monetary values. It includes models for `Wallet`, `WalletTransaction`, `Payout`, `PayoutBatch`, `AuditLog`, `AdminNotification`, `PlatformSettings`, `PayoutAccount`, `PaymentMethod`, `OpportunitySetting`, `OpportunityReward`, `DriverTier`, `DriverPoints`, `TierBenefit`, `PointsRule`, `PointsTransaction`, `BlockedRider`, `Review`, `RestaurantBranding`, `RestaurantMedia`, `RestaurantHours`, `OperationalSettings`, `DeliveryZone`, `SurgeSettings`, `CountryPaymentConfig`, `CountryPayoutConfig`, `RestaurantPayoutMethod`, `Category`, `SubCategory`, `MenuItemCategory`, and multi-role support models (`LiveChatSession`, `LiveChatMessage`, `SupportCallback`, `SupportArticle`, `SupportTicket`, `SupportMessage` for Restaurant, Driver, Customer, and Admin). It supports country-specific identity fields with AES-256-GCM encryption and includes an `isDemo` flag, fields for US tax and driver preferences, and operational settings.

## External Dependencies

-   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
-   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
-   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
-   **Environment Variables**: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY`.