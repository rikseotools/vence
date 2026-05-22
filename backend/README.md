# Vence — Backend

Servicio backend de **proceso largo** de Vence (NestJS), separado del frontend Next.js.

Decisión y plan completo: [`../docs/ARCHITECTURE_ROADMAP.md`](../docs/ARCHITECTURE_ROADMAP.md) → sección «Backend dedicado de proceso largo».

## Etapa actual: 1 — Crons / workers

El backend arranca haciendo **solo los crons** que hoy fallan como funciones serverless de Vercel (empezando por `check-boe-changes`, que con el `maxDuration` de Vercel no termina de revisar las 475 leyes). Aquí corren hasta el final, con scheduler in-app (`@nestjs/schedule`). Todavía NO es la API — eso es la Etapa 2.

## Principios

- **Monolito modular** (no microservicios).
- **Agnóstico al proveedor**: contenedor Docker 12-factor, Postgres estándar vía Drizzle, config 100% por variables de entorno. La misma imagen corre en AWS Fargate, Fly, Railway o una VM.
- **Sin deuda técnica**: cada cron migrado se entrega con tests, observabilidad y **se borra el cron viejo de Vercel** (no conviven).

## Desarrollo local

```bash
cp .env.example .env      # rellenar DATABASE_URL (BD de Supabase)
npm install
npm run start:dev
```

`GET http://localhost:3000/health` → liveness.

## Estructura

```
src/
  main.ts          arranque (shutdown hooks para el SIGTERM de Fargate)
  app.module.ts    módulo raíz
  config/          validación estricta del entorno (zod, fail-fast)
  health/          endpoint /health
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | desarrollo con watch |
| `npm run build` | compila a `dist/` |
| `npm run start:prod` | ejecuta `dist/main` (lo que corre en el contenedor) |
| `npm test` | tests unitarios |
| `npm run lint` | eslint |
