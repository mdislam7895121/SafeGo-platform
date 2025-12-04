# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services such as ride-hailing, food delivery, and parcel delivery. The platform aims to capture a significant market share by providing a scalable, secure, and feature-rich solution that includes multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend utilizes Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, and an Enterprise Admin Component Library. Supports Dark/Light/System modes, accessibility modes (high-contrast, reduced-motion, large-text), responsive typography, and optimized touch targets.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, payout audit trails, and NYC TLC regulatory compliance. Includes fraud detection dashboard, session security management, and emergency controls.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails. Includes a payment verification console.
*   **Customer & Partner Onboarding**: Features multi-step onboarding and country-specific KYC with real-time ID verification, background checks, facial recognition, and a multi-stage review queue.
*   **Service Offerings**: Supports Food Delivery (Restaurant Management, Unified Eats, Driver Flow), Ride-Hailing (Rider Booking, Multi-Route Fare Engine, Multi-Category Vehicle System, Driver Workflow), and Parcel Delivery (scheduled pickup, Proof-of-Delivery, dynamic pricing).
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), Experience Intelligence with real-time ETA refinement, dynamic routing optimization, personalized push notifications, and Admin Notifications WebSocket.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation (e.g., Auto Assignment, Surge Pricing), security & fraud prevention, risk intelligence (e.g., Driver Fatigue Detection), experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system with granular permissions, permission bundles, emergency lockdown controls, admin impersonation mode, and secure internal messaging. Includes role visualization and permission matrix.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification, evidence packets, and regulator export mode, with an expanded full audit console.
*   **Enterprise Administration**: Features such as Feature Flags Management, Enterprise Search Engine, Data Export Center, Incident Response Playbook, Customer Support Panel, Partner Compliance Center, System Health Monitor, Push Notifications, Policy Manager, Backup & Recovery, and an Intelligence Dashboard with service analytics, driver performance, customer satisfaction, and automated insights.

## Phase 3: Enterprise Admin Dashboard Upgrade (December 2025)

### Phase 3A - Enterprise Admin Tools (Completed)
All 14 Enterprise Admin tools implemented in Operations Center (`/admin/operations-center`):
- **Scheduled Reports**: Daily/weekly/monthly CSV/JSON exports with scheduling
- **Live Admin Presence**: Real-time online/offline status with heartbeat tracking
- **Admin Productivity Logs**: Actions per minute, resolved items, efficiency metrics
- **Failed Login Monitor**: IP addresses, user agents, timestamps, lockout tracking
- **Admin Activity Heatmap**: Visual representation of admin activity over time
- **Data Quality Monitor**: Missing fields, invalid KYC, orphaned records detection
- **Quarantine Vault**: Flagged or suspicious items management with bulk actions
- **Admin Notes System**: Timestamped notes on entities with admin attribution
- **Configuration Preview**: Real-time feature flag preview before deployment
- **API Usage Graphs**: Endpoint analytics, latency tracking, error rates
- **Country Compliance Settings**: Read-only for non-country-admins, compliance metrics

### Phase 3B - UI/UX Polish + Real-Time Analytics (Completed)
- **WCAG 2.1 AA Compliance**: Full accessibility with proper ARIA labels, keyboard navigation, color contrast
- **Live Error Panel**: Real-time backend exception monitoring with severity levels
- **Consolidated Notification Timeline**: Unified view of all platform events and notifications
- **Virtual Scrolling**: Optimized rendering for large admin tables using ScrollArea
- **Real-Time Analytics Component**: WebSocket-based metrics with REST polling fallback (10s intervals)

### Phase 3C - Intelligence Layer (Completed)
Enhanced Intelligence Dashboard (`/admin/intelligence`) with advanced analytics:
- **Service Analytics**: Rides, Eats, Parcel deep analytics with period filtering (7d/30d/90d)
- **Driver Performance Intelligence**: Rankings, performance scores, needs attention alerts
- **Customer Satisfaction**: NPS scoring, CSAT, rating distribution, low-rating alerts
- **Fraud Detection Dashboard**: Suspicious trips, multi-account detection, platform risk scoring
- **Platform Health Monitor**: CPU, memory, database latency, service health, queue statistics
- **Automated Insights**: AI-generated recommendations with actionable items
- **Earnings Irregularity Monitor**: Flagged drivers with unusual earning patterns
- **Customer Complaint Patterns**: Category analysis, trending issues, resolution metrics
- **AI Summary**: Text-based auto insight generator for executive summaries
- **Platform Rankings**: Top drivers, high-risk cases, high-impact events

### Phase 3 API Routes
```
Phase 3A Routes (/api/admin/phase3a/):
- GET /reports/schedule, POST /reports/schedule, GET /reports/generate
- GET /presence/heartbeat, POST /presence/heartbeat, GET /presence/online-admins
- GET /productivity/stats
- GET /logins/failed
- GET /activity/heatmap
- GET /data-quality/issues
- GET /quarantine, POST /quarantine/:id/action
- GET /notes/:entityType/:entityId, POST /notes
- GET /config/preview
- GET /api-usage/stats
- GET /compliance/:countryCode

Phase 3C Routes (/api/admin/phase3c/):
- GET /analytics/rides, /analytics/eats, /analytics/parcel
- GET /intelligence/drivers, /intelligence/satisfaction, /intelligence/fraud
- GET /intelligence/health, /intelligence/insights, /intelligence/incidents
- GET /intelligence/earnings-irregularities, /intelligence/complaint-patterns
- GET /intelligence/ai-summary, /intelligence/rankings
- GET /errors/live, /notifications/timeline
- POST /intelligence/actions/:actionType
```

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.