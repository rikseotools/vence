#!/usr/bin/env npx tsx
/**
 * scripts/security/levantar-reto-forzado.ts — quita la marca de "retar siempre" (el captcha
 * inmediato por señal de bot) de un usuario y/o su dispositivo.
 *
 * ── POR QUÉ EXISTE (07/08/2026) ──────────────────────────────────────────────────────────────
 * La marca la pone sola `/api/fraud/report` con TTL de 24 h y **nadie podía quitarla**. El día
 * que el antifraude marcó a nuestro propio canario (T-651), la única respuesta disponible era
 * «espera 21 horas» con el canario en rojo. Y lo caro no es el canario: ese mismo día seis
 * usuarias PREMIUM recibieron el captcha — si una está mal marcada, «espera un día» es lo que le
 * decíamos a alguien que paga.
 *
 * NO se puede hacer desde el portátil a pelo: la marca vive en ElastiCache, dentro de la VPC.
 * Por eso esto solo llama al endpoint admin, que corre dentro. Mismo patrón que la invalidación
 * de caché (memoria `reference-invalidar-cache-prod-elasticache`).
 *
 * SIMULA por defecto. Uso:
 *   npx tsx --env-file=.env.local scripts/security/levantar-reto-forzado.ts --usuario <uuid> --motivo "…"
 *   … --dispositivo <id> --motivo "…" --aplicar
 *
 * Necesita `AUTH_SECRET` (no está en .env.local; el script imprime cómo sacarlo de SSM).
 */
import { identidadDeAdmin } from '../impugnaciones/lib/admin-token'
// El criterio (motivo obligatorio, qué sujetos toca) es el MISMO que aplica el endpoint: núcleo
// compartido, para que endurecer uno no deje al otro pasando lo que el otro rechaza.
import { planearLevantado } from '../../lib/security/challengePolicy/levantarMarcaCore.cjs'

function valor(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
  const userId = valor('--usuario')
  const deviceId = valor('--dispositivo')
  const motivo = valor('--motivo')
  const aplicar = process.argv.includes('--aplicar')

  const plan = planearLevantado({ userId, deviceId, motivo })
  if (!plan.valido) {
    console.error(`❌ ${plan.error}`)
    console.error('   uso: --usuario <uuid> | --dispositivo <id> (o ambos) --motivo "…" [--aplicar]')
    process.exit(2)
  }

  console.log('Se levantará la marca de reto forzado de:')
  for (const s of plan.sujetos) console.log(`   · ${s}`)
  console.log(`Motivo: ${motivo}`)

  if (!aplicar) {
    console.log('\n(simulación — repite con --aplicar)')
    return
  }

  if (!process.env.AUTH_SECRET) {
    console.error('\n❌ Falta AUTH_SECRET. Sácalo de SSM y reintenta:')
    console.error('   AUTH_SECRET="$(aws --profile vence --region eu-west-2 ssm get-parameter \\')
    console.error('     --name /vence-frontend/AUTH_SECRET --with-decryption --query Parameter.Value --output text)" \\')
    console.error('     npx tsx --env-file=.env.local scripts/security/levantar-reto-forzado.ts …')
    process.exit(3)
  }

  const { token } = await identidadDeAdmin()
  const res = await fetch('https://www.vence.es/api/admin/anti-scraping/levantar-marca', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      userId: userId || undefined,
      deviceId: deviceId || undefined,
      motivo,
    }),
  })
  const json: any = await res.json().catch(() => ({}))
  console.log(`\nHTTP ${res.status}: ${JSON.stringify(json, null, 2)}`)
  if (!res.ok || json?.success !== true) process.exit(1)
  console.log('\n✅ marca levantada — el siguiente intento de ese sujeto ya no recibe captcha por bot_flag.')
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
