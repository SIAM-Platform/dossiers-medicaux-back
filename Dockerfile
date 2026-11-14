# ── Stage 1 : Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
 
WORKDIR /app
 
COPY package*.json ./
# Forcer development pour installer les devDeps (nest CLI requis pour le build)
RUN NODE_ENV=development npm ci --legacy-peer-deps
 
COPY . .
RUN npm run build
 
# ── Stage 2 : Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production
 
WORKDIR /app
 
ENV NODE_ENV=production
 
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
 
COPY --from=builder /app/dist ./dist
 
EXPOSE 3000
# Même sonde que le socle : base joignable et migrations appliquées.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health/ready > /dev/null || exit 1
 
CMD ["node", "dist/main"]