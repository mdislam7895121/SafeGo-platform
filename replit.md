# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services, aiming to become a leading global super-app by integrating urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### UI/UX Decisions
- **Technology Stack**: React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, React Hook Form with Zod.
- **Design System**: Custom HSL-based color palette (light/dark mode), Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control.

### Technical Implementations
- **Frontend Features**: Admin panel for managing users and services, real-time data updates, interactive admin dashboard, customer ride history, optional GPS for ride requests, country-specific identity fields (Bangladesh NID, USA SSN with encryption), driver license and background check tracking, unified Document Center with tabbed interface for reviewing KYC submissions, and an enhanced Wallet Settlement System with overview stats, pending settlements, and transaction history. Includes a comprehensive driver financial analytics dashboard with service and country breakdowns. **Admin Activity Audit Trail** provides comprehensive security and compliance monitoring with searchable, filterable logs of all critical admin actions (login, KYC approvals, account blocks) with automatic IP tracking and sensitive data masking.
- **Backend Technology Stack**: Node.js 20+ with TypeScript (ESM), Express.js 4, Prisma Client 6 with PostgreSQL 14+, JWT authentication with bcrypt.
- **Core Backend Features**: Multi-role authentication (customer, driver, restaurant, admin), country-specific KYC with admin approval, service lifecycle management (Ride-hailing, Food, Parcel), commission and wallet system (cash/online payments, negative balance), user notification system, management APIs for CRUD, country-based ride matching with FIFO ordering, centralized Document Center, comprehensive Wallet Settlement System, and **Admin Activity Audit Trail** with automatic logging of critical admin actions, IP address tracking, and graceful failure handling.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt password hashing, AES-256-GCM encryption for sensitive data (NID, SSN), Zod input validation, role-based middleware, CSRF protection, SQL injection prevention via Prisma, admin-only decryption of sensitive data, and **comprehensive audit logging** with automatic sensitive data masking (passwords, SSN/NID) and IP address tracking for compliance and security monitoring.
- **Database Schema Design**: UUID primary keys, indexed foreign keys, decimal types for monetary values, `isSuspended` fields, `DriverComplaint` model extended for restaurant complaints, country-specific identity fields, driver profile photos, structured USA driver names, DMV/TLC license images, `VehicleDocument` model for registration and insurance. Includes DMV inspection tracking with `dmvInspectionType`, `dmvInspectionDate`, `dmvInspectionExpiry`, `dmvInspectionImageUrl`, and a computed `dmvInspectionStatus`. USA-specific vehicle fields like `make`, `model`, `year`, `color`, `licensePlate`, `registrationDocumentUrl`, `registrationExpiry`, `insuranceDocumentUrl`, and `insuranceExpiry` are also part of the schema. **AuditLog model** tracks all critical admin actions with actorId, actorEmail, actorRole, actionType, entityType, entityId, description, metadata (JSON), success flag, ipAddress, userAgent, and createdAt timestamp, with indexes on actorId, actionType, entityType, and createdAt for efficient querying.

## External Dependencies

- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.
- **Environment Variables**: `DATABASE_URL` (PostgreSQL connection string), `JWT_SECRET`, `NODE_ENV`, `ENCRYPTION_KEY` (for NID and SSN).