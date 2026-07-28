// Unit + integración ligera de la taxonomía «por qué se acuñó un token» (T-210).
//
// Este dato existe porque, tras arreglar el desperdicio y desplegar, salió −39% en vez del
// −96,6% previsto y **no se pudo explicar el resto**: solo se sabía cuántas acuñaciones había,
// no por qué. La conjetura mejor fundada la refutaron los datos. Estos tests fijan que el dato
// se derive bien, que no se pueda ensuciar desde el navegador, y —lo más frágil— que cliente y
// servidor sigan hablando de la MISMA lista.

import { readFileSync } from 'fs'
import { join } from 'path'
import {
  deriveMintReason,
  sanitizeMintReason,
  MINT_REASONS,
  MINT_REASON_HEADER,
} from '@/lib/auth/mintReason'

describe('deriveMintReason — el motivo sale del estado que provocó la acuñación', () => {
  it('primera vez en este contexto JS → carga_inicial (el SUELO real del sistema)', () => {
    // La caché vive en memoria: cada carga de página y cada pestaña nacen sin ella. Este es
    // el motivo que hizo inalcanzable la predicción del −96,6%, derivada del TTL de 1 h.
    expect(deriveMintReason({ hayCache: false, acuñoAntes: false })).toBe('carga_inicial')
  })

  it('había token cacheado y aun así toca renovar → expirado (el motivo SANO)', () => {
    expect(deriveMintReason({ hayCache: true, acuñoAntes: true })).toBe('expirado')
  })

  it('sin caché pero ya había acuñado antes → cache_miss (algo la invalidó)', () => {
    expect(deriveMintReason({ hayCache: false, acuñoAntes: true })).toBe('cache_miss')
  })

  it('el caller exigió red → forzado, por encima de todo lo demás', () => {
    expect(deriveMintReason({ forzado: true, hayCache: true, acuñoAntes: true })).toBe('forzado')
    expect(deriveMintReason({ forzado: true, hayCache: false, acuñoAntes: false })).toBe('forzado')
  })

  // La distinción que da valor al campo: si `acuñoAntes` se reseteara con la caché, los dos
  // problemas (suelo del sistema vs caché que alguien tira) se contarían igual y el dato no
  // serviría para decidir nada.
  it('carga_inicial y cache_miss NO se confunden: es la decisión que el dato debe soportar', () => {
    expect(deriveMintReason({ hayCache: false, acuñoAntes: false })).toBe('carga_inicial')
    expect(deriveMintReason({ hayCache: false, acuñoAntes: true })).toBe('cache_miss')
  })

  it('sin datos (objeto vacío) → carga_inicial, que es lo que es un contexto recién nacido', () => {
    expect(deriveMintReason({})).toBe('carga_inicial')
  })

  it('todo lo que devuelve está en la taxonomía cerrada', () => {
    const combinaciones = [true, false].flatMap((f) =>
      [true, false].flatMap((c) => [true, false].map((a) => ({ forzado: f, hayCache: c, acuñoAntes: a }))),
    )
    for (const c of combinaciones) {
      expect(MINT_REASONS).toContain(deriveMintReason(c))
    }
  })
})

describe('sanitizeMintReason — nada del navegador entra crudo en la telemetría', () => {
  it('acepta los motivos válidos', () => {
    for (const r of MINT_REASONS) expect(sanitizeMintReason(r)).toBe(r)
  })

  it('normaliza espacios y mayúsculas (proxies y clientes hacen cosas raras)', () => {
    expect(sanitizeMintReason('  CARGA_INICIAL ')).toBe('carga_inicial')
  })

  it('un motivo inventado NO pasa: caería como cardinalidad basura en observable_events', () => {
    expect(sanitizeMintReason('lo_que_me_invente')).toBe('desconocido')
    expect(sanitizeMintReason('carga_inicial; DROP TABLE')).toBe('desconocido')
    expect(sanitizeMintReason('x'.repeat(5000))).toBe('desconocido')
  })

  it('sin cabecera (cliente viejo tras un deploy) → desconocido, no se pierde el evento', () => {
    expect(sanitizeMintReason(null)).toBe('desconocido')
    expect(sanitizeMintReason(undefined)).toBe('desconocido')
    expect(sanitizeMintReason(42)).toBe('desconocido')
    expect(sanitizeMintReason({})).toBe('desconocido')
  })
})

describe('cliente y servidor hablan de la MISMA lista (si se separan, las consultas mienten)', () => {
  const ROOT = join(__dirname, '..', '..', '..')
  const adapter = readFileSync(join(ROOT, 'lib/auth/adapters/authjsAdapter.ts'), 'utf8')
  const route = readFileSync(join(ROOT, 'app/api/auth/token/route.ts'), 'utf8')

  it('el cliente importa la taxonomía compartida y manda la cabecera', () => {
    expect(adapter).toMatch(/from '\.\.\/mintReason'/)
    expect(adapter).toMatch(/headers\[MINT_REASON_HEADER\]\s*=\s*reason/)
  })

  it('el cliente DERIVA el motivo (no manda una constante pegada)', () => {
    expect(adapter).toMatch(/deriveMintReason\(\{/)
  })

  it('el servidor lo SANEA antes de escribirlo (no confía en el navegador)', () => {
    expect(route).toMatch(/sanitizeMintReason\(request\.headers\.get\(MINT_REASON_HEADER\)\)/)
  })

  it('el servidor lo escribe en el evento que luego se consulta', () => {
    expect(route).toMatch(/metadata:\s*\{\s*via,\s*reason,/)
  })

  it('ninguno de los dos redefine la lista por su cuenta', () => {
    for (const src of [adapter, route]) {
      expect(src).not.toMatch(/MINT_REASONS\s*=/)
    }
  })

  it('la cabecera tiene un nombre estable (cambiarla a ciegas ciega la métrica)', () => {
    expect(MINT_REASON_HEADER).toBe('X-Mint-Reason')
  })
})
