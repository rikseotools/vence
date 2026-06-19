// scripts/google-ads/drain-conversions.ts
//
// Escape-hatch manual para drenar conversion_outbox y subir a Google Ads desde
// un entorno con egress sano (cuando el de producción no llega a
// oauth2.googleapis.com — incidente 19/06 "Premature close").
//
//   npm run ads:drain-conversions          → REAL (sube + marca delivered)
//   DRY_RUN=true npm run ads:drain-conversions  → validate-only (no escribe)
//
// Reutiliza la MISMA lógica que el cron de prod (drainConversionOutbox):
// idempotente por order_id en el lado de Google.
import { drainConversionOutbox } from '@/lib/conversions/worker'

;(async () => {
  const dryRun = process.env.DRY_RUN === 'true'
  console.log(`▶ Drenando conversion_outbox (dryRun=${dryRun})…`)
  const summary = await drainConversionOutbox({ dryRun, limit: 100 })
  console.log('✅ Resumen:', JSON.stringify(summary, null, 2))
  process.exit(0)
})().catch((e) => {
  console.error('❌ Error:', e instanceof Error ? e.message : e)
  process.exit(1)
})
