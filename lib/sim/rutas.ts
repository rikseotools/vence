// lib/sim/rutas.ts — el INVENTARIO de rutas y el plan de barrido. PURO. (T-487, 02/08/2026)
//
// ── POR QUÉ NO SE RECORREN «TODAS LAS RUTAS» ─────────────────────────────────────────────────
// Medido el 02/08 sobre el repo: **804 páginas** bajo `app/`, pero solo **168 FORMAS** distintas,
// y cinco de ellas concentran 637 páginas. El motivo es que cada oposición tiene su propio
// directorio con un envoltorio de ~21 líneas que delega en un componente compartido:
//
//     app/administrativo-aragon/test/page.tsx  →  <TestHubPage oposicion="administrativo-aragon" />
//
// O sea que **el código es común y lo que cambia son los DATOS**. Eso parte el problema en dos, y
// cada mitad se cubre de una forma distinta:
//
//   · **Cobertura de CÓDIGO** — una pasada por cada FORMA. 168 visitas, no 804.
//   · **Cobertura de DATOS** — rotar qué ejemplar toca en cada pasada. El ciclo completo tarda
//     tantas pasadas como ejemplares tenga la forma más numerosa, y eso **se puede decir**, que es
//     lo que distingue un muestreo de un barrido a medias que se cree completo.
//
// Recorrer las 804 en cada vuelta sería 5× el coste por CERO cobertura de código extra, y es justo
// el peligro documentado en la ficha: un barrido interno ya tumbó parte del sitio, y con una sola
// réplica no lo degrada — lo para entero.
//
// ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────────────────────
// No toca red, ni disco, ni BD. Recibe la lista de ficheros y los valores reales de los
// parámetros, y devuelve **qué visitar y en qué orden**. Así el criterio se puede probar sin
// levantar un navegador ni pedirle nada a producción.

/** Una forma de ruta: el patrón de URL con la oposición y los parámetros colapsados. */
export interface FormaDeRuta {
  /** p.ej. `/:oposicion/test/tema/:numero` */
  forma: string
  /** las rutas concretas que comparten esa forma, ordenadas (determinismo). */
  ejemplares: string[]
  /** nombres de los segmentos dinámicos, en orden de aparición. */
  params: string[]
  /** clasificación que decide si se visita y con qué cuidado. */
  clase: ClaseDeRuta
}

/**
 * Para qué sirve clasificar: **no todas las rutas cuestan lo mismo ni ensucian lo mismo**.
 *
 *  · `publica`      — se puede visitar anónimo y no deja rastro en datos de negocio.
 *  · `autenticada`  — necesita sesión de la cuenta de prueba.
 *  · `sirve_preguntas` — al abrirla se SIRVEN preguntas reales, que es lo que cuentan
 *    `daily_questions_served`, el ranking y **las señales de fraude**. Un navegador que abre
 *    preguntas y no las responde es literalmente la firma de `harvest_no_answer`. Se marca
 *    aparte para poder limitarla y para que quien la incluya sepa lo que está haciendo.
 *  · `admin`        — panel interno: ni es lo que ve un usuario ni conviene ejercitarlo a ciegas.
 *  · `efimera`      — depende de un id que solo existe tras crear algo (revisar un examen
 *    concreto). Sin ese dato no se puede visitar, y **inventárselo daría un 404 que parecería
 *    un fallo del sitio**.
 */
export type ClaseDeRuta = 'publica' | 'autenticada' | 'sirve_preguntas' | 'admin' | 'efimera'

/** Una visita concreta que el barrido va a hacer. */
export interface Visita {
  url: string
  forma: string
  clase: ClaseDeRuta
  /** por qué le tocó a este ejemplar y no a otro: sin esto, el muestreo parece arbitrario. */
  motivo: string
}

/** Reglas de clasificación, por orden de precedencia. Explícitas: adivinarlas envejece mal. */
const REGLAS: Array<{ re: RegExp; clase: ClaseDeRuta }> = [
  // `/debug/*` son herramientas internas, no lo que ve un usuario: sus 401/403/404 contra APIs
  // internas son correctos y llenaban el informe (3 de las 20 primeras rutas de la pasada real).
  { re: /^\/(admin|debug)(\/|$)/, clase: 'admin' },
  // Revisar un examen o un test concreto necesita un id que solo existe si alguien lo hizo.
  { re: /^\/(revisar|test-recuperado)(\/|$)/, clase: 'efimera' },
  { re: /^\/[^/]*\/test\/revisar-examen(\/|$)/, clase: 'efimera' },
  // Todo lo que sea "hacer un test" sirve preguntas reales.
  { re: /(^|\/)test(\/|$)/, clase: 'sirve_preguntas' },
  { re: /(^|\/)psicotecnicos(\/|$)/, clase: 'sirve_preguntas' },
  { re: /^\/(perfil|mis-|dashboard|recompensas|premium\/gracias)/, clase: 'autenticada' },
]

