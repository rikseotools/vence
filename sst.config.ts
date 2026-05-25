// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST config — Vence frontend (Bloque 5 Fase E).
 *
 * Despliega Next.js a Lambda + CloudFront vía OpenNext.
 *
 * Stages:
 *   - preview     → preview-aws.vence.es (canary, sin tráfico real).
 *   - production  → www.vence.es (cutover real en E.5-SST).
 *
 * Cuenta AWS: 349744179687 (vence), región eu-west-2.
 *
 * Lanzar deploys con:
 *   AWS_PROFILE=vence npx sst deploy --stage preview
 *   AWS_PROFILE=vence npx sst deploy --stage production
 */
export default $config({
  app(input) {
    return {
      name: "vence",
      // production: retain → no se borran recursos al destroy. preview: borra.
      removal: input?.stage === "production" ? "retain" : "remove",
      // production protegido contra `sst remove` accidental.
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-2",
          profile: "vence",
        },
      },
    };
  },
  async run() {
    const isProduction = $app.stage === "production";

    // Variables NEXT_PUBLIC_* se inlinean en el bundle del cliente durante el
    // build. Las leemos del entorno donde corra `sst deploy` (típicamente
    // GitHub Actions con repo secrets).
    const env: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID:
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: isProduction
        ? "https://www.vence.es"
        : "https://preview-aws.vence.es",
      NEXT_PUBLIC_APP_NAME: "Vence",
      NEXT_PUBLIC_SUPPORT_EMAIL: "info@vence.es",
      NEXT_PUBLIC_USE_CHAT_V2: "true",
    };

    // Variables runtime-only (no inlineadas en el bundle del cliente):
    // server-side las lee process.env desde la Lambda. SST encripta y
    // las pasa como env vars al runtime de la function.
    const serverEnv: Record<string, string> = {
      ...env,
      // Auth/secrets server-side. Tomadas del entorno donde corra sst deploy.
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DATABASE_URL_REPLICA: process.env.DATABASE_URL_REPLICA ?? "",
      // Storage adapter agnóstico (Bloque 5 Fase A) — apunta a S3.
      STORAGE_PROVIDER: "s3",
      AWS_S3_BUCKET: "vence-uploads",
      AWS_S3_REGION: "eu-west-2",
      // S3 IAM: la Lambda usa role propio que daremos en E.2 — no AKID.
      // Resto de secrets (Stripe, Resend, Anthropic, etc.) los añadiremos
      // según los necesite cada endpoint en sus pruebas.
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
      EMAIL_FROM_ADDRESS: "info@vence.es",
      EMAIL_FROM_NAME: "Vence.es",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      CRON_SECRET: process.env.CRON_SECRET ?? "",
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
      OBSERVABILITY_INGEST_SECRET:
        process.env.OBSERVABILITY_INGEST_SECRET ?? "",
      SUPABASE_WEBHOOK_SECRET: process.env.SUPABASE_WEBHOOK_SECRET ?? "",
      ARMANDO_PASSWORD_SHA256: process.env.ARMANDO_PASSWORD_SHA256 ?? "",
      ARMANDO_SESSION_SECRET: process.env.ARMANDO_SESSION_SECRET ?? "",
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "",
      VAPID_EMAIL: "info@vence.es",
      META_PIXEL_ID: process.env.META_PIXEL_ID ?? "",
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ?? "",
      TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ?? "",
      TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH ?? "",
      TELEGRAM_SESSION_SECRET: process.env.TELEGRAM_SESSION_SECRET ?? "",
      RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET ?? "",
      EMAIL_CRON_SECRET: process.env.EMAIL_CRON_SECRET ?? "",
      // PAUSAS y flags
      PAUSE_MOTIVATIONAL_EMAILS:
        process.env.PAUSE_MOTIVATIONAL_EMAILS ?? "true",
    };

    new sst.aws.Nextjs("VenceFrontend", {
      // Custom domain solo cuando lo activemos en E.3/E.5.
      // Antes de mapearlo: ACM cert en CloudFront, validación DNS.
      // domain: isProduction
      //   ? { name: "www.vence.es", redirects: ["vence.es"] }
      //   : { name: "preview-aws.vence.es" },
      environment: serverEnv,
      // Warming: mantiene N Lambdas pre-calentadas para eliminar cold starts
      // en horas valle. Recomendado por foros SST para apps con tráfico
      // bursty (Vence: picos pre-examen 1.000+ usuarios concurrentes).
      // EventBridge schedule cada 5 min ping a /api/ping para mantener vivos.
      // Coste estimado: ~$2-3/mes para warm:20.
      // Solo en production — preview NO warmea (ahorra coste durante soak).
      warm: isProduction ? 20 : 0,
      // OpenNext config: el preset default detecta Next.js standalone build.
      // Si en E.3 tras smoke necesitamos ajustes (Node version, custom
      // server build cmd) se añaden aquí via `openNextVersion` o `buildCommand`.
    });
  },
});
