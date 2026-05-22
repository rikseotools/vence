# Vence backend — imagen de producción.
# Multi-stage: la imagen final NO lleva ni el código TS ni las devDependencies.
# Contenedor estándar 12-factor → corre igual en Fargate, Fly, Railway o una VM.

# ---- build ----
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Ejecutar como usuario sin privilegios (el usuario `node` viene en la imagen).
USER node
EXPOSE 3000

# Health check del contenedor (lo usa también ECS si no se sobreescribe).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