export function clasificarRuta(ruta: string): ClaseDeRuta {
  for (const r of REGLAS) if (r.re.test(ruta)) return r.clase
  return 'publica'
}

/** `app/foo/[bar]/page.tsx` → `/foo/[bar]`. La raíz es `/`. */
export function rutaDeFichero(fichero: string): string {
  const sinApp = fichero.replace(/^\.?\/?app/, '').replace(/\/page\.[jt]sx?$/, '')
  // Los grupos de rutas de Next `(marketing)` no aparecen en la URL.
  const sinGrupos = sinApp.replace(/\/\([^)]+\)/g, '')
  return sinGrupos === '' ? '/' : sinGrupos
}

/**
 * La FORMA de una ruta: se colapsan los parámetros y, si se sabe cuáles son, el segmento de
 * oposición.
 *
 * **`oposiciones` se inyecta y no se adivina.** Un patrón tipo «primer segmento con guiones»
 * colapsaría `/politica-privacidad` con `/administrativo-aragon`, y entonces el inventario diría
 * que hay una forma menos de las que hay: un barrido que se cree completo y no lo está es peor
 * que uno que declara lo que no mira. Sin el conjunto, cada ruta es su propia forma (más visitas,
 * ninguna mentira).
 */
export function formaDeRuta(ruta: string, oposiciones?: Set<string> | null): string {
  const conParams = ruta.replace(/\[\.{3}([^\]]+)\]/g, ':$1*').replace(/\[([^\]]+)\]/g, ':$1')
  if (!oposiciones || !oposiciones.size) return conParams
  const m = conParams.match(/^\/([^/]+)(\/.*)?$/)
  if (m && oposiciones.has(m[1])) return `/:oposicion${m[2] || ''}`
  return conParams
}

/** Los tres puntos del catch-all `[...slug]` son OPCIONALES: `\.{3}?` los exigiría igual. */
const SEGMENTO_DINAMICO = /\[(?:\.{3})?([^\]]+)\]/

/** Nombres de los segmentos dinámicos, en orden. */
export function paramsDeRuta(ruta: string): string[] {
  return [...ruta.matchAll(new RegExp(SEGMENTO_DINAMICO, 'g'))].map((m) => m[1])
}

/**
 * Agrupa los ficheros de página en formas. Ordenado y determinista: el plan de barrido depende
 * de este orden, y un plan que cambia solo porque el sistema de ficheros devolvió otra cosa no se
 * puede comparar consigo mismo entre pasadas.
 */
export function inventario(ficheros: string[], oposiciones?: Set<string> | null): FormaDeRuta[] {
  const por = new Map<string, FormaDeRuta>()
  for (const f of [...ficheros].sort()) {
    const ruta = rutaDeFichero(f)
    const forma = formaDeRuta(ruta, oposiciones)
    if (!por.has(forma)) {
      por.set(forma, { forma, ejemplares: [], params: paramsDeRuta(ruta), clase: clasificarRuta(ruta) })
    }
    por.get(forma)!.ejemplares.push(ruta)
  }
  return [...por.values()].sort((a, b) => a.forma.localeCompare(b.forma))
}

/**
 * Sustituye los segmentos dinámicos por valores reales.
 *
 * Devuelve `null` si falta algún valor, **y eso NO es un fallo del sitio**: es una ruta que no se
 * puede visitar con los datos que hay. Inventarse un id daría un 404 que el oráculo leería como
 * página rota, y un detector que se autoinventa hallazgos deja de leerse en una semana.
 */
export function concretar(ruta: string, valores: Record<string, string | undefined>): string | null {
  let out = ruta
  for (const p of paramsDeRuta(ruta)) {
    const v = valores[p]
    if (!v) return null
    out = out.replace(SEGMENTO_DINAMICO, encodeURIComponent(v).replace(/%2F/g, '/'))
  }
  return out.includes('[') ? null : out
}

