# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering global on-demand services such as ride-hailing, food delivery, and parcel delivery. The platform aims to capture a significant market share by providing a scalable, secure, and feature-rich solution that includes multi-role authentication, country-specific KYC, commission tracking, service lifecycle management, unified payment/payout systems, and comprehensive driver identity management.

## User Preferences
Preferred communication style: Simple, everyday language.
Development approach: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture
The frontend is built with React 18, TypeScript, Vite 5, shadcn/ui, Tailwind CSS 3, TanStack Query v5, wouter, and React Hook Form with Zod. It features a custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, and WCAG 2.1 AA compliance. The backend utilizes Node.js 20+, TypeScript, Express.js 4, and Prisma Client 6 with PostgreSQL 14+, following a Generic Service Layer with Role Adapters design.

**Key Architectural and Feature Highlights:**

*   **UI/UX Decisions**: Custom HSL color palette, Inter/Manrope typography, mobile-first responsive design, WCAG 2.1 AA compliance, Enterprise Admin Component Library, Dark/Light/System modes, accessibility modes, responsive typography, and optimized touch targets.
*   **Security & Compliance**: Implements HTTP security headers, rate limiting, 2FA, device/session security, AES-256-GCM encryption, tamper-proof audit logs, account lockout, phone masking, proxy calling, enhanced SOS, route deviation detection, device binding, admin 2FA, IP whitelisting, activity monitoring, developer access control with mTLS, payout audit trails, NYC TLC regulatory compliance, fraud detection dashboard, session security management, and emergency controls.
*   **Financial Systems**: Comprehensive Wallet & Earnings, Tax & Fees, and Unified Payout systems, managing commissions, negative balances, multi-country taxes, and enterprise-grade payment/payout rails, including a payment verification console.
*   **Customer & Partner Onboarding**: Multi-step onboarding and country-specific KYC with real-time ID verification, background checks, facial recognition, and a multi-stage review queue.
*   **Service Offerings**: Supports Food Delivery, Ride-Hailing, and Parcel Delivery with features like restaurant management, multi-route fare engine, and dynamic pricing.
*   **Loyalty & Incentives**: SafeGo Points System, Opportunity Bonus Management System, and Driver Incentive Engine.
*   **Real-Time & Optimization**: AI Marketplace Balancer, Real-Time Dispatch System (WebSocket-based, proximity matching), Experience Intelligence with real-time ETA refinement, dynamic routing optimization, personalized push notifications, and Admin Notifications WebSocket.
*   **Profit-Focused Automation Systems**: A suite of 32 services covering core automation, security & fraud prevention, risk intelligence, experience optimization, and platform operations.
*   **Regional Expansion**: Supports specific roles and KYC for Bangladesh with Bangla UX.
*   **API Design**: Robust API endpoints with enforcement of KYC, ownership validation, Zod schema validation, atomic transactions, and consistent error handling.
*   **Database Schema**: Utilizes UUID primary keys, indexed foreign keys, decimal types for monetary values, and comprehensive models.
*   **Role-Based Access Control (RBAC)**: Comprehensive 8-role admin system with granular permissions, permission bundles, emergency lockdown controls, admin impersonation mode, secure internal messaging, role visualization, and permission matrix.
*   **Global Audit Engine**: Tamper-proof logging with hash chain verification, evidence packets, regulator export mode, and an expanded full audit console.
*   **Enterprise Administration**: Features such as Feature Flags Management, Enterprise Search Engine, Data Export Center, Incident Response Playbook, Customer Support Panel, Partner Compliance Center, System Health Monitor, Push Notifications, Policy Manager, Backup & Recovery, and an Intelligence Dashboard with service analytics, driver performance, customer satisfaction, and automated insights.
*   **Enterprise Admin Dashboard**: Includes tools for scheduled reports, live admin presence, productivity logs, failed login monitoring, admin activity heatmap, data quality monitoring, quarantine vault, admin notes, configuration preview, API usage graphs, and country compliance settings.
*   **Real-Time Analytics**: WCAG 2.1 AA compliance, live error panel, consolidated notification timeline, virtual scrolling, and real-time analytics component using WebSockets.
*   **Intelligence Layer**: Enhanced Intelligence Dashboard with service analytics, driver performance intelligence, customer satisfaction, fraud detection, platform health monitoring, automated insights, earnings irregularity monitoring, customer complaint patterns, AI summary, and platform rankings.
*   **Complaint Resolution Center**: SLA timer system, SLA status indicators, AI summary generation, multi-filter system, triage notes, and resolution workflow.
*   **Driver Violation Management**: Violation types, severity levels, point system, penalty management, and appeal processing.
*   **Customer Trust & Safety Review Board**: Case types, priority levels, committee decision workflow, multi-language support for decision letters, and action tracking.
*   **Policy Enforcement Engine**: Policy types, rule engine, policy lifecycle management, and version control.
*   **Global Export Center**: Export types (CSV, JSON, XLSX), SHA-256 checksums, date range filtering, and processing queue.
*   **Admin Activity Monitor**: Live activity feed, risk scoring, anomaly detection, geo-location tracking, and security alerts.
*   **Ratings & Review Center**: Driver and restaurant ratings aggregation, fraud detection, and review details panel.
*   **Driver Violations Center Enhanced**: Category filters, create violation dialog, investigator assignment, violation timeline, evidence tab, and resolution workflow.
*   **Earnings Dispute Resolution**: Dispute list with status filtering, amount comparison, evidence review, decision workflow, and summary dashboard.
*   **Ride Timeline Viewer**: Event timeline, location markers, payment events, safety events, and anomaly detection.
*   **Notification Rules Engine**: Rule management, trigger configuration, action types (email, push, SMS), escalation settings, and template library.
*   **Payment Integrity Dashboard**: Integrity score, anomaly detection, fraud patterns, Stripe sync status, and 7-day trends.
*   **Global Admin Search**: Multi-entity search, type filters, debounced search, result grouping, and quick navigation.
*   **Operations Console**: System job monitoring with status tracking (RUNNING, SUCCESS, FAILED, PARTIAL, CANCELLED), service health checks (database, Stripe, Google Maps, Twilio, email, Redis, WebSocket, file storage), error logging with severity levels (DEBUG, INFO, WARNING, ERROR, CRITICAL), and resolution workflow. Includes auto-refresh, filtering, and trend visualization.
*   **Backup & Disaster Recovery**: Comprehensive backup management system with BackupSnapshot model tracking metadata, size, type, status, storage location, retention settings, and verification. Features INFRA_ADMIN role with specialized permissions (VIEW_BACKUPS, CREATE_BACKUP, RESTORE_BACKUP, DELETE_BACKUP, MANAGE_DR_CONFIG, VIEW_DR_STATUS), restore operations with two-step confirmation tokens, DR status dashboard with RPO/RTO targets, cross-region replication status, and environment-specific backup statistics.
*   **SafePilot Intelligence Engine**: Upgraded SafePilot from a basic admin assistant into a world-class business automation engine with 8 intelligence modules:
    - **Growth Engine**: Revenue optimization, market expansion opportunities, market share projection, and growth actions
    - **Cost Reduction Engine**: Refund abuse detection, discount abuse patterns, incentive overspend analysis, payout leakage detection with country-scoped bulk queries
    - **Fraud & Safety Shield**: Real-time fraud alerts, suspicious driver monitoring, coordinated fraud rings, safety incident patterns
    - **Partner Success Coach**: Partner performance metrics, personalized coaching recommendations, success predictions
    - **Customer Retention AI**: Unhappy customer detection, apology message generation, win-back strategies, churn prediction using optimized bulk queries
    - **Marketing AI**: Campaign optimization, customer segmentation, A/B testing insights, personalized promotions
    - **Financial Intelligence**: Revenue forecasting, expense analysis, profitability metrics, cash flow projections
    - **Legal & Compliance Guard**: Regulatory monitoring, compliance alerts, document expiration tracking, audit preparation
    
    Features include a dedicated Intelligence dashboard page (/admin/safepilot-intelligence), enhanced SafePilot drawer with Intelligence tab, 60+ API endpoints with RBAC (USE_SAFEPILOT permission), and production-safe queries with country-scoping and bulk aggregations.

