// app/api/security/captcha/status/route.ts
//
// Introspección del estado EFECTIVO de la capa de captcha en el runtime real.
// Sirve para que el canary post-deploy confirme que el gate anti-scraping está
// ENCENDIDO — no basta con "cargar va bien" (un gate apagado parece idéntico al
// funcionando desde el camino feliz). Bug 03/06: site key no horneada → gate OFF
// sin que nada avisara.
//
// Devuelve SOLO booleans (presencia), nunca los valores de las claves.
// Protegido por CRON_SECRET (mismo patrón que el resto de sondas).

import { NextRequest, NextResponse } from 'next/server'
import { getCaptchaConfig } from '@/lib/security/captcha'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = getCaptchaConfig()
  return NextResponse.json({
    enabled: cfg.enabled, // el gate dispara SOLO si esto es true
    provider: cfg.provider,
    flagOn: process.env.CAPTCHA_ENABLED === 'true' || process.env.CAPTCHA_ENABLED === '1',
    siteKeyPresent: Boolean(cfg.siteKey), // build-arg horneado (la causa del bug 03/06)
    secretPresent: Boolean(cfg.secretKey), // SSM runtime
    failOpen: cfg.failOpen,
  })
}

export const GET = withErrorLogging('/api/security/captcha/status', _GET)
