FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
RUN bunx apibara build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies and built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/.apibara ./.apibara
COPY package.json apibara.config.ts drizzle.config.ts ./
COPY src/schema ./src/schema
COPY src/lib ./src/lib
COPY src/indexers ./src/indexers
COPY start.sh ./
RUN chmod +x start.sh

# Create non-root user
RUN addgroup --system --gid 1001 indexer && \
    adduser --system --uid 1001 indexer
USER indexer

# Default command - runs all indexers
CMD ["./start.sh"]
