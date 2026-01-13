# SafeGo Frontend - Environment Configuration

## Local Development

For local development, create a `.env.local` file in the `client` directory:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## Netlify Production Deployment

On Netlify, set the following environment variable in Site Settings > Build & deploy > Environment:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://api.safegoglobal.com` |

This variable must be set for:
- **All deploy contexts** (Production, Deploy previews, Branch deploys)
- The frontend build process will embed this value at build time

## How It Works

- The `VITE_API_BASE_URL` environment variable is used by the frontend to construct API URLs
- In development (local): Points to `http://localhost:8080` (local backend)
- In production (Netlify): Points to `https://api.safegoglobal.com` (Railway backend)
- The value is accessed via `import.meta.env.VITE_API_BASE_URL` in the code

## API Client Usage

All API calls should use the centralized `apiFetch()` helper from `@/lib/apiClient`:

```typescript
import { apiFetch } from "@/lib/apiClient";

// Example: Signup
const response = await apiFetch("/api/auth/signup", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
```

The `apiFetch()` helper automatically:
- Constructs the full URL using `VITE_API_BASE_URL`
- Sets proper headers (Content-Type, Authorization)
- Handles JSON parsing safely
- Detects HTML responses (API errors) and throws appropriate errors
