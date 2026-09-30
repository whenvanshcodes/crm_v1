# Production Deployment & Hosting Guide

This guide details how to build, containerize, host, and maintain the **Parlour Management CRM** in production environments.

---

## 1. Production Build & Launch

### Build Steps
```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Push / Sync Prisma Schema
pnpm db:push

# 3. Seed Starter Business (if first time deployment)
pnpm db:seed

# 4. Compile optimized production build
pnpm build

# 5. Launch Node.js production server
pnpm start -p 3000
```

---

## 2. Environment Variables

Create `.env.production` on the production server:

```env
DATABASE_URL="file:./data/parlour.db"
APP_ENV="production"
PORT=3000
NEXTAUTH_SECRET="generate_a_random_32_character_secret_here"
```

---

## 3. Docker Containerization

### `Dockerfile`
```dockerfile
# Multi-stage production build
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate
RUN pnpm build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  parlour-crm:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/parlour.db
      - APP_ENV=production
      - PORT=3000
    volumes:
      - parlour-data:/app/data

volumes:
  parlour-data:
```

---

## 4. Reverse Proxy Setup (Nginx)

Place Nginx in front of Next.js to terminate SSL and handle static caching:

```nginx
server {
    listen 80;
    server_name crm.yourparlour.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.yourparlour.com;

    ssl_certificate /etc/letsencrypt/live/crm.yourparlour.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourparlour.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. SQLite Backup Strategy in Production

When using SQLite in production:

1. **Daily Automated Snapshots**:
   ```bash
   # Use SQLite VACUUM INTO for consistent, zero-downtime backups
   sqlite3 /app/data/parlour.db "VACUUM INTO '/backups/parlour_$(date +%Y%m%d_%H%M%S).db';"
   ```
2. **Litestream Replication**:
   - Stream SQLite WAL frames in real-time to AWS S3, Cloudflare R2, or MinIO for Point-In-Time Recovery (PITR).
