# SafeGo Platform - AI Coding Assistant Instructions

## Project Overview

SafeGo is a full-stack super-app platform (Uber + DoorDash + Grab style) with ride-hailing, food delivery, and parcel delivery services. Built with React + TypeScript (frontend), Express + Prisma (backend), PostgreSQL database, supporting multi-country operations (Bangladesh, United States) with distinct KYC requirements.

**Critical Context**: This is a **security-first, production-grade multi-tenant system** with strict data visibility rules, role-based access control (RBAC), and real-time WebSocket communication.

---

## Architecture & Project Structure

### Monorepo Layout
```
client/          → React SPA with Vite, shadcn/ui components
server/          → Express REST API + WebSocket servers
shared/          → Type definitions & shared business logic
prisma/          → Database schema (15K+ lines, 100+ models)
scripts/         → Seed scripts, migrations, E2E tests
```

### Path Aliases (tsconfig.json)
- `@/*` → `client/src/*` (frontend components, pages, hooks)
- `@shared/*` → `shared/*` (cross-platform types)
- `@components/*` → `client/src/components/*`

### Module System
**Pure ESM project** - all files use `import/export`, no CommonJS. `package.json` has `"type": "module"`.

---

## Core Development Patterns

### 1. Multi-Role Architecture
Four distinct user roles with separate auth flows, dashboards, and permissions:
- **Customer** → Book rides, order food, send parcels
- **Driver** → Accept jobs, track earnings, manage wallet
- **Restaurant** → Menu management, order processing, commission tracking
- **Admin** → KYC approval, user management, financial operations

**Critical Pattern**: Each role has dedicated:
- Profile model (`driverProfile`, `customerProfile`, etc.)
- Route namespace (`/api/driver/*`, `/api/customer/*`)
- Frontend layout (`DriverLayout.tsx`, `AdminLayout.tsx`)
- Permission middleware (`requireRole(['driver'])`)

### 2. Data Visibility Rules (SECURITY CRITICAL)

**File**: [shared/visibilityRules.ts](shared/visibilityRules.ts)

**Never expose driver earnings to customers**:
```typescript
// ❌ FORBIDDEN - Leaks commission split
{ totalFare, driverPayout, safegoCommission }

// ✅ CORRECT - Customer view
type CustomerSafeView<T> = Omit<T, DriverOnlyField>
```

Driver-only fields: `driverPayout`, `safegoCommission`, `netEarnings`, `commissionRate`  
Customer-visible: `totalFare`, `baseFare`, `surgeAmount`, `discountAmount`

### 3. Authentication & Authorization

**JWT-based auth** with role-based middleware chain:
```typescript
// server/middleware/auth.ts
app.get('/api/driver/earnings', 
  authenticateToken,           // Verify JWT
  requireRole(['driver']),     // Check role
  loadDriverProfile,           // Hydrate profile
  async (req, res) => { ... }
);
```

**Critical**: All protected routes require `Authorization: Bearer <token>` header.

### 4. Prisma ORM Conventions

**Database access only through Prisma**:
```typescript
import { prisma } from './db';

// Includes for relations
const ride = await prisma.ride.findUnique({
  where: { id },
  include: { customer: true, driver: true }
});

// Always handle null/undefined from findUnique
if (!ride) return res.status(404).json({ error: "Ride not found" });
```

**UUID primary keys** for all entities. **Cascading deletes** configured in schema.

### 5. WebSocket Real-Time Communication

**Three WebSocket servers** (see [server/index.ts](server/index.ts)):
- `/api/dispatch/ws` → Ride matching, ETA updates ([server/websocket/dispatchWs.ts](server/websocket/dispatchWs.ts))
- `/api/food-orders/ws` → Restaurant order notifications
- `/api/admin/observability/ws` → Admin monitoring dashboard

**Authentication pattern**:
```typescript
ws://localhost:5000/api/dispatch/ws?token=<jwt_token>
```

### 6. Frontend State Management

**TanStack Query** for all server state:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['/api/driver/earnings'],
  queryFn: () => apiFetch('/api/driver/earnings')
});