export interface PlanOpts {
  /**
   * Valores por nombre de parámetro, **solo para los que significan lo mismo en toda la app**.
   * `oposicion` rellena los segmentos `[oposicion]` literales; **no** pisa la oposición del
   * ejemplar rotado, porque esa rotación es la cobertura de datos.
   */
  valores?: Record<string, string | undefined>
  /**
   * Valores por FORMA, y son los que de verdad hacen falta: el mismo nombre de parámetro no
   * significa lo mismo en dos sitios. Medido el 02/08, `[slug]` es a la vez un tema del temario,
   * un artículo de ayuda y un curso. Con un solo valor global, dos de cada tres visitas darían
   * **404 falsos** — y un detector que se inventa hallazgos deja de leerse en una semana.
   *
   * Lo que no tenga valor NO se visita: sale declarado en `fuera`, que es distinto de «visitado y
   * correcto» y se imprime como tal.
   */
  valoresPorForma?: Record<string, Record<string, string | undefined>>
  /**
   * Último recurso: valores que dependen del EJEMPLAR concreto, no de la forma.
   *
   * Hace falta porque la rotación y los datos van juntos. Medido el 02/08: 128 oposiciones
   * empiezan en el tema 1 y **3 empiezan en el 101**, así que un `tema-1` universal daría 404
   * falsos justo en las pasadas que tocan esas tres. Se inyecta como función para que el criterio
   * siga siendo puro y testeable.
   */
  resolver?: (ctx: { forma: string; ejemplar: string; oposicion: string | null }) => Record<string, string | undefined>
  /** cuántas visitas caben en esta pasada. Es el freno anti-autodenegación de servicio. */
  presupuesto: number
  /** número de pasada. Rota qué ejemplar toca, para que los DATOS se cubran con el tiempo. */
  pasada?: number
  /** qué clases entran. Por defecto, lo que un visitante puede ver sin ensuciar contadores. */
  clases?: ClaseDeRuta[]
}

/**
 * El plan de UNA pasada: una visita por forma, con el ejemplar rotado según la pasada.
 *
 * Tres decisiones, y las tres son el diseño:
 *
 * 1. **Una por forma.** Es donde está la cobertura de código; repetir ejemplares de la misma
 *    forma en la misma pasada gasta presupuesto sin mirar nada nuevo.
 * 2. **Rotación determinista** (`pasada % ejemplares`), no azar. Se puede predecir qué cubre la
 *    pasada 7, se puede reproducir un hallazgo, y el plan se compara consigo mismo.
 * 3. **El presupuesto RECORTA, y se dice qué se quedó fuera.** Un barrido que trunca en silencio
 *    se lee como «lo he visto todo» sin haberlo visto — es el mismo fallo que las landings que
 *    se daban por auditadas.
 */
export function planDeBarrido(formas: FormaDeRuta[], opts: PlanOpts): { visitas: Visita[]; fuera: string[] } {
  const clases = opts.clases ?? ['publica']
  const pasada = Math.max(0, Math.floor(opts.pasada ?? 0))
  const valores = opts.valores ?? {}

  const visitas: Visita[] = []
  const fuera: string[] = []

  for (const f of formas) {
    if (!clases.includes(f.clase)) continue
    const i = f.ejemplares.length ? pasada % f.ejemplares.length : 0
    const ejemplar = f.ejemplares[i]
    if (!ejemplar) continue
    // **La oposición del ejemplar NUNCA se pisa.** Rotar el ejemplar ES la cobertura de datos, así
    // que forzar siempre la misma oposición la anularía y el barrido miraría 128 veces la misma.
    // `valores.oposicion` solo rellena los segmentos `[oposicion]` LITERALES (hay 11 rutas así,
    // distintas de los directorios por oposición aunque compartan forma).
    const segmento = ejemplar.split('/')[1] ?? ''
    const oposicion = f.forma.startsWith('/:oposicion') && !segmento.startsWith('[') ? segmento : null
    // Lo específico manda sobre lo global: la forma evita meter un slug de curso en la ruta del
    // temario, y el ejemplar evita pedirle el tema 1 a una oposición que empieza en el 101.
    const url = concretar(ejemplar, {
      ...valores,
      ...(opts.valoresPorForma?.[f.forma] ?? {}),
      ...(opts.resolver?.({ forma: f.forma, ejemplar, oposicion }) ?? {}),
    })
    if (!url) { fuera.push(`${f.forma} (faltan valores para ${f.params.join(', ')})`); continue }
    visitas.push({
      url,
      forma: f.forma,
      clase: f.clase,
      motivo: f.ejemplares.length > 1 ? `ejemplar ${i + 1}/${f.ejemplares.length} (pasada ${pasada})` : 'única',
    })
  }

  const dentro = visitas.slice(0, opts.presupuesto)
  for (const v of visitas.slice(opts.presupuesto)) fuera.push(`${v.url} (sin presupuesto)`)
  return { visitas: dentro, fuera }
}

/** Cuántas pasadas hacen falta para ver TODOS los ejemplares de todas las formas incluidas. */
export function pasadasParaCicloCompleto(formas: FormaDeRuta[], clases: ClaseDeRuta[] = ['publica']): number {
  return formas.filter((f) => clases.includes(f.clase)).reduce((max, f) => Math.max(max, f.ejemplares.length), 0)
}
