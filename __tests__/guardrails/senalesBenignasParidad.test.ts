// __tests__/guardrails/senalesBenignasParidad.test.ts
//
// GUARDARRAÍL: la lista de señales benignas es UNA sola, en tres consumidores.
//
// POR QUÉ (auditoría 29/07/2026): la misma lista estaba escrita a mano en el endpoint
// del panel, en el comando CLI del runbook y —implícitamente— en la cabeza de quien
// triaba. El catch-all prometía "sin gaps por diseño", pero cada copia envejecía por su
// cuenta: 13 tipos de evento GRAVES llevaban un mes emitiéndose sin que nadie los
// mirara (991 `server_render_error`, 277 `pre_hydration_error`, 24 `cron_error`…).
//
// Ahora la fuente es `lib/observability/benignSignals.ts` y este test falla si:
//   · la copia del backend (que alimenta la alerta catch-all por email) diverge, o
//   · el comando del runbook §1.ter deja de listar lo mismo, o
//   · alguien añade un benigno sin justificarlo con un comentario.
import { readFileSync } from 'fs'
import { join } from 'path'
import { BENIGN_SIGNALS, CON_REGLA_PROPIA, esSenalBenigna, tieneReglaPropia } from '@/lib/observability/benignSignals'

const raiz = process.cwd()
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

/** Extrae los literales entre comillas simples de un bloque de array. */
function literalesDeArray(src: string, marcador: string): string[] {
  const i = src.indexOf(marcador)
  if (i < 0) throw new Error(`No encuentro "${marcador}"`)
  // Ojo: `readonly string[] = [` tiene un `[` antes del array de verdad.
  const abre = src.indexOf('[', src.indexOf('=', i))
  const cierra = src.indexOf(']', abre)
  return [...src.slice(abre, cierra).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])
}

describe('paridad de la lista de señales benignas', () => {
  it('la COPIA del backend es idéntica (alimenta la alerta por email)', () => {
    const back = literalesDeArray(
      leer('backend/src/alerts/benign-signals.ts'),
      'export const BENIGN_SIGNALS',
    )
    // Orden incluido: es una lista curada, no un set improvisado.
    expect(back).toEqual([...BENIGN_SIGNALS])
  })

  it('el comando CLI del runbook §1.ter lista lo mismo', () => {
    const runbook = leer('docs/runbooks/health-check.md')
    const enRunbook = literalesDeArray(runbook, "const BENIGN = new Set(")
    expect([...enRunbook].sort()).toEqual([...BENIGN_SIGNALS].sort())
  })

  it('el endpoint del panel NO reintroduce una lista propia', () => {
    const src = leer('app/api/admin/system-health/route.ts')
    expect(src).toContain('esSenalBenigna')
    expect(src).not.toMatch(/const BENIGN_SIGNALS\s*=\s*new Set/)
  })

  it('la regla catch-all del backend consume la lista (nada de literales sueltos)', () => {
    const reglas = leer('backend/src/alerts/alert-rules.ts')
    expect(reglas).toMatch(/import \{[^}]*BENIGN_SIGNALS[^}]*\} from '\.\/benign-signals'/)
    expect(reglas).toContain('senal_error_sin_vigilancia')
    // La regla debe estar REGISTRADA: definirla sin meterla en ALERT_RULES no manda nada.
    expect(reglas).toMatch(/RULE_SENAL_ERROR_SIN_VIGILANCIA as AlertRule,/)
  })

  it('la lista CON_REGLA_PROPIA es idéntica en la copia del backend', () => {
    const back = literalesDeArray(
      leer('backend/src/alerts/benign-signals.ts'),
      'export const CON_REGLA_PROPIA',
    )
    expect(back).toEqual([...CON_REGLA_PROPIA])
  })

  it('cada señal marcada "con regla propia" TIENE de verdad una regla', () => {
    // Sin esto, sacar una regla del catálogo dejaría su event_type excluido del
    // catch-all y sin nadie mirándolo: un hueco silencioso, justo lo que se cierra.
    const reglas = leer('backend/src/alerts/alert-rules.ts')
    const conRegla = new Set<string>()
    for (const m of reglas.matchAll(/event_type\s*(?:=|IN)\s*\(?\s*((?:'[a-z0-9_]+'\s*,?\s*)+)\)?/gi)) {
      for (const t of m[1].matchAll(/'([a-z0-9_]+)'/g)) conRegla.add(t[1])
    }
    const huerfanas = CON_REGLA_PROPIA.filter((t) => !conRegla.has(t))
    expect(huerfanas).toEqual([])
  })

  it('nada está a la vez en benignos y con regla propia', () => {
    expect(CON_REGLA_PROPIA.filter((t) => BENIGN_SIGNALS.includes(t))).toEqual([])
  })

  it('los tipos graves conocidos NO están silenciados como benignos', () => {
    // Los 13 que la auditoría encontró sin vigilancia: si alguien los declara benignos
    // para bajar el ruido, este test lo para — se arregla la causa, no se calla.
    for (const t of [
      'server_render_error', 'pre_hydration_error', 'cron_error',
      'cron_http_trigger_failed', 'question_image_error', 'law_completeness_regression',
      'estado_proceso_drift', 'e2e_smoke_failed', 'unhandled_error',
      'react_error_boundary', 'http_5xx', 'chunk_load_error', 'dispute_submit_failed',
    ]) {
      expect(esSenalBenigna(t)).toBe(false)
    }
  })

  it('los 8 tipos que la auditoría encontró SIN vigilancia siguen entrando en el catch-all', () => {
    // Ni benignos ni con regla propia → los ve la alerta catch-all. Si alguien los
    // mete en cualquiera de las dos listas sin escribirles regla, vuelven a ser
    // invisibles y este test lo para.
    for (const t of [
      'server_render_error', 'pre_hydration_error', 'cron_error',
      'cron_http_trigger_failed', 'question_image_error', 'law_completeness_regression',
      'estado_proceso_drift', 'e2e_smoke_failed',
    ]) {
      expect(esSenalBenigna(t)).toBe(false)
      expect(tieneReglaPropia(t)).toBe(false)
    }
  })

  it('cada benigno lleva su porqué escrito al lado (no se silencia a ciegas)', () => {
    const src = leer('lib/observability/benignSignals.ts')
    const bloque = src.slice(src.indexOf('export const BENIGN_SIGNALS'), src.indexOf('] as const'))
    const lineas = bloque.split('\n').filter((l) => /'[a-z0-9_]+',/.test(l))
    const sinComentario = lineas.filter((l) => !l.includes('//'))
    // Se permite continuar la explicación del de arriba (pares del mismo grupo).
    expect(sinComentario.length).toBeLessThanOrEqual(2)
  })
})
