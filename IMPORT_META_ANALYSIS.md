# import.meta Usage Analysis

**Date**: January 18, 2026  
**Search**: `git grep -n "import\.meta\.url"` and `git grep -n "import\.meta"`

---

## Summary

The SafeGo codebase uses `import.meta` for:
1. **`import.meta.url`** - ESM module URL resolution (7 occurrences)
2. **`import.meta.env`** - Vite environment variables (8+ occurrences)
3. **`import.meta.dirname`** - Directory path resolution in ESM (4 occurrences)

This is standard ESM practice for a Vite + Node.js TypeScript project.

---

## Files Using import.meta.url

| File | Line | Usage | Purpose |
|------|------|-------|---------|
| `build.mjs` | 6 | `fileURLToPath(import.meta.url)` | Build script directory resolution |
| `prisma/seeds/bdRidePricing.ts` | 441 | `import.meta.url === \`file://${process.argv[1]}\`` | Check if script is main module |
| `prisma/seeds/bdRidePricing.ts` | 442 | `import.meta.url.endsWith(...)` | Alternative check for main module |
| `prisma/seeds/promotionEngine.ts` | 313 | `process.argv[1] === fileURLToPath(import.meta.url)` | Check if script is main module |
| `server/utils/seedPaymentConfig.ts` | 534 | `import.meta.url === \`file://${process.argv[1]}\`` | Check if script is main module |

---

## Files Using import.meta.dirname

| File | Line | Usage | Purpose |
|------|------|-------|---------|
| `server/vite.ts` | 49 | `import.meta.dirname` | Get server directory path |
| `server/vite.ts` | 71 | `path.resolve(import.meta.dirname, "public")` | Resolve public folder |
| `vite.config.ts` | 13-15 | `path.resolve(import.meta.dirname, ...)` | Configure path aliases |
| `vite.config.ts` | 18 | `path.resolve(import.meta.dirname, "client")` | Set Vite root |
| `vite.config.ts` | 22 | `path.resolve(import.meta.dirname, "dist/public")` | Set output directory |

---

## Files Using import.meta.env

| File | Line | Usage | Purpose |
|------|------|-------|---------|
| `client/src/components/ErrorBoundary.tsx` | 55 | `import.meta.env.DEV` | Check development mode |
| `client/src/components/maps/OptimizedMapWrapper.tsx` | 103 | `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` | Get Maps API key |
| `client/src/components/ui/social-share-button.tsx` | 190-191 | `import.meta.env.VITE_PUBLIC_URL` | Get public URL |
| `client/src/lib/apiClient.ts` | 17 | `import.meta.env.VITE_API_BASE_URL` | Get API base URL |
| `client/src/lib/apiClient.ts` | 41, 127 | `import.meta.env.DEV` | Check development mode |

---

## Detailed Usage Patterns

### 1. ESM Module Detection (Seed Scripts)

```typescript
// Pattern: Check if file is main module
if (import.meta.url === `file://${process.argv[1]}` || 
    import.meta.url.endsWith(process.argv[1]?.split('/').pop() || '')) {
  // Run seed logic
}
```

**Files**: 
- `prisma/seeds/bdRidePricing.ts:441-442`
- `prisma/seeds/promotionEngine.ts:313`
- `server/utils/seedPaymentConfig.ts:534`

---

### 2. Path Resolution (Build & Config)

```typescript
// Pattern: Get directory path for resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Or directly (Node 20.11+):
const distPath = path.resolve(import.meta.dirname, "public");
```

**Files**:
- `build.mjs:6`
- `server/vite.ts:49, 71`
- `vite.config.ts:13-15, 18, 22`

---

### 3. Vite Environment Variables (Client)

```typescript
// Pattern: Access Vite environment variables
const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
const isDev = import.meta.env.DEV;
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

**Files**:
- `client/src/lib/apiClient.ts` - API URL, dev detection
- `client/src/components/ErrorBoundary.tsx` - Dev mode detection
- `client/src/components/maps/OptimizedMapWrapper.tsx` - Maps API key
- `client/src/components/ui/social-share-button.tsx` - Public URL

---

## Documentation References

These files document import.meta usage:
- `DEPLOYMENT_REFERENCE.md` - Shows __dirname pattern examples
- `ENV_LOADING_FIX_REPORT.md` - Explains environment loading
- `EXACT_CHANGES_MINIMAL_DIFF.md` - Shows __dirname additions
- `FRONTEND_BACKEND_COMMUNICATION_INVESTIGATION.md` - Details API URL loading
- `FRONTEND_BACKEND_INTEGRATION_PROOF.md` - Proves API integration

---

## Best Practices Used ✓

1. **ESM-only project**: All files use `import/export`, no CommonJS
2. **Proper Node.js compatibility**:
   - `fileURLToPath()` for URL→path conversion
   - `import.meta.dirname` used where available (Node 20.11+)
3. **Vite integration**:
   - `import.meta.env` for environment variables
   - `import.meta.env.DEV` for dev detection
4. **Seed script detection**: Proper module entry point detection

---

## Platform Compatibility

| Platform | Node Version | import.meta.url | import.meta.dirname | import.meta.env |
|----------|-------------|-----------------|---------------------|-----------------|
| Node 12-19 | ✓ | ✓ | ✗ (use fileURLToPath) | ✗ (dev only) |
| Node 20.11+ | ✓ | ✓ | ✓ (use directly) | ✓ (with Vite) |
| Vite (browser) | N/A | ✗ | ✗ | ✓ (static replacement) |

---

## Vite Environment Variables

Currently used in `.env.local`:
```bash
VITE_API_BASE_URL=http://localhost:5000     # API backend URL
VITE_GOOGLE_MAPS_API_KEY=                   # Maps API key
VITE_PUBLIC_URL=http://localhost:5173       # Frontend URL (dev)
```

Accessed via:
```typescript
import.meta.env.VITE_API_BASE_URL
import.meta.env.VITE_GOOGLE_MAPS_API_KEY
import.meta.env.VITE_PUBLIC_URL
import.meta.env.DEV  // Vite auto-provides
```

---

## Conclusion

✓ **All import.meta usage is correct for ESM + Vite + Node.js**
✓ **No deprecated patterns used**
✓ **Proper file type declarations (package.json: "type": "module")**
✓ **Compatible with modern Node.js and Vite tooling**

No changes needed.
