import fs from 'fs'
import path from 'path'
import { RUNBOOK_BY_KIND } from '../../lib/admin/runbookRegistry'

// ── Guardarraíl anti-DRIFT del sweep de salud ──────────────────────────────────
// El sweep de contenido vive DUPLICADO a mano en dos ficheros que DEBEN emitir los
// mismos `kind`s (misma detección):
//   - backend/src/content-health-sweep/content-health-sweep.service.ts  → @Cron 03:00
//     UTC, el writer PROGRAMADO real de content_health_findings.
//   - scripts/health-sweep.cjs  → gemelo CLI (DRY/manual), "MANTENER EN SYNC".
//
// El 22/07 se descubrió que el backend @Cron iba 8 detectores por detrás del script
// (article_no_coverage, convocatoria_timeline_*, scope_over_inclusion_suspect,
// scope_phantom_article, texto_examen_pasado, hito_vencido_abierto, seguimiento_url_stale)
// → el @Cron escribía un snapshot INCOMPLETO cada noche y el panel perdía detectores
// EN SILENCIO. Este test falla si los dos ficheros vuelven a divergir en su set de kinds.
//
// Universo de kinds = claves de RUNBOOK_BY_KIND (fuente fiable; el guardarraíl de
// runbookRegistry ya garantiza que todo finding tiene entrada). Los kinds que NO son del
// sweep (p.ej. `render_error`, client-side) no aparecen en ninguno de los dos ficheros y
// quedan fuera automáticamente.

const REPO = path.resolve(__dirname, '../..')
const SCRIPT = fs.readFileSync(path.join(REPO, 'scripts/health-sweep.cjs'), 'utf8')
const BACKEND = fs.readFileSync(
  path.join(REPO, 'backend/src/content-health-sweep/content-health-sweep.service.ts'),
  'utf8',
)

