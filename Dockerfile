# Bloque 5 Fase E.1 — Dockerfile multi-stage para Next.js 16 standalone.
#
# Estructura:
#   1) deps    — instala node_modules (cacheable mientras package.json no cambie)
#   2) builder — construye Next.js (.next/standalone)
#   3) runner  — imagen final mínima (server.js + .next/static + public)
#
# La imagen final pesa ~180-250MB (vs ~1.5GB sin standalone). No incluye
# devDependencies ni datasets de scraping (filtrados por .dockerignore).
#
# Pensado para AWS ECS Fargate. Levanta el server.js de Next.js standalone
# escuchando en :3000.

# ============================================================
# Stage 1: deps — instalación de dependencias
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Alpine necesita libc6-compat para algunos binarios npm (sharp, etc.)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# ============================================================
# Stage 2: builder — build Next.js (.next/standalone)
# ============================================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js detecta NEXT_TELEMETRY_DISABLED para no enviar telemetría al build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build args que el cliente Next.js incrusta en el bundle (NEXT_PUBLIC_*).
# Los pasa la CI/CD a `docker build --build-arg ...` o usa el default vacío.
# Las variables no-NEXT_PUBLIC_* las recibe el runtime via ECS env vars.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_USE_CHAT_V2

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL}
ENV NEXT_PUBLIC_USE_CHAT_V2=${NEXT_PUBLIC_USE_CHAT_V2}

RUN npm run build

# ============================================================
# Stage 3: runner — imagen final
# ============================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario non-root por buena práctica (ECS Fargate no lo exige pero ayuda).
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# server.js + .next/standalone/node_modules trimmed
COPY --from=builder /app/public ./public

# Permitir que el server emita prerender output runtime (Next.js standalone
# escribe en /app/.next/cache/fetch-cache si SSG ISR está activo).
RUN mkdir -p .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js es el entry generado por output:'standalone'
CMD ["node", "server.js"]
