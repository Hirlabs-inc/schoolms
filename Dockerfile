# ---- Build stage ----
FROM node:20-alpine AS builder
ARG JWT_SECRET
ARG DATABASE_URL
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10 && pnpm install --ignore-scripts
COPY . .
ENV JWT_SECRET=${JWT_SECRET:-trainify-jwt-secret-2026}
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN pnpm build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/components ./components
COPY --from=builder /app/contexts ./contexts
COPY --from=builder /app/app ./app
COPY --from=builder /app/styles ./styles

EXPOSE 3000
CMD ["npx", "next", "start"]