// ¿aparece el literal del kind (entre comillas) en el texto del fichero?
const hasKind = (txt: string, kind: string) =>
  new RegExp(`['"\`]${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(txt)

// Detectores CLI-only: corren SOLO en el gemelo `scripts/health-sweep.cjs`, no en el
// backend @Cron. `shuffle_safe_regressed` invoca un subproceso `npx tsx
// scripts/sweep-shuffle-safety-drift.ts` que importa `explanationReferencesLetters` de
// `@/lib/shuffle/...` (lib del FRONTEND). El backend NestJS (proyecto ./backend separado,
// build sin acceso al root `scripts/` ni a `@/lib`) no puede ejecutarlo tal cual, así que
// se excluye de la paridad A PROPÓSITO. Consecuencia asumida: el @Cron nocturno NO refresca
// estos hallazgos (solo aparecen al correr el CLI a mano). Si algún día se reimplementa la
// lógica nativa en el service (o en un paquete compartido), quitarlo de este set.
// `shuffle_narrativa_letra_clavada` (T-262) sale del MISMO subproceso y hereda la misma
// limitación: se emite al correr el CLI, no en el @Cron nocturno. Se documenta en el runbook para
// que nadie lea un badge a cero como "no hay ninguna". Promoverlos al @Cron exige un paquete
// compartido con `lib/shuffle/*` — reimplementar el detector en el backend crearía la segunda
// copia de patrones que este módulo lleva cuatro calibraciones evitando.
// `cita_no_literal` (29/07) es CLI-only por una razón distinta a las de shuffle: no es que el
// backend no pueda importar la lib, es que el criterio compara la CITA contra el TEXTO del artículo
// fila a fila —44.370 explicaciones—, y eso no cabe en un `WHERE`. Se emite desde el subproceso
// `barrido-citas.cjs --json`. Consecuencia asumida y documentada en el runbook: el badge no se
// refresca solo; un cero ahí significa «nadie ha corrido el barrido».
// `explicacion_yuxtaposicion` (T-525, 05/08) es CLI-only por la MISMA razón que `cita_no_literal`:
// compara, opción por opción, el segmento de la explicación contra el texto de esa opción — no
// cabe en un `WHERE`. Subproceso `audit-explicacion-yuxtaposicion.cjs --json`.
const CLI_ONLY_KINDS = new Set([
  'shuffle_safe_regressed',
  'shuffle_narrativa_letra_clavada',
  // `shuffle_veredicto_criterio_viejo` (T-316) sale del MISMO subproceso que los dos de arriba y
  // hereda su limitación: se emite al correr el CLI, no en el @Cron nocturno.
  'shuffle_veredicto_criterio_viejo',
  'cita_no_literal',
  'explicacion_yuxtaposicion',
])

// Kinds ON-DEMAND (T-142): los emite `scripts/convocatoria/audit-landing.cjs`, que se corre a mano
// (y como puerta antes de una campaña), NO el barrido nocturno. Se midieron sobre las 123 landings
// activas antes de decidirlo: en el sweep daban 168 y 89 hallazgos, casi todos por falta de
// contexto —el 96% de los documentos del hub están clonados como `nota` y las FAQ enumeran
// subconjuntos—. Quedan fuera de la paridad a propósito; si algún día se promueven al nocturno,
// hay que quitarlos de aquí Y cablearlos en los DOS gemelos.
const ON_DEMAND_KINDS = new Set([
  'landing_enlace_roto',
  'landing_cifra_sin_respaldo',
  'landing_superficies_contradictorias',
])
const ALL_KINDS = Object.keys(RUNBOOK_BY_KIND).filter(
  (k) => !CLI_ONLY_KINDS.has(k) && !ON_DEMAND_KINDS.has(k),
)
const scriptKinds = ALL_KINDS.filter((k) => hasKind(SCRIPT, k)).sort()
const backendKinds = ALL_KINDS.filter((k) => hasKind(BACKEND, k)).sort()

describe('content-health-sweep — paridad script ↔ backend @Cron', () => {
  it('el script emite al menos un puñado de detectores (sanity: la extracción funciona)', () => {
    expect(scriptKinds.length).toBeGreaterThanOrEqual(15)
  })

  it('TODO kind del script (CLI) está también en el backend @Cron (el writer real)', () => {
    const faltanEnBackend = scriptKinds.filter((k) => !backendKinds.includes(k))
    expect(faltanEnBackend).toEqual([])
  })

  it('TODO kind del backend está también en el script (sin extras huérfanos)', () => {
    const faltanEnScript = backendKinds.filter((k) => !scriptKinds.includes(k))
    expect(faltanEnScript).toEqual([])
  })

  it('los sets de kinds son IDÉNTICOS (no hay drift en ninguna dirección)', () => {
    expect(backendKinds).toEqual(scriptKinds)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRIDAD DE LOS MIRRORS: el backend NestJS no puede importar `lib/` del frontend,
// así que replica núcleos puros INLINE. Un mirror que se desincroniza es peor que no
// tenerlo (el @Cron nocturno —el writer real— vería otra cosa que el CLI y el audit).
// Estos tests comparan las TABLAS de datos de ambos lados, no su prosa.
// ─────────────────────────────────────────────────────────────────────────────
const { PATTERNS } = require('@/lib/convocatoria/canonicalizeBoletinUrl.cjs')

describe('mirror del registro de boletines (backend ↔ lib)', () => {
  const backendBoletines = [...BACKEND.matchAll(/\{\s*boletin:\s*'([A-Z]+)',\s*re:/g)].map((m) => m[1]).sort()
  const libBoletines = PATTERNS.map((p: { boletin: string }) => p.boletin).sort()

  it('el backend conoce EXACTAMENTE los mismos boletines que el registro compartido', () => {
    expect(backendBoletines).toEqual(libBoletines)
  })

  it('el registro no está vacío (sanity de la extracción por regex)', () => {
    expect(libBoletines.length).toBeGreaterThanOrEqual(5)
  })
})

// El registro por DOMINIO (T-134) es la segunda mitad del mismo ladrillo: `PATTERNS` dice QUÉ
// documento es, `BOLETIN_HOSTS` dice DE QUIÉN es la URL. El backend lo replica inline y un drift
// aquí devuelve al detector a su zona ciega (56 de 123 landings) sin que nada avise.
describe('mirror del registro de HOSTS de boletín (backend ↔ lib)', () => {
  const { BOLETIN_HOSTS, boletinDeUrl } = require('@/lib/convocatoria/canonicalizeBoletinUrl.cjs')
  // Se EVALÚA el literal del backend (como el mirror de visualDeixis) en vez de parsearlo con
  // otra regex: una regex sobre regex-literales se rompe con la primera barra escapada (`/\/boc\//`)
  // y un test que deja de casar en silencio es peor que no tenerlo.
  const evalArray = (src: string, name: string): Array<Record<string, unknown>> => {
    const m = src.match(new RegExp(`const ${name}[^=]*= (\\[[\\s\\S]*?\\n\\]);`))
    if (!m) throw new Error(`no se encontró const ${name} en el fuente`)
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)()
  }
  const clave = (b: string, host: RegExp, path?: RegExp) => `${b}|${host.source}|${path ? path.source : ''}`
  const backendHosts = evalArray(BACKEND, 'BOLETIN_HOSTS')
    .map((h) => clave(h.boletin as string, h.hostRe as RegExp, h.pathRe as RegExp | undefined))
    .sort()
  const libHosts = BOLETIN_HOSTS.map((h: { boletin: string; host: RegExp; path?: RegExp }) =>
    clave(h.boletin, h.host, h.path),
  ).sort()

  it('el backend conoce los MISMOS dominios, con los mismos filtros de ruta', () => {
    expect(backendHosts).toEqual(libHosts)
  })

  it('la extracción del backend no está vacía (sanity: si el regex deja de casar, el test miente)', () => {
    expect(backendHosts.length).toBeGreaterThanOrEqual(15)
  })

  it('los dominios que NO son boletín siguen sin reconocerse (la zona ciega se cierra por arriba, no por abajo)', () => {
    for (const url of [
      'https://www.policia.es/portalaspirantes/en/web/escala-basica-ejecutiva',
      'https://www.euskadi.eus/ope-administracion-general-euskadi/',
      'https://www3.gobiernodecanarias.org/sanidad/scs/content/x/025_Celador.pdf',
      'https://empleopublico.carm.es/publicaciones/37400.pdf',
    ]) {
      expect(boletinDeUrl(url).boletin).toBeNull()
    }
  })
})

describe('mirror de las bandas de enlace_no_es_boletin (backend ↔ lib)', () => {
  it('el backend usa el MISMO conjunto de estados con ficha viva que el núcleo puro', () => {
    // `procesoConFichaViva` (seguimientoUrlSalud.cjs) decide error vs warn en los dos gemelos.
    // Si el backend se quedara con otra lista, el @Cron nocturno marcaría distinto que el CLI.
    const { procesoConFichaViva } = require('@/lib/convocatoria/seguimientoUrlSalud.cjs')
    const m = BACKEND.match(/const ESTADOS_FICHA_VIVA_INLINE = new Set\(\[([\s\S]*?)\]\)/)
    expect(m).toBeTruthy()
    const backendEstados = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
    expect(backendEstados.length).toBeGreaterThanOrEqual(5)
    for (const e of backendEstados) expect(procesoConFichaViva(e)).toBe(true)
    // y ninguno de los estados SIN ficha viva se ha colado en la lista del backend
    for (const e of ['oep_aprobada', 'sin_oep', 'examen_realizado', 'nombramientos']) {
      expect(backendEstados).not.toContain(e)
    }
  })

  it('las señales de URL del backend son IDÉNTICAS a las del núcleo (comparadas por VALOR)', () => {
    const { señalesDeUrl } = require('@/lib/convocatoria/linkCoherence.cjs')
    const evalConst = (name: string): RegExp => {
      const m = BACKEND.match(new RegExp(`const ${name} = (/[^\\n]*?);\\n`))
      if (!m) throw new Error(`no se encontró const ${name} en el backend`)
      // eslint-disable-next-line no-new-func
      return new Function(`return (${m[1]})`)()
    }
    const backendSignals = {
      doc: evalConst('EXT_DOCUMENTO_INLINE'),
      indice: evalConst('PAGINA_INDICE_INLINE'),
      idioma: evalConst('IDIOMA_EXTRANJERO_INLINE'),
      temario: evalConst('RUTA_TEMARIO_INLINE'),
    }
    // Se comprueba el COMPORTAMIENTO sobre los casos reales, no el texto del patrón.
    const casos: Array<[string, 'portadaOSeccion' | 'idiomaExtranjero' | 'pareceTemario', boolean]> = [
      ['https://www.policia.es/portalaspirantes/en/web/escala-basica-ejecutiva', 'idiomaExtranjero', true],
      ['https://www.jgpa.es/procesos-selectivos', 'portadaOSeccion', true],
      ['https://www.correos.es/es/es/personas-y-talento/empleo/index.html', 'portadaOSeccion', true],
      ['https://empleopublico.carm.es/publicaciones/37400.pdf', 'portadaOSeccion', false],
      ['https://web.guardiacivil.es/documentos/pdfs/2024/TEMARIO_INGRESO_GC.pdf', 'pareceTemario', true],
    ]
    for (const [url, señal, esperado] of casos) {
      expect(señalesDeUrl(url)[señal]).toBe(esperado)
      const ruta = url.replace(/^https?:\/\/[^/]+/, '')
      const backendValor =
        señal === 'idiomaExtranjero'
          ? backendSignals.idioma.test(ruta.split('?')[0])
          : señal === 'pareceTemario'
            ? backendSignals.temario.test(ruta.split('?')[0])
            : backendSignals.indice.test(ruta.split('?')[0]) ||
              (!backendSignals.doc.test(ruta.split('?')[0]) && !/\d{3,}/.test(ruta.replace(/\b(?:19|20)\d{2}\b/g, '')))
      expect(backendValor).toBe(esperado)
    }
  })
})

describe('mirror de landingCompleteness (backend ↔ lib)', () => {
  const { MIN_FAQS } = require('@/lib/convocatoria/landingCompleteness.cjs')

  it('el umbral de FAQs del backend coincide con el del núcleo puro', () => {
    const m = BACKEND.match(/const MIN_FAQS = (\d+);/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBe(MIN_FAQS)
  })

  it('el backend evalúa las mismas piezas que el núcleo puro', () => {
    const { PIEZAS } = require('@/lib/convocatoria/landingCompleteness.cjs')
    // Cada pieza tiene que aparecer nombrada en el mensaje o en el campo que comprueba.
    const CAMPO_POR_PIEZA: Record<string, string> = {
      tarjetas_hero: 'landing_estadisticas',
      faqs: 'landing_faqs',
      descripcion: 'landing_description',
      seo_title: 'seo_title',
      seo_description: 'seo_description',
      titulo_requerido: 'titulo_requerido',
      examen_config: 'examen_config',
    }
    for (const p of PIEZAS as Array<{ id: string }>) {
      const campo = CAMPO_POR_PIEZA[p.id]
      expect(campo).toBeDefined()
      expect(BACKEND).toContain(campo)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// MIRROR del detector `visual_deixis_no_image` (núcleo compartido ↔ backend @Cron).
//
// Reparto: los patrones y su calibración viven UNA vez en `lib/health/visualDeixis.cjs`.
// `scripts/health-sweep.cjs` los REQUIERE (no puede divergir por construcción); el backend
// NestJS no puede importarlos (build separado) y los replica INLINE. Este bloque compara
// los literales del backend con los del núcleo POR VALOR — no por nombre de variable ni por
// buscar texto en el fuente, que es lo que dejaría pasar un cambio real de patrón.
//
// Mismo contrato que los mirrors de canonicalizeBoletinUrl y landingCompleteness.
// ─────────────────────────────────────────────────────────────────────────────
describe('mirror del detector visual_deixis_no_image (núcleo ↔ backend @Cron)', () => {
  const core = require('@/lib/health/visualDeixis.cjs')

  /** Evalúa el valor REAL de un `const X = <expresión de strings>;` del fuente. */
  function evalConst(src: string, name: string, scope: Record<string, string> = {}): string {
    const m = src.match(new RegExp(`const ${name} =([\\s\\S]*?);\\n`))
    if (!m) throw new Error(`no se encontró const ${name} en el fuente`)
    const keys = Object.keys(scope)
    // eslint-disable-next-line no-new-func
    return new Function(...keys, `return (${m[1]})`)(...keys.map((k) => scope[k]))
  }

  const backendNouns = evalConst(BACKEND, 'VD_NOUNS')
  const backendStrong = evalConst(BACKEND, 'VD_STRONG', { VD_NOUNS: backendNouns })
  const backendFp = evalConst(BACKEND, 'VD_FP')
  const backendSql = evalConst(BACKEND, 'VD_SQL')

  it('el CLI CONSUME el núcleo compartido (no lleva su propia copia)', () => {
    expect(SCRIPT).toContain("require('../lib/health/visualDeixis.cjs')")
    expect(SCRIPT).not.toMatch(/const VD_STRONG\s*=/)
  })

  it('la lista de sustantivos visuales del backend es IDÉNTICA a la del núcleo', () => {
    expect(backendNouns).toBe(core.VISUAL_NOUNS.join('|'))
  })

  it('el patrón fuerte del backend es IDÉNTICO al del núcleo', () => {
    expect(backendStrong).toBe(core.VD_STRONG)
  })

  it('las guardas (falsos positivos y SQL) del backend son IDÉNTICAS a las del núcleo', () => {
    expect(backendFp).toBe(core.VD_FP)
    expect(backendSql).toBe(core.VD_SQL)
  })

  it('la guarda de SQL se aplica también a las OPCIONES en ambos gemelos', () => {
    // En 2 de los 3 casos reales la query vive en las opciones: si un gemelo solo mirase
    // question_text, esas dos volverían a marcarse como falsos positivos.
    for (const txt of [SCRIPT, BACKEND]) {
      for (const col of ['option_a', 'option_b', 'option_c', 'option_d']) {
        expect(txt).toContain(col)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CABLEADO de los invariantes de timeline (T-124, 26/07/2026).
//
// El sweep NO lee `convocatoria_hito_incidencias` entera: reparte por nombre de
// invariante en dos cubos (`graves` → error, `stale` → warn) y **lo que no cae en
// ninguno se descarta en silencio**. Es decir, se puede añadir un invariante a la
// vista y que en producción no exista: escrito pero no cableado, el modo de fallo
// más silencioso de este subsistema.
//
// Este bloque fija que TODO invariante conocido esté enrutado en AMBOS gemelos.
// Si añades un I11 a la vista, añádelo aquí y al reparto, o el test te lo recuerda.
// ─────────────────────────────────────────────────────────────────────────────
describe('cableado de invariantes de timeline (vista ↔ sweep)', () => {
  // Invariantes que la vista emite y que el sweep DEBE enrutar. `I5_registro_sin_fuente`
  // está excluido a propósito en el propio sweep (línea base de cobertura de fuente,
  // 794 filas que solo dicen "aún no hay documentos"), así que no se exige.
  const ENRUTADOS = [
    'I1_orden',
    'I2_duplicado',
    'I9_tipo_incoherente',
    'I10_inscripcion_sin_convocatoria', // T-124: misinformación visible → error
    'I11_fechas_inscripcion_vs_hitos', // T-142: la fila y sus hitos, dos fechas del mismo plazo
    'I7_prevision_caducada',
    'I8_status_contradice_fecha',
  ]

  for (const inv of ENRUTADOS) {
    it(`${inv} está enrutado en el gemelo CLI`, () => {
      expect(SCRIPT).toContain(inv)
    })
    it(`${inv} está enrutado en el backend @Cron (el writer real)`, () => {
      expect(BACKEND).toContain(inv)
    })
  }

  it('I10 va al cubo de ERROR, no al de warn (es misinformación, no un hito viejo)', () => {
    // Se comprueba por proximidad al kind: I10 debe aparecer antes del reparto de
    // `stale`/`convocatoria_timeline_caducado` en ambos ficheros.
    for (const txt of [SCRIPT, BACKEND]) {
      const iI10 = txt.indexOf('I10_inscripcion_sin_convocatoria')
      const iCaducado = txt.indexOf('convocatoria_timeline_caducado')
      expect(iI10).toBeGreaterThan(-1)
      expect(iCaducado).toBeGreaterThan(-1)
      expect(iI10).toBeLessThan(iCaducado)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// MIRROR del detector `audit_note_explanation` (núcleo compartido ↔ backend @Cron).
//
// Origen (28/07/2026): el detector llevaba meses reportando CERO mientras había 24 preguntas
// activas con el defecto. Sus 10 literales venían de una remesa concreta de julio y no cubrían
// las otras formas del mismo acto. Lo cazó una persona revisando otro cubo, no el sensor.
// Como el gemelo del backend es el que escribe el snapshot nocturno, ampliar solo el CLI
// habría dejado el @Cron —y por tanto el badge— exactamente igual de ciego.
// ─────────────────────────────────────────────────────────────────────────────
describe('mirror del detector enunciado_norma_sin_nombrar (núcleo ↔ backend @Cron)', () => {
  const core = require('@/lib/health/autocontenida.cjs')

  /** Evalúa el valor REAL de un `const X = '…' + '…';` del fuente. */
  function evalConst(src: string, name: string): string {
    const m = src.match(new RegExp(`const ${name} =([\\s\\S]*?);\\n`))
    if (!m) throw new Error(`no se encontró const ${name} en el fuente`)
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)()
  }

  it('el CLI CONSUME el núcleo compartido (no lleva su propia copia)', () => {
    expect(SCRIPT).toContain("require('../lib/health/autocontenida.cjs')")
    expect(SCRIPT).not.toMatch(/const AC_DESNUDA\s*=/)
  })

  it('los TRES patrones del backend son IDÉNTICOS a los del núcleo', () => {
    for (const name of ['AC_DESNUDA', 'AC_IDENTIFICA', 'AC_SIGLA']) {
      expect(evalConst(BACKEND, name)).toBe(core[name])
    }
  })

  // La sigla se compara con `~` y no con `~*` a propósito: en Postgres, `~*` sobre
  // `[A-ZÁÉÍÓÚÑ]{2,}` casaría dos letras CUALESQUIERA y daría por identificada toda pregunta,
  // dejando el detector en cero permanente. Es el fallo más fácil de introducir aquí.
  it('la SIGLA se compara sensible a mayúsculas en los dos gemelos', () => {
    for (const txt of [SCRIPT, BACKEND]) {
      expect(txt).toMatch(/question_text ~ (\$3|\$\{AC_SIGLA\})/)
      expect(txt).not.toMatch(/question_text ~\* (\$3|\$\{AC_SIGLA\})/)
    }
  })

  it('los dos gemelos emiten el kind', () => {
    expect(hasKind(SCRIPT, 'enunciado_norma_sin_nombrar')).toBe(true)
    expect(hasKind(BACKEND, 'enunciado_norma_sin_nombrar')).toBe(true)
  })
})

describe('mirror del detector audit_note_explanation (núcleo ↔ backend @Cron)', () => {
  const core = require('@/lib/health/auditNoteExplanation.cjs')

  /** Lee el array literal `const AUDIT_NOTE_PATS = [...]` del fuente y lo evalúa. */
  function evalPats(src: string): string[] {
    const m = src.match(/const AUDIT_NOTE_PATS = (\[[\s\S]*?\])/)
    if (!m) throw new Error('no se encontró const AUDIT_NOTE_PATS en el fuente')
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)()
  }

  it('el CLI CONSUME el núcleo compartido (no lleva su propia copia)', () => {
    expect(SCRIPT).toContain("require('../lib/health/auditNoteExplanation.cjs')")
    expect(SCRIPT).not.toMatch(/const AUDIT_NOTE_PATS\s*=/)
  })

  it('la lista de patrones del backend es IDÉNTICA a la del núcleo (mismo orden y valor)', () => {
    expect(evalPats(BACKEND)).toEqual(core.AUDIT_NOTE_PATS)
  })

  // El 28/07/2026 la lista ampliada volvió a quedarse en verde (96 activas con el defecto, 0
  // vistas) y se le añadió un PATRÓN META. Es la segunda mitad del criterio: si el backend se
  // quedara solo con los literales, el @Cron —el que escribe el snapshot— seguiría ciego a esas
  // 96 mientras el CLI las ve, que es exactamente el drift que este bloque existe para impedir.
  /** Lee el literal `const AUDIT_NOTE_META_RE_SRC = '…' + '…'` del fuente y lo evalúa. */
  function evalMetaRe(src: string): string {
    const m = src.match(/const AUDIT_NOTE_META_RE_SRC\s*=\s*([\s\S]*?);\n/)
    if (!m) throw new Error('no se encontró const AUDIT_NOTE_META_RE_SRC en el fuente')
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)()
  }

  it('el patrón META del backend es IDÉNTICO al del núcleo', () => {
    expect(evalMetaRe(BACKEND)).toBe(core.AUDIT_NOTE_META_RE_SRC)
  })

  it('los DOS gemelos aplican el patrón META en su SQL (no solo lo declaran)', () => {
    expect(SCRIPT).toMatch(/explanation ~\* \$/)
    expect(BACKEND).toMatch(/explanation ~\* \$\{AUDIT_NOTE_META_RE_SRC\}/)
  })

  // T-307 (30/07/2026): los 23 `ILIKE '%…%'` costaban 38 de los 40,6 s de esta query, reventaban
  // el `statement_timeout` de 30 s del backend y tumbaban el barrido COMPLETO. Van fundidos en una
  // alternancia derivada de la MISMA lista. Estos tres tests son el trinquete: que el valor que
  // construye el backend sea el del núcleo, que los dos gemelos lo apliquen, y que ninguno vuelva
  // al `ILIKE` por fila (que es lo que no cabe en el presupuesto).
  /** Evalúa la derivación del backend (escape + join) con la lista del núcleo. */
  function evalLiteralRe(src: string): string {
    const esc = src.match(/const escaparLiteralRe = \(s: string\) =>\s*([\s\S]*?);\n/)
    const alt = src.match(/const AUDIT_NOTE_LITERAL_RE_SRC =\s*([\s\S]*?);\n/)
    if (!esc || !alt) throw new Error('no se encontró la derivación del literal en el backend')
    // eslint-disable-next-line no-new-func
    return new Function(
      'AUDIT_NOTE_PATS',
      `const escaparLiteralRe = (s) => ${esc[1]}; return (${alt[1]})`,
    )(core.AUDIT_NOTE_PATS)
  }

  it('la alternancia de literales del backend es IDÉNTICA a la del núcleo', () => {
    expect(evalLiteralRe(BACKEND)).toBe(core.AUDIT_NOTE_LITERAL_RE_SRC)
  })

  it('los DOS gemelos consultan por la alternancia, y el CLI la CONSUME del núcleo', () => {
    expect(BACKEND).toMatch(/explanation ~\* \$\{AUDIT_NOTE_LITERAL_RE_SRC\}/)
    expect(SCRIPT).toContain('AUDIT_NOTE_LITERAL_RE_SRC')
    expect(SCRIPT).not.toMatch(/const AUDIT_NOTE_LITERAL_RE_SRC\s*=/)
  })

  it('ninguno de los dos vuelve a mirar la explicación con ILIKE por literal (presupuesto)', () => {
    expect(BACKEND).not.toMatch(/explanation ILIKE/)
    expect(SCRIPT).not.toMatch(/explanation ILIKE/)
  })

  // Tercera recaída (29/07/2026): el patrón META exige que el sujeto sea «la explicación», así
  // que no veía la nota escrita en INFINITIVO («Añadir sección «Por qué las demás…»»). 6 activas,
  // 0 vistas por los 21 literales ni por el meta; la destapó una impugnación, no el sensor. Si el
  // backend se quedara sin este tercer patrón, el @Cron —que es el que escribe el snapshot—
  // volvería a estar ciego a esa clase mientras el CLI la ve.
  function evalActoRe(src: string): string {
    const m = src.match(/const AUDIT_NOTE_ACTO_RE_SRC\s*=\s*([\s\S]*?);\n/)
    if (!m) throw new Error('no se encontró const AUDIT_NOTE_ACTO_RE_SRC en el fuente')
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)()
  }

  it('el patrón del ACTO DE EDICIÓN del backend es IDÉNTICO al del núcleo', () => {
    expect(evalActoRe(BACKEND)).toBe(core.AUDIT_NOTE_ACTO_RE_SRC)
  })

  it('los DOS gemelos aplican también el patrón del ACTO en su SQL', () => {
    expect(SCRIPT).toContain('AUDIT_NOTE_ACTO_RE_SRC')
    expect(BACKEND).toMatch(/explanation ~\* \$\{AUDIT_NOTE_ACTO_RE_SRC\}/)
  })

  it('el patrón del ACTO va ANCLADO: no marca «añadir secciones» en mitad de una frase', () => {
    // Caso real del banco (Access): «…se puede cambiar la distribución de los controles de un
    // informe, añadir secciones y modificar propiedades…». Sin el ancla era falso positivo.
    expect(core.isAuditNoteExplanation('En esa vista se pueden añadir secciones y modificar propiedades.')).toBe(false)
    expect(core.isAuditNoteExplanation('Añadir sección «Por qué las demás son correctas:» con el análisis.')).toBe(true)
  })

  it('los dos gemelos siguen emitiendo el kind', () => {
    expect(hasKind(SCRIPT, 'audit_note_explanation')).toBe(true)
    expect(hasKind(BACKEND, 'audit_note_explanation')).toBe(true)
  })
})

// ── El gemelo CLI tiene que PARSEAR ────────────────────────────────────────────
// La paridad de arriba compara TEXTO: busca el literal del kind en el fichero. Eso no se entera
// de si el fichero es JavaScript válido, y por eso el 29/07 se descubrió que `health-sweep.cjs`
// llevaba tiempo sin poder arrancar: un comentario SQL dentro de un template literal se escribió
// con backticks de markdown (`-- ` + backtick + `programa_url` + backtick + ` a pelo…`), y esas
// comillas CIERRAN la plantilla y descuadran el resto del fichero. El script moría con
// «missing ) after argument list» antes de ejecutar una sola consulta.
//
// El daño es silencioso por partida doble: el CLI es la vía manual («corre el barrido a ver qué
// sale») y además es el espejo del que se copia el @Cron, así que un espejo roto se arrastra.
describe('el gemelo CLI del sweep es JavaScript válido', () => {
  it('scripts/health-sweep.cjs parsea', () => {
    const { execFileSync } = require('child_process')
    expect(() =>
      execFileSync(process.execPath, ['--check', path.join(REPO, 'scripts/health-sweep.cjs')], {
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })

  it('ningún template literal del script contiene backticks de markdown en comentarios SQL', () => {
    // La causa concreta, fijada aparte del --check para que el fallo diga QUÉ buscar.
    const sospechosas = SCRIPT.split('\n').filter((l) => /^\s*--\s.*`/.test(l))
    expect(sospechosas).toEqual([])
  })
})

// ── Universo del detector de cobertura (T-146) ────────────────────────────────────────────────
//
// `article_no_coverage` filtraba por entero puro, así que `bis`/`ter`/`quáter` eran invisibles:
// 163 artículos escopados sirviendo cero preguntas que el badge no podía ver NUNCA. El universo
// vive ahora en un sitio (`lib/generacion/huerfanosPlan.js`), el CLI lo importa y el backend lo
// copia inline porque es un proyecto NestJS aparte y no puede importar de `lib/`. Este bloque es
// lo que impide que esa copia derive — que es exactamente cómo nació el punto ciego.
import { SQL_UNIVERSO_COBERTURA } from '../../lib/generacion/huerfanosPlan.js'

const sinEspacios = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('universo del detector de cobertura — núcleo ↔ backend ↔ CLI', () => {
  it('el backend copia el MISMO predicado que el núcleo', () => {
    expect(sinEspacios(BACKEND)).toContain(sinEspacios(SQL_UNIVERSO_COBERTURA))
  })

  it('el CLI NO lo copia: lo importa del núcleo (una definición, no dos)', () => {
    expect(SCRIPT).toMatch(/require\(['"]\.\.\/lib\/generacion\/huerfanosPlan\.js['"]\)/)
    expect(SCRIPT).toMatch(/\$\{SQL_UNIVERSO_COBERTURA\}/)
  })

  it('la familia de REFORMA entra en los dos', () => {
    for (const txt of [BACKEND, SCRIPT + SQL_UNIVERSO_COBERTURA]) {
      expect(txt).toMatch(/bis\|ter\|qu\[aá\]ter/)
    }
  })

  it('las DISPOSICIONES siguen fuera (meter 503 hallazgos no examinables sería peor que el hueco)', () => {
    expect(SQL_UNIVERSO_COBERTURA).not.toMatch(/adicional|transitoria|derogatoria|disposici/i)
  })

  it('ningún mirror castea el número a int (con "6bis" reventaría la consulta entera)', () => {
    // El cast vivía en el ORDER BY del array_agg de ejemplos.
    expect(BACKEND).not.toMatch(/ORDER BY \(a\.article_number\)::int/)
    expect(SCRIPT).not.toMatch(/ORDER BY \(a\.article_number\)::int/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DÓNDE vive un detector es parte de su contrato (T-315, 31/07/2026)
//
// El detector de «techo de timeout» mira los endpoints de TODA la app: su resultado no depende de
// la oposición que el barrido esté recorriendo. Nació dentro del bucle `for (const o of opos)` y
// ahí se ejecutaba **una vez por oposición activa (~123)** calculando 123 veces lo mismo: medido,
// ~74 s por vuelta ⇒ unas 2,5 horas por pasada. El barrido del 31/07 llevaba 47 minutos sin
// terminar cuando se encontró.
//
// Y lo que lo hacía invisible: ese detector solo escribe en el log cuando su consulta FALLA. Las
// vueltas que terminan bien no dejan rastro, así que el coste no se veía en ninguna señal — solo
// en el reloj de la pasada entera.
//
// Este test es barato y fija justo eso: que siga FUERA del bucle. Nadie lo va a recordar dentro de
// tres meses al mover un bloque de sitio.
describe('barrido — los detectores globales NO viven dentro del bucle por oposición', () => {
  /** Balance de llaves entre el `for (const o of opos)` y una línea: >0 = está dentro. */
  function dentroDelBucle(src: string, marcador: string): boolean {
    const lineas = src.split('\n')
    const ini = lineas.findIndex((l) => l.includes('for (const o of opos)'))
    const objetivo = lineas.findIndex((l) => l.includes(marcador))
    expect(ini).toBeGreaterThan(-1)
    expect(objetivo).toBeGreaterThan(-1)
    if (objetivo < ini) return false
    let bal = 0
    for (let i = ini; i <= objetivo; i++) {
      bal += (lineas[i].match(/\{/g) ?? []).length - (lineas[i].match(/\}/g) ?? []).length
    }
    return bal > 0
  }

  it('el detector de techo de timeout corre UNA vez por pasada, no una por oposición', () => {
    expect(dentroDelBucle(BACKEND, 'Techo de timeout')).toBe(false)
  })

  it('el propio bucle sigue existiendo (si no, este test pasaría por vacío)', () => {
    expect(BACKEND).toContain('for (const o of opos)')
    // Y algo que SÍ es por oposición sigue dentro, para que el detector de arriba no sea un
    // falso verde por haberse movido el bucle en vez del bloque.
    expect(dentroDelBucle(BACKEND, "'temas_card'")).toBe(true)
  })
})
