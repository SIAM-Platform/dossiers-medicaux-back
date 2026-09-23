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
 
CMD ["node", "dist/main"]