// __tests__/laws/answerFallsInAnnulledFragmentGate.mirror.test.ts
//
// Espejo del gate SQL `public.answer_falls_in_annulled_fragment` (T-048, corregido en T-208
// por `supabase/migrations/20260806_answer_falls_in_annulled_fragment_direction_fix.sql`).
//
// plpgsql no corre en Jest, así que este fichero traduce la función carácter a carácter a JS
// (mismo patrón que el resto de la familia annulled-* usa para lib↔backend↔CLI) y comprueba
// DOS cosas: (1) que coincide con `analizarClave(...).banda === 'alta'`, que es el criterio
// del que dice depender — si un día divergen, este test lo dice; (2) el caso real que motivó
// el arreglo, con la lógica VIEJA y la NUEVA lado a lado, para que la dirección de la
// comparación no pueda volver a invertirse sin que salte un rojo.
import { analizarClave } from '@/lib/laws/claveConIncisoAnulado'

/** Traducción literal de la función SQL VIEJA (antes de T-208) — solo para el test de regresión. */
function answerFallsInAnnulledFragmentOld(answer: string, fragments: string[]): boolean {
  const vAns = answer.toLowerCase().replace(/\s+/g, ' ').trim()
  if (vAns.length < 60) return false
  const prefix60 = vAns.slice(0, 60)
  for (const f of fragments) {
    const vNorm = f.toLowerCase().replace(/\s+/g, ' ').trim()
    if (vNorm && vNorm.includes(prefix60)) return true
  }
  return false
}

/** Traducción literal de la función SQL NUEVA (T-208, `20260806_..._direction_fix.sql`). */
function answerFallsInAnnulledFragmentNew(answer: string, fragments: string[]): boolean {
  const vAns = answer.toLowerCase().replace(/\s+/g, ' ').trim()
  if (vAns.length === 0) return false
  const RE_MARCADOR = /^\s*\(\s*(?:anulad|derogad)[oa]s?\s*\)\.?\s*$/i
  const RE_RUBRICA = /^\s*art(?:í|i)culo?\.?\s+\d/i
  for (const frag of fragments) {
    if (RE_MARCADOR.test(frag)) continue
    if (RE_RUBRICA.test(frag)) continue
    const vNorm = frag.toLowerCase().replace(/\s+/g, ' ').trim()
    if (vNorm.length >= 30 && vAns.includes(vNorm)) return true
  }
  return false
}

const CASO_REAL = {
  // df73ec53, LO 4/2000 art. 58 — verificado contra RDS (VENCE_LECTOR_URL) el 06/08/2026.
  claveExpulsion:
    'Llevará consigo la prohibición de entrada en territorio español hasta cinco años o hasta diez en circunstancias excepcionales.',
  fragmentoDevolucion:
    'Asimismo, toda devolución acordada en aplicación del párrafo b) del mismo apartado de este artículo llevará consigo la prohibición de entrada en territorio español por un plazo máximo de tres años.',
}

describe('answer_falls_in_annulled_fragment — regresión df73ec53 (T-208)', () => {
  it('la lógica VIEJA reproduce el falso positivo (confirma el diagnóstico, no solo lo afirma)', () => {
    expect(
      answerFallsInAnnulledFragmentOld(CASO_REAL.claveExpulsion, [CASO_REAL.fragmentoDevolucion]),
    ).toBe(true)
  })

  it('la lógica NUEVA lo corrige', () => {
    expect(
      answerFallsInAnnulledFragmentNew(CASO_REAL.claveExpulsion, [CASO_REAL.fragmentoDevolucion]),
    ).toBe(false)
  })

  it('y un caso que SÍ debe seguir bloqueando sigue bloqueando (la respuesta reproduce el inciso completo)', () => {
    const fragmentoLbrl =
      'El Alcalde podrá nombrar como miembros de la Junta de Gobierno Local a personas que no ostenten la condición de concejales, siempre que su número no supere un tercio de sus miembros, excluido el Alcalde.'
    const claveQueLoReproduce = `Según el art. 126.2 LBRL: ${fragmentoLbrl}`
    expect(answerFallsInAnnulledFragmentNew(claveQueLoReproduce, [fragmentoLbrl])).toBe(true)
  })
})

describe('answer_falls_in_annulled_fragment (nueva) — paridad con analizarClave, banda "alta"', () => {
  const CASOS: Array<[string, string, string[]]> = [
    ['reproduce el inciso largo', 'Los municipios remitirán al Ministerio de Hacienda y Administraciones Públicas el coste efectivo de los servicios.', ['al Ministerio de Hacienda y Administraciones Públicas']],
    ['no lo reproduce', 'Los municipios prestarán los servicios mínimos previstos en la ley.', ['al Ministerio de Hacienda y Administraciones Públicas']],
    ['marcador del BOE, nunca hallazgo', 'El acto anulado no produce efectos. (Anulado)', ['(Anulado)']],
    ['fragmento corto (banda revisar en el núcleo, NO en el gate)', 'De un informe favorable del Ministerio Fiscal.', ['favorable']],
    ['el caso real que motivó el arreglo', CASO_REAL.claveExpulsion, [CASO_REAL.fragmentoDevolucion]],
  ]

  it.each(CASOS)('%s', (_caso, clave, fragmentos) => {
    const nucleo = analizarClave(clave, fragmentos)
    const esperado = nucleo.hallazgo && nucleo.banda === 'alta'
    expect(answerFallsInAnnulledFragmentNew(clave, fragmentos)).toBe(esperado)
  })
})