*   **SafePilot Master Upgrade (v2.0)**: Enterprise-grade intelligence enhancements added December 2025:
    - **One-Click Crisis Report**: Real-time platform status with top 5 risks, opportunities, urgent fixes, financial/operational impact analysis, and recommended next steps via `/api/admin/safepilot/crisis-report`
    - **Explain This Decision Mode**: Transparent AI decision-making showing data sources, reasoning chain, confidence levels (LOW/MEDIUM/HIGH/VERY_HIGH), alternatives, and appeal guidance via `/api/admin/safepilot/explain-decision`
    - **Background Autonomous Monitoring**: Continuous platform scanning detecting fraud spikes, driver anomalies, account registration surges, refund increases, payment failures, and safety incidents with health score (0-100) via `/api/admin/safepilot/autonomous-scan`
    - **Company Survival Mode**: Startup-focused cost optimization with automation opportunities (FULL/PARTIAL/ASSISTED), cost-cutting options with risk assessment, growth opportunities with effort/timeframe, weekly focus areas, human-required vs. automatable tasks via `/api/admin/safepilot/survival-mode`
    - **Voice Command UI**: Placeholder for future voice-to-text integration with microphone button and visual feedback
    - **Enhanced Mobile Responsiveness**: 6-tab layout (Intel, Context, Chat, Crisis, Survival, History), touch-optimized controls (44px minimum), quick action buttons, health score indicator, and safe-area padding
    - **Context Debug Mode**: Enhanced debugging with handler existence checks, data source validation, fallback tracking, and load time metrics via `/api/admin/safepilot/context-debug`
    - **Health & Metrics APIs**: System health dashboard (`/health`) and performance metrics (`/metrics`) with uptime, query counts, and response times

## External Dependencies

*   **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
*   **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
*   **UI Components**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
*   **Third-party Services**: Twilio (SMS OTP), AgentMail (Email OTP), Stripe (payment gateway), Google Maps Platform (Maps JavaScript API, Places API, Directions API, Geocoding API), bKash, Nagad, Checkr, AWS Rekognition, Persona/Onfido.