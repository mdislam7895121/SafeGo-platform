# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services, aiming to become a leading global super-app by integrating urban services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React 18 with TypeScript, Vite 5, shadcn/ui (Radix UI), Tailwind CSS 3, TanStack Query v5, wouter, React Hook Form with Zod.
- **Design System**: Custom HSL-based color palette (light/dark mode), Inter/Manrope typography, mobile-first responsive design, skeleton loading, toast notifications, error boundaries, protected routes with role-based access control.
- **Key Features**: Admin panel for managing users and services, real-time data updates (5-second polling), interactive admin dashboard, customer ride history, optional GPS for ride requests, country-specific identity fields (Bangladesh NID, USA SSN with encryption), driver license and background check tracking, unified Document Center with tabbed interface (Drivers/Customers/Restaurants) for reviewing KYC submissions with approve/reject workflows and real-time refresh.

### Backend Architecture
- **Technology Stack**: Node.js 20+ with TypeScript (ESM), Express.js 4, Prisma Client 6 with PostgreSQL 14+, JWT authentication with bcrypt.
- **Core Features**: Multi-role authentication (customer, driver, restaurant, admin), country-specific KYC with admin approval, service lifecycle management (Ride-hailing, Food, Parcel), commission and wallet system (cash/online payments, negative balance), user notification system, management APIs for CRUD operations on users and complaints, country-based ride matching with FIFO ordering, centralized Document Center for reviewing KYC documents across all user types with search, filtering, and pagination.
- **Security Architecture**: Environment variable-based JWT secret, bcrypt password hashing, AES-256-GCM encryption for sensitive data (NID, SSN), Zod input validation, role-based middleware, CSRF protection, SQL injection prevention via Prisma, admin-only decryption of sensitive data.
- **Database Schema Design**: UUID primary keys, indexed foreign keys, decimal types for monetary values, `isSuspended` fields, `DriverComplaint` model extended for restaurant complaints, country-specific identity fields for Bangladesh and USA drivers (nullable for backward compatibility), driver profile photos, structured USA driver names, DMV/TLC license images, `VehicleDocument` model for registration and insurance, Prisma schema uses PascalCase model names with @@map directives to snake_case table names for code clarity.

### Project Structure
- `client/`: React frontend
- `server/`: Express backend
- `prisma/`: Database schema
- `scripts/`: Seed data
- `attached_assets/`: Static assets
- `Documentation/`: Project documentation

## External Dependencies

### Production Dependencies
- **Backend Core**: `@prisma/client`, `express`, `bcrypt`, `jsonwebtoken`, `@neondatabase/serverless`.
- **Frontend Core**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `zod`.
- **UI Components (shadcn/ui)**: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: JWT signing secret.
- `NODE_ENV`: Environment mode.
- `ENCRYPTION_KEY`: 32-byte encryption key for NID and SSN.