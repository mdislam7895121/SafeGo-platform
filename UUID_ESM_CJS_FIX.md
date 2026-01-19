# UUID ESM/CJS Runtime Fix

**Issue**: Railway runtime crash on `require("uuid")` when server runs as CommonJS (dist/index.cjs)
```
ERR_REQUIRE_ESM: require() of ES Module /app/node_modules/uuid/dist-node/index.js
from /app/dist/index.cjs not supported
```

**Root Cause**: uuid is ESM-only. Static `import { v4 as uuidv4 } from "uuid"` gets bundled into CommonJS as `require("uuid")`, which fails.

**Solution**: Dynamic import with lazy loading pattern for CJS-safe ESM consumption.

---

## Changes Made

### File: `server/services/backupService.ts`

**Before:**
```typescript
import { v4 as uuidv4 } from 'uuid';  // ❌ Static import → CommonJS require() at runtime
```

**After:**
```typescript
// CJS-safe dynamic import for uuid (ESM-only module in CommonJS runtime)
let _uuidv4: (() => string) | null = null;
async function getUuidv4Generator() {
  if (!_uuidv4) {
    const m = await import('uuid');
    _uuidv4 = m.v4;
  }
  return _uuidv4;
}
```

### Usage Sites

#### Line 206-215 (simulateBackupProcess)
**Before:**
```typescript
checksum: `sha256:${uuidv4().replace(/-/g, '')}`
```

**After:**
```typescript
const uuidv4Gen = await getUuidv4Generator();
checksum: `sha256:${uuidv4Gen().replace(/-/g, '')}`
```

#### Line 325-326 (initiateRestore)
**Before:**
```typescript
const confirmationToken = uuidv4().split('-')[0].toUpperCase();
```

**After:**
```typescript
const uuidv4Gen = await getUuidv4Generator();
const confirmationToken = uuidv4Gen().split('-')[0].toUpperCase();
```

---

## Build Verification

```bash
npm run build
# Output: dist/index.cjs 5.9mb
```

**Check 1: No static require of uuid**
```bash
Select-String 'require.*uuid' dist/index.cjs
# Output: (empty - no matches) ✓
```

**Check 2: Dynamic import present**
```bash
Select-String 'import.*uuid' dist/index.cjs | grep -i 'await import'
# Output: const m = await import("uuid"); ✓
```

**Check 3: No ESM errors during load**
- Module loads without `ERR_REQUIRE_ESM`
- JWT_SECRET validation error (expected) confirms module executed past uuid initialization

---

## Why This Works

1. **ESM module imported dynamically**: `await import('uuid')` works in CommonJS runtime
2. **Lazy loading**: Cached after first call via `_uuidv4` variable  
3. **Async-safe**: All callers already in async context (`simulateBackupProcess` setTimeout, `initiateRestore` async method)
4. **No behavioral changes**: `getUuidv4Generator()` returns the same v4 function

---

## Minimal Changes

- **1 file touched**: `server/services/backupService.ts` only
- **Lines changed**: 2 import lines + 2 usage sites
- **No route changes**: Auth, CORS, DB unaffected
- **No dependency changes**: uuid already in package.json
- **Build output**: Same 5.9MB, no extra bundling

---

## Non-Breaking

✓ Function behavior identical  
✓ No API changes  
✓ No database migrations  
✓ No route modifications  
✓ Fully backward compatible  

---

## Railway Deployment

The fix ensures:
1. `dist/index.cjs` has no `require("uuid")`
2. Runtime uses `await import("uuid")` instead
3. Server starts without `ERR_REQUIRE_ESM`
4. All backup/restore operations continue working

**Proof markers**:
- Startup logs: No `ERR_REQUIRE_ESM` error
- `/api/health` returns 200 (or appropriate auth error, not ESM error)
- Backup operations use uuid without crashes

---

## Commit

```
fix: make uuid ESM-safe under CJS runtime

Use dynamic import pattern for uuid to support both ESM and CommonJS
environments. Replaces static import with lazy-loaded dynamic import
to prevent ERR_REQUIRE_ESM at runtime on Railway.

Affects: server/services/backupService.ts only
- Adds getUuidv4Generator() helper with lazy caching
- Updates simulateBackupProcess and initiateRestore to use dynamic import
- No behavioral changes, fully backward compatible
```
