/**
 * puertasQueCuentan.guardrail.test.ts — que la próxima puerta no nazca muda. (T-542)
 *
 * Dos capas distintas y no se deben confundir:
 *
 *  1. **Núcleo puro** — el clasificador, con casos escritos a mano (incluida la puerta original
 *     tal y como estaba el 04/08, para probar que la habría cazado).
 *  2. **Guardarraíl sobre el repo REAL** — recorre las puertas del cierre y falla si alguna
 *     bloquea sin contar; y lleva un TRINQUETE sobre las copias privadas del emisor, que hoy son
 *     deuda conocida y no deben crecer.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..')
const { clasificarPuertas, esPuerta, cuenta, soloCodigo } = req(path.join(ROOT, 'lib/calidad/puertasQueCuentan.cjs'))

const leer = (rel: string) => ({ ruta: rel, fuente: fs.readFileSync(path.join(ROOT, rel), 'utf8') })

// ── 1. NÚCLEO PURO ────────────────────────────────────────────────────────────────────────────

describe('clasificador de puertas (núcleo puro)', () => {
  // Reproducción fiel del bug: bloquea, y su única mención a contar es el TEXTO que imprime.
  const PUERTA_ORIGINAL_MUDA = `
    export function anunciarTemario(v, { aplicar }) {
      if (v.clase === 'escape') { console.log('🚪 puerta SALTADA con motivo declarado (queda contado)'); return true }
      console.log('\\n   🛑 PUERTA DE TEMARIO — no se puede cerrar todavía:')
      return false
    }`

  const PUERTA_QUE_CUENTA = `
    export function anunciar(v, { aplicar }) {
      if (v.clase === 'escape') { if (aplicar) emitirFriccion({ clase: 'guard_escape', guard: 'x' }); return true }
      console.log('⛔ NO LA TIENES RESERVADA')
      if (aplicar) emitirFriccion({ clase: 'guard_bloqueo', guard: 'x' })
      return false
    }`

  it('caza la puerta que bloquea y no cuenta — el bug del 04/08', () => {
    const { mudas } = clasificarPuertas([{ ruta: 'puerta.ts', fuente: PUERTA_ORIGINAL_MUDA }])
    expect(mudas).toEqual(['puerta.ts'])
  })

  it('un comentario que NOMBRA la fricción no vale como contarla', () => {
    const soloPresume = PUERTA_ORIGINAL_MUDA.replace(
      'export function',
      '// esta puerta cuenta su fricción con emitirFriccion() en el bus\nexport function',
    )
    // Es la trampa exacta del original: el texto afirmaba contar y el código no lo hacía.
    expect(cuenta(soloPresume)).toBe(false)
    expect(clasificarPuertas([{ ruta: 'p.ts', fuente: soloPresume }]).mudas).toEqual(['p.ts'])
  })

  it('da por buena la puerta que sí llama al emisor', () => {
    expect(clasificarPuertas([{ ruta: 'ok.ts', fuente: PUERTA_QUE_CUENTA }]).mudas).toEqual([])
  })

  it('no marca lo que NO es una puerta: anunciar sin poder negar', () => {
    const informativo = `export function avisar(v) { console.log('⚠️  aviso'); return true }`
    expect(esPuerta(informativo)).toBe(false)
    expect(clasificarPuertas([{ ruta: 'aviso.ts', fuente: informativo }]).mudas).toEqual([])
  })

  it('soloCodigo descarta comentarios de línea, de bloque y de jsdoc', () => {
    const s = soloCodigo('/* emitirFriccion( */\n// emitirFriccion(\n * emitirFriccion(\nconst x = 1')
    expect(s).not.toContain('emitirFriccion')
    expect(s).toContain('const x = 1')
  })
})

// ── 2. GUARDARRAÍL SOBRE EL REPO REAL ─────────────────────────────────────────────────────────

describe('las puertas del cierre cuentan su fricción (repo real)', () => {
  /** Las dos puertas que `cerrar.ts` / `cerrar-feedback.ts` atraviesan antes de escribir. */
  const PUERTAS = ['scripts/impugnaciones/lib/comprobar-reserva.ts', 'scripts/impugnaciones/lib/puerta-temario.ts']

  it('ninguna puerta bloquea en silencio', () => {
    const { mudas, puertas } = clasificarPuertas(PUERTAS.map(leer))

    // Sanity: si el detector deja de reconocerlas como puertas, este test se vuelve un verde
    // vacío — el modo de fallo que el propio proyecto llama «un badge a cero no es cobertura».
    expect(puertas.sort()).toEqual([...PUERTAS].sort())
    expect(mudas).toEqual([])
  })

  it('TRINQUETE: las copias privadas del emisor no crecen', () => {
    // Deuda MEDIDA el 04/08: SEIS módulos lanzan `friccion-emitir.cjs` por su cuenta —
    // backlog-push-guard, backlog, contexto-push-guard, check-indice-compartido, huerfanos y
    // latir. Casi todos viven en el camino de los hooks de git (cada commit, cada push) o del
    // latido, así que migrarlos se hace aparte y con su propia verificación: romper el pre-push
    // deja a todas las sesiones sin poder subir nada.
    // Lo que NO puede pasar es que aparezca la nº 7 — que es como nació el bug que esto arregla.
    const TECHO = 6
    const candidatos = [
      'scripts/backlog-push-guard.cjs',
      'scripts/backlog.cjs',
      'scripts/contexto-push-guard.cjs',
      'scripts/check-indice-compartido.cjs',
      'scripts/impugnaciones/lib/comprobar-reserva.ts',
      'scripts/impugnaciones/lib/puerta-temario.ts',
      'scripts/sessions/huerfanos.cjs',
      'scripts/sessions/latir.cjs',
    ].filter((r) => fs.existsSync(path.join(ROOT, r)))

    const { conCopiaPropia } = clasificarPuertas(candidatos.map(leer))

    expect(conCopiaPropia.length).toBeLessThanOrEqual(TECHO)
    // Y las dos puertas del cierre ya están migradas: no pueden reaparecer en la lista.
    expect(conCopiaPropia).not.toContain('scripts/impugnaciones/lib/puerta-temario.ts')
    expect(conCopiaPropia).not.toContain('scripts/impugnaciones/lib/comprobar-reserva.ts')
  })

  it('el emisor único existe y es el que importan las puertas', () => {
    expect(fs.existsSync(path.join(ROOT, 'lib/sessions/friccion.cjs'))).toBe(true)
    for (const p of PUERTAS) {
      expect(leer(p).fuente).toContain('lib/sessions/friccion.cjs')
    }
  })
})