const mutation = useMutation({
  mutationFn: (data) => apiFetch('/api/rides', { method: 'POST', body: data }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/rides'] })
});
```

**Centralized API client** at [client/src/lib/apiFetch.ts](client/src/lib/apiFetch.ts) handles:
- Base URL from `VITE_API_BASE_URL` env var
- Automatic token injection
- Error handling

### 7. Country-Specific Features

**Bangladesh vs United States** - Different KYC fields, tax calculations, ride pricing:
```typescript
// Conditional fields in Prisma schema
countryCode String // 'BD' | 'US'

// BD-specific: fatherName, presentAddress, permanentAddress, nidNumber
// US-specific: ssnLast4, dlNumber, governmentIdType
```

**BD-specific services**: [server/services/bdRideFareCalculationService.ts](server/services/bdRideFareCalculationService.ts)

---

## Critical Workflows

### Development Commands
```bash
npm run dev              # Start dev server (tsx + Vite HMR)
npm run build            # Build for production (esbuild + vite)
npm run db:push          # Push Prisma schema changes to DB
npm run check            # TypeScript type checking (no emit)
```

### Database Migrations
```bash
# After editing prisma/schema.prisma
npx prisma db push              # Dev: Push schema changes
npx prisma generate             # Regenerate Prisma Client types
npx tsx scripts/seed.ts         # Seed demo data
```

**Important**: Always run `prisma generate` after schema changes to update TypeScript types.

### Testing Strategy
- E2E integration tests in [scripts/e2e-combined-integration-test.ts](scripts/e2e-combined-integration-test.ts)
- Service unit tests in `server/services/__tests__/`
- No frontend tests currently (manual QA workflow)

---

## Code Style & Conventions

### Import Organization
1. External packages (`react`, `express`)
2. Internal absolute imports (`@/components/*`, `@shared/*`)
3. Relative imports (`./utils`, `../services`)

### Error Handling Pattern
```typescript
try {
  const result = await operation();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('[Context] Error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

### shadcn/ui Component Usage
All UI primitives from shadcn/ui (Radix UI + Tailwind):
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
```

**Design system**: See [design_guidelines.md](design_guidelines.md) for spacing (2,4,6,8,12), colors, typography.

---

## Common Pitfalls & Guardrails

### 🚨 Security
1. **Never log sensitive data**: passwords, JWT tokens, full SSN
2. **Always validate country-specific fields**: Check `countryCode` before accessing BD/US-only fields
3. **Respect visibility rules**: Use `CustomerSafeView<T>` helper for customer-facing responses

### ⚡ Performance
1. **WebSocket connection limits**: Max 500 concurrent connections per server
2. **Prisma includes**: Only include relations you need, avoid N+1 queries
3. **Frontend bundle size**: Vite code-splits routes automatically (check `chunkSizeWarningLimit`)

### 🐛 Debugging
1. **Auth errors**: Check `JWT_SECRET` env var exists (server fails fast if missing)
2. **CORS errors**: Production allows `safegoglobal.com` only (see [server/index.ts](server/index.ts#L10-L19))
3. **Database errors**: Run `npx prisma studio` to inspect DB state visually

---

## Key Reference Files

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) → Complete schema documentation with relationships
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) → REST endpoint specs with request/response examples
- [DEPLOYMENT.md](DEPLOYMENT.md) → Production deployment checklist (Railway, Netlify, env vars)
- [shared/visibilityRules.ts](shared/visibilityRules.ts) → Data visibility security rules
- [server/routes.ts](server/routes.ts) → Central route registration (100+ route modules)

---

## Environment Variables

**Backend** (`.env`):
```bash
DATABASE_URL="postgresql://..."     # Neon/Supabase Postgres URL
JWT_SECRET="..."                    # REQUIRED - 256-bit secret
STRIPE_SECRET_KEY="sk_test_..."    # Optional: Payment processing
```

**Frontend** (`.env.local`):
```bash
VITE_API_BASE_URL="http://localhost:5000"  # Dev: local backend
# Production: "https://api.safegoglobal.com"
```

---

## Working with This Codebase

**When adding features**:
1. Check if route namespace exists in [server/routes.ts](server/routes.ts)
2. Add Prisma model in [prisma/schema.prisma](prisma/schema.prisma)
3. Run `npx prisma db push && npx prisma generate`
4. Create route handler in `server/routes/<feature>.ts`
5. Register route in [server/routes.ts](server/routes.ts)
6. Add frontend page in `client/src/pages/<role>/<feature>.tsx`
7. Update route in `client/src/App.tsx` or layout component

**When fixing bugs**:
1. Check [QUICK_FIX_REFERENCE.md](QUICK_FIX_REFERENCE.md) for common issues
2. Use `grep` to find all usages of changed code
3. Test both customer and driver flows (roles behave differently)
4. Verify WebSocket reconnection if real-time feature

**When reviewing code**:
1. Ensure no driver-only fields leak to customer responses
2. Verify JWT middleware on all protected routes
3. Check Prisma query includes are minimal
4. Confirm error responses return JSON (not HTML)
