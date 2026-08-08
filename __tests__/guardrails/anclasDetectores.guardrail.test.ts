/**
 * [T-718] Las anclas de un detector, si existen, tienen que ser de verdad — y su número sin
 * anclas solo puede BAJAR.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * El 08/08/2026 tres mediciones plausibles estuvieron a punto de decidir cosas reales: un 36 %
 * de errores dado por «suelo sano» cuando era la avería (habría cerrado [T-692] en falso), un
 * «2 de 21» que eran 21 de 21, y un criterio que señaló la **Constitución** (4.606 preguntas
 * activas) como texto no literal. Ninguno lo cazó un test: los cazó que chirriaban al leerlos.
 * Y no es nuevo — el manual de impugnaciones ya documenta un `lower()` que fabricó 8 preguntas
 * rotas inexistentes y una regex mal escapada que convirtió 33 en 48.
 *
 * ── Qué comprueba, y qué NO ─────────────────────────────────────────────────
 * NO obliga a los 24 detectores existentes a declarar anclas de golpe: eso nace en rojo y un
 * guardarraíl que nace rojo se salta con `--skip` (misma lección que `landing_cifra_sin_respaldo`
 * y que el trinquete de [T-713] esta misma mañana). Lo que hace es:
 *   1. donde YA hay anclas declaradas, exigir que sean válidas — anclas decorativas son peores
 *      que ninguna, porque dan la sensación de calibración sin darla;
 *   2. un TRINQUETE sobre cuántos detectores no las declaran: puede bajar, nunca subir. Un
 *      detector nuevo nace con anclas o no entra.
 */
import fs from 'fs'
import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validarAnclas } = require('@/lib/calidad/anclas.cjs')

const RAIZ = process.cwd()
const DIR_DETECTORES = path.join(RAIZ, 'lib', 'health')

/** Módulos de detección: los de `lib/health`, que es su casa. */
function detectores(): string[] {
  if (!fs.existsSync(DIR_DETECTORES)) return []
  return fs
    .readdirSync(DIR_DETECTORES)
    .filter((f) => /\.(cjs|js|ts)$/.test(f) && !/\.d\.ts$/.test(f))
    .sort()
}

/** Un detector declara anclas si exporta `ANCLAS`. Convención única, para que se puedan validar. */
function anclasDe(fichero: string): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require(path.join(DIR_DETECTORES, fichero))
    return m && m.ANCLAS ? m.ANCLAS : null
  } catch {
    // Un módulo que no carga (TS con imports del framework) no se juzga aquí: lo cubren sus
    // propios tests. Decir «no tiene anclas» porque no se pudo abrir sería acusarlo en falso.
    return null
  }
}

/**
 * Cuántos detectores NO declaran anclas hoy. Eran 24 al nacer el mecanismo (08/08/2026) y
 * quedan **21** tras calibrar tres, elegidos porque su falso positivo está DOCUMENTADO:
 *   · `epigrafeTruncado` — el «:» en medio de la frase, que CLAUDE.md ya avisa que es legítimo;
 *   · `opcionesDuplicadas` — comparar en minúsculas, la «mejora» que ya fabricó 8 preguntas
 *     rotas inexistentes. Comprobado que el ancla tiene DIENTES: metiendo `lower()`, sus dos
 *     negativas pasan de 0 a 1 par y saltan;
 *   · `explicacionTruncada` — sus dos exclusiones (acabar en URL, cerrar con locución) son la
 *     diferencia entre 112 hallazgos y 8.938, casi todos correctos.
 * Los tres se ejercitan contra la BD real en `__tests__/integration/anclas*.integration.test.ts`.
 *
 * **Solo puede bajar**: al calibrar uno, se declara y se baja este número.
 */
const TECHO_SIN_ANCLAS = 21

describe('[T-718] anclas de los detectores', () => {
  it('hay detectores que mirar (si no, esto pasaría en verde sin comprobar nada)', () => {
    expect(detectores().length).toBeGreaterThan(5)
  })

  it('las anclas DECLARADAS son válidas (unas decorativas son peores que ninguna)', () => {
    const malas: string[] = []
    for (const f of detectores()) {
      const a = anclasDe(f)
      if (!a) continue
      const motivo = validarAnclas(a)
      if (motivo) malas.push(`${f}: ${motivo}`)
    }
    expect(malas).toEqual([])
  })

  it(`los detectores sin anclas no crecen (techo ${TECHO_SIN_ANCLAS}, solo puede bajar)`, () => {
    const sin = detectores().filter((f) => !anclasDe(f))
    expect(sin.length).toBeLessThanOrEqual(TECHO_SIN_ANCLAS)
  })

  it('al declarar anclas en uno, hay que BAJAR el techo (si no, el trinquete no aprieta)', () => {
    const sin = detectores().filter((f) => !anclasDe(f)).length
    expect(
      sin < TECHO_SIN_ANCLAS
        ? `Ya hay ${sin} detectores sin anclas (el techo dice ${TECHO_SIN_ANCLAS}): baja TECHO_SIN_ANCLAS a ${sin}.`
        : '',
    ).toBe('')
  })
})
