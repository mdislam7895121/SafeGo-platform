# EXACT CHANGES - MINIMAL ENV LOADING FIX

## File 1: server/index.ts
**Lines 1-11 (BEFORE:**
```typescript
import express from "express";
import { registerRoutes } from "./routes";
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { observabilityService } from "./services/observabilityService";
import { corsMiddleware } from "./middleware/securityHeaders";
import { attemptPrismaMigrations } from "./lib/migrationGuard";
```

**Lines 1-16 (AFTER):**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import express from "express";
import { registerRoutes } from "./routes";
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { observabilityService } from "./services/observabilityService";
import { corsMiddleware } from "./middleware/securityHeaders";
import { attemptPrismaMigrations } from "./lib/migrationGuard";
```

**Diff:**
```diff
+ import dotenv from 'dotenv';
+ import path from 'path';
+ import { fileURLToPath } from 'url';
+
+ const __dirname = path.dirname(fileURLToPath(import.meta.url));
+ dotenv.config({ path: path.join(__dirname, '.env') });
+
  import express from "express";
  import { registerRoutes } from "./routes";
  import { Server as HTTPServer } from "http";
```

---

## File 2: server/middleware/auth.ts
**Lines 1-10 (BEFORE):**
```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { requirePermission, Permission, AdminUser } from "../utils/permissions";
import { prisma } from "../db";

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
// This ensures tokens cannot be forged even if environment guard is bypassed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
```

**Lines 1-16 (AFTER):**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { requirePermission, Permission, AdminUser } from "../utils/permissions";
import { prisma } from "../db";

// Load .env from server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
// This ensures tokens cannot be forged even if environment guard is bypassed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
```

**Diff:**
```diff
+ import dotenv from 'dotenv';
+ import path from 'path';
+ import { fileURLToPath } from 'url';
  import { Request, Response, NextFunction } from "express";
  import jwt from "jsonwebtoken";
  import { requirePermission, Permission, AdminUser } from "../utils/permissions";
  import { prisma } from "../db";
+
+ // Load .env from server directory
+ const __dirname = path.dirname(fileURLToPath(import.meta.url));
+ dotenv.config({ path: path.join(__dirname, '../.env') });
+
  // SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
  // This ensures tokens cannot be forged even if environment guard is bypassed
  if (!process.env.JWT_SECRET) {
```

---

## File 3: server/routes/auth.ts
**Lines 1-22 (BEFORE):**
```typescript
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { getAdminCapabilities } from "../utils/permissions";
import { loadAdminProfile, AuthRequest, authenticateToken, JWTPayload } from "../middleware/auth";
import { rateLimitAdminLogin, resetLoginAttempts } from "../middleware/rateLimit";
import { isTwoFactorEnabled, verifyTwoFactorToken, getTwoFactorSecret } from "../services/twoFactorService";
import { 
  issueRefreshToken, 
  rotateRefreshToken, 
  revokeRefreshToken,
  revokeAllUserTokens 
} from "../services/refreshTokenService";

const router = Router();

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
// This ensures tokens cannot be forged even if environment guard is bypassed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
```

**Lines 1-30 (AFTER):**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { getAdminCapabilities } from "../utils/permissions";
import { loadAdminProfile, AuthRequest, authenticateToken, JWTPayload } from "../middleware/auth";
import { rateLimitAdminLogin, resetLoginAttempts } from "../middleware/rateLimit";
import { isTwoFactorEnabled, verifyTwoFactorToken, getTwoFactorSecret } from "../services/twoFactorService";
import { 
  issueRefreshToken, 
  rotateRefreshToken, 
  revokeRefreshToken,
  revokeAllUserTokens 
} from "../services/refreshTokenService";

// Load .env from server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const router = Router();

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
// This ensures tokens cannot be forged even if environment guard is bypassed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
```

**Diff:**
```diff
+ import dotenv from 'dotenv';
+ import path from 'path';
+ import { fileURLToPath } from 'url';
  import { Router } from "express";
  import bcrypt from "bcrypt";
  import jwt from "jsonwebtoken";
  import crypto from "crypto";
  import { prisma } from "../lib/prisma";
  import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
  import { getAdminCapabilities } from "../utils/permissions";
  import { loadAdminProfile, AuthRequest, authenticateToken, JWTPayload } from "../middleware/auth";
  import { rateLimitAdminLogin, resetLoginAttempts } from "../middleware/rateLimit";
  import { isTwoFactorEnabled, verifyTwoFactorToken, getTwoFactorSecret } from "../services/twoFactorService";
  import { 
    issueRefreshToken, 
    rotateRefreshToken, 
    revokeRefreshToken,
    revokeAllUserTokens 
  } from "../services/refreshTokenService";
+
+ // Load .env from server directory
+ const __dirname = path.dirname(fileURLToPath(import.meta.url));
+ dotenv.config({ path: path.join(__dirname, '../.env') });
+
  const router = Router();
  
  // SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
```

---

## File 4: server/websocket/supportChatWs.ts
**Lines 1-12 (BEFORE):**
```typescript
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

const prisma = db;

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. WebSocket authentication cannot function.");
}
const JWT_SECRET = process.env.JWT_SECRET;
```

**Lines 1-18 (AFTER):**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

// Load .env from server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = db;

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. WebSocket authentication cannot function.");
}
const JWT_SECRET = process.env.JWT_SECRET;
```

**Diff:**
```diff
+ import dotenv from 'dotenv';
+ import path from 'path';
+ import { fileURLToPath } from 'url';
  import { Server as HTTPServer } from "http";
  import { WebSocketServer, WebSocket } from "ws";
  import jwt from "jsonwebtoken";
  import { db } from "../db";
+
+ // Load .env from server directory
+ const __dirname = path.dirname(fileURLToPath(import.meta.url));
+ dotenv.config({ path: path.join(__dirname, '../.env') });
+
  const prisma = db;
  
  // SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
```

---

## File 5: server/websocket/rideChatWs.ts
**Lines 1-12 (BEFORE):**
```typescript
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

const prisma = db;

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. WebSocket authentication cannot function.");
}
const JWT_SECRET = process.env.JWT_SECRET;
```

**Lines 1-18 (AFTER):**
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db";

// Load .env from server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = db;

// SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. WebSocket authentication cannot function.");
}
const JWT_SECRET = process.env.JWT_SECRET;
```

**Diff:**
```diff
+ import dotenv from 'dotenv';
+ import path from 'path';
+ import { fileURLToPath } from 'url';
  import { Server as HTTPServer } from "http";
  import { WebSocketServer, WebSocket } from "ws";
  import jwt from "jsonwebtoken";
  import { db } from "../db";
+
+ // Load .env from server directory
+ const __dirname = path.dirname(fileURLToPath(import.meta.url));
+ dotenv.config({ path: path.join(__dirname, '../.env') });
+
  const prisma = db;
  
  // SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
```

---

## Summary

| File | Change Type | Lines Added |
|---|---|---|
| server/index.ts | Add dotenv config at startup | +6 |
| server/middleware/auth.ts | Add dotenv config before JWT check | +6 |
| server/routes/auth.ts | Add dotenv config before JWT check | +6 |
| server/websocket/supportChatWs.ts | Add dotenv config before JWT check | +6 |
| server/websocket/rideChatWs.ts | Add dotenv config before JWT check | +6 |
| **TOTAL** | **5 files changed** | **+30 lines** |

**Pattern:** Each file adds identical pattern:
```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });  // or '.env' in index.ts
```

**Scope:** ✅ ENVIRONMENT LOADING ONLY - No logic changes, no middleware changes, no route changes
