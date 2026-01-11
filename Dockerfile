# SafeGo Production Dockerfile
# Works with any Docker-based hosting (DigitalOcean, AWS ECS, Google Cloud Run, etc.)

FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production=false

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-slim AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/scripts ./scripts

# Environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536"
ENV PORT=5000
ENV DISABLE_OBSERVABILITY=true

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/healthz || exit 1

EXPOSE 5000

# Start with migration support
CMD ["npm", "run", "start:prod"]
