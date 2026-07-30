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
import { evaluateLoadGate, gateSubjects } from '@/lib/security/challengePolicy/questionsServed'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = getCaptchaConfig()

  // ── Veredicto del gate para un SUJETO, sin servir preguntas (T-280, 30/07/2026) ──
  //
  // Existe para que el canary del gate pueda comprobar de verdad lo que dice comprobar. Hasta hoy
  // mandaba la cabecera de exención en la misma petición con la que verificaba que «a un usuario
  // normal no se le reta»: estaba exento cuando lo medía, así que esa aserción pasaba siempre
  // —incluso si el gate empezara a retar a todo el mundo, que es el fallo que más duele—.
  //
  // La razón por la que se le eximió en su día es real y está medida: el usuario smoke acumula
  // volumen de otras sondas (2.220 servidas el 27/07, 380 el 29/07, contra un umbral de 500), así
  // que quitarle la exención a secas produciría rojos falsos los días cargados. Con esto el canary
  // pregunta ANTES: si su propio contador está por debajo del umbral, hace la petición SIN exención
  // y la aserción es real; si está saturado, lo dice («no comprobable hoy») en vez de fingir verde.
  //
  // Solo lo ve quien trae `CRON_SECRET` (la comprobación de arriba), y devuelve el contador de un
  // sujeto que el llamante ya conoce.
  const sujeto = request.nextUrl.searchParams.get('subject')
  let gate: { subject: string; served: number; threshold: number; wouldChallenge: boolean } | undefined
  if (sujeto) {
    const evaluacion = await evaluateLoadGate(gateSubjects(sujeto, null, null))
    const detalle = evaluacion.details[0]
    gate = {
      subject: sujeto,
      served: detalle?.served ?? 0,
      threshold: detalle?.threshold ?? 0,
      wouldChallenge: evaluacion.challenge,
    }
  }

  return NextResponse.json({
    enabled: cfg.enabled, // el gate dispara SOLO si esto es true
    provider: cfg.provider,
    flagOn: process.env.CAPTCHA_ENABLED === 'true' || process.env.CAPTCHA_ENABLED === '1',
    siteKeyPresent: Boolean(cfg.siteKey), // build-arg horneado (la causa del bug 03/06)
    secretPresent: Boolean(cfg.secretKey), // SSM runtime
    failOpen: cfg.failOpen,
    ...(gate ? { gate } : {}),
  })
}

export const GET = withErrorLogging('/api/security/captcha/status', _GET)
