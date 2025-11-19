# SafeGo Global Super-App

## Overview
SafeGo is a production-ready, full-stack multi-service super-app platform offering ride-hailing, food delivery, and parcel delivery across multiple countries. Its purpose is to provide a comprehensive, scalable, and secure platform for on-demand services. Key capabilities include multi-role authentication, country-specific KYC, commission tracking with negative balance support, and full service lifecycle management. The business vision is to become a leading global super-app, capitalizing on the growing demand for integrated urban services.

## User Preferences
**Preferred communication style**: Simple, everyday language.

**Development approach**: Full-stack TypeScript with modern tooling, emphasizing code quality, security, and scalability.

## System Architecture

### Frontend Architecture
**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Library**: shadcn/ui components (Radix UI primitives)
- **Styling**: Tailwind CSS 3
- **State Management**: TanStack Query v5
- **Routing**: wouter
- **Form Handling**: React Hook Form with Zod validation

**Design System:**
- Custom HSL-based color palette with light/dark mode
- Typography: Inter (primary), Manrope (secondary)
- Mobile-first responsive design
- Skeleton loading states, toast notifications, error boundaries
- Auto-redirect after login based on user role, protected routes with role-based access control.

**Key Features:**
- Comprehensive admin panel for managing drivers, customers, and restaurants (listing, suspension, blocking, complaints, statistics).
- Real-time data updates via 5-second polling for critical dashboards and lists.
- Interactive Admin Dashboard with clickable statistic cards.
- Customer ride history display.
- GPS coordinates for ride requests are optional, enabling address-based matching.
- Bangladesh-specific identity fields for customers and drivers with secure NID encryption and admin-only decryption.
- USA-specific driver identity management with SSN encryption, license verification, structured address, emergency contacts, and background check tracking.

### Backend Architecture
**Technology Stack:**
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Framework**: Express.js 4 for REST API
- **ORM**: Prisma Client 6 with PostgreSQL
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: PostgreSQL 14+

**Core Features:**
- **Multi-Role Authentication System**: Supports customer, driver, restaurant, and admin roles with JWT-based, role-specific access.
- **Country-Specific KYC System**: Custom verification for Bangladesh and United States with admin approval, supporting multiple roles.
- **Service Management**: Lifecycle management for Ride-hailing, Food delivery, and Parcel delivery with status flow validation.
- **Commission & Wallet System**: Supports cash and online payments with commission tracking, negative balance support, and admin settlement.
- **Notification System**: User notifications for service updates and KYC status.
- **Management APIs**: Endpoints for listing, detailed views, and administrative actions (suspend, block, unblock) for drivers, customers, and restaurants.
- **Complaint Management API**: Endpoints for listing, viewing details, and resolving complaints, supporting both driver and restaurant complaints.
- **Ride Matching**: Country-based ride matching, filtering rides by driver's country and status, FIFO ordering.

**Security Architecture:**
- Environment variable-based JWT secret, bcrypt hashing for passwords.
- AES-256-GCM encryption for sensitive data (NID and SSN) with 32-byte ENCRYPTION_KEY.
- SSN encryption using ssnEncrypted field, never exposed in plain text, admin-only masked SSN access (###-##-1234).
- Zod schema for input validation, role-based middleware, CSRF protection, and SQL injection prevention via Prisma.
- Admin-only endpoints for decrypting sensitive data with authentication tag verification.

**Database Schema Design:**
- User table linked to role-specific profiles.
- UUID primary keys, indexed foreign keys, decimal types for monetary values.
- `isSuspended`, `suspensionReason`, `suspendedAt` fields for drivers, customers, and restaurants.
- `DriverComplaint` model extended to handle restaurant complaints, linking relevant IDs.
- Bangladesh-specific identity fields (fullName, fatherName, phoneNumber, village, postOffice, thana, district, addresses, nidEncrypted) for customers and drivers.
- USA-specific driver identity fields (usaFullLegalName, dateOfBirth, ssnEncrypted, usaPhoneNumber, driverLicenseNumber, licenseStateIssued, driverLicenseExpiry, usaStreet, usaCity, usaState, usaZipCode, emergencyContactName, emergencyContactPhone, backgroundCheckStatus, backgroundCheckDate) - all nullable for backward compatibility.

### Project Structure:
- `client/`: React frontend
- `server/`: Express backend with routes and middleware
- `prisma/`: Database schema
- `scripts/`: Seed data
- `attached_assets/`: Static assets
- `Documentation/`: Project documentation

## External Dependencies

### Production Dependencies
**Backend Core:**
- `@prisma/client`: Type-safe database client
- `express`: Web framework
- `bcrypt`: Password hashing
- `jsonwebtoken`: JWT authentication
- `@neondatabase/serverless`: PostgreSQL driver

**Frontend Core:**
- `react`, `react-dom`: UI library
- `wouter`: Client-side routing
- `@tanstack/react-query`: Server state management
- `react-hook-form`: Form management
- `zod`: Schema validation

**UI Components (shadcn/ui):**
- `@radix-ui/*`: Headless component primitives
- `lucide-react`: Icon library
- `class-variance-authority`: Component variants
- `tailwind-merge`, `clsx`: CSS utilities

### Environment Variables
**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `NODE_ENV`: Environment mode (development/production)
- `ENCRYPTION_KEY`: 32-byte encryption key for NID and SSN protection

## Recent Updates

### USA Driver Identity System (November 2025)
**Objective:** Extended driver management with comprehensive USA-specific identity fields while maintaining full backward compatibility with existing Bangladesh driver system.

**Implementation:**
- **Schema Extension:** Added 14 USA-specific fields to DriverProfile model (all nullable)
  - Personal: usaFullLegalName, dateOfBirth, usaPhoneNumber
  - License: driverLicenseNumber, licenseStateIssued, driverLicenseExpiry
  - Address: usaStreet, usaCity, usaState, usaZipCode (structured)
  - Emergency: emergencyContactName, emergencyContactPhone
  - Verification: backgroundCheckStatus, backgroundCheckDate
  - Security: ssnEncrypted (AES-256-GCM, never plain text)

- **API Endpoints:**
  - `PATCH /api/admin/drivers/:id/usa-profile` - Update USA driver profile (admin only, Zod validation)
  - `GET /api/admin/drivers/:id/ssn` - Fetch masked SSN (admin only, returns ###-##-1234 format)

- **Frontend Components:**
  - USA Identity Information Card (conditional rendering for US drivers)
  - Edit USA Profile Dialog (14 fields, matching BD pattern)
  - SSN masking and secure viewing
  - State management with React Query mutations

- **Security:**
  - SSN encryption with maskSSN utility (shows only last 4 digits)
  - SSN validation: 9-digit format enforced
  - State code validation: 2-character uppercase
  - Admin-only access with role-based middleware
  - No plain-text SSN in any response

- **Backward Compatibility:**
  - All existing BD driver fields unchanged
  - Customer and restaurant models unaffected
  - Parcel delivery flows remain intact
  - Ride-hailing matching logic unchanged
  - Zero breaking changes to existing features