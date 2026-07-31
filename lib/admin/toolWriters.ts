// lib/admin/toolWriters.ts — núcleo PURO de detección de ESCRITURAS a recursos sensibles.
// Sin BD, sin red, sin filesystem: recibe el texto de un fichero y dice qué escribe.
//
// ## Para qué (T-130, 26/07/2026)
//
// Con 2-10 sesiones en paralelo se construye lo que ya está construido. El mismo día se midieron
// dos casos: cinco escritores distintos de `seguimiento_url` (cuatro sin ver) y un
// "headless-fetcher pendiente de construir" que llevaba meses desplegado en `oposiciones.fetcher_type`
// con 67 filas. Dos puertas al mismo dato con criterios distintos = el guardarraíl del bueno no
// protege nada, porque basta usar el otro.
//
// Este módulo es la parte que NO puede depender de la memoria de nadie: escanea y dice la verdad.
// El guardarraíl (`__tests__/guardrails/toolRegistry.guardrail.test.ts`) lo usa para exigir que
// todo escritor esté registrado en `toolRegistry` y que haya UN SOLO escritor `vivo` por recurso.
//
// ## Por qué la detección es por PATRÓN DE ESCRITURA y no por "aparece el nombre de la columna"
//
// Medido el 26/07: buscar el nombre a secas devuelve esquemas (`pgTable`), tipos y SELECTs — ruido
// que haría el guardarraíl inservible desde el primer día (misma lección que `hash_change`: una
// bandeja ruidosa se aprende a ignorar). Solo cuentan las formas en que este repo escribe de verdad:
// `UPDATE … SET col =`, `INSERT INTO … (col)`, y el `.set({ camelCase: … })` / `.values({ … })` de
// Drizzle. Los ficheros de esquema se excluyen por contenido (`pgTable`), no por convención de
// nombre, porque no todos se llaman `*.schema.ts`.

/**
 * Qué exige el guardarraíl para un recurso. La regla NO es una preferencia de estilo: se elige por
 * cuántos escritores tiene el recurso HOY y por si su protección ya vive en otro sitio.
 *
 * · `guardarrail_compartido` — toda escritura debe estar REGISTRADA y toda herramienta `vivo` que
 *   lo escriba debe pasar por el MISMO módulo de guardarraíl. No se exige "un solo escritor":
 *   medido el 26/07, `seguimiento_url` tiene dos escritores vivos legítimos y distintos (rellenar
 *   catalogadas vacías vs. repuntar una existente). Lo que hace daño no es que haya dos puertas,
 *   es que tengan criterios distintos — entonces el guardarraíl de la buena no protege nada,
 *   porque basta entrar por la otra.
 * · `trinquete` — hay decenas de escritores legítimos (scripts de construcción puntuales) y su
 *   protección real vive en otro mecanismo. Exigir registro de todos sería el "inventario" que
 *   este registro evita a propósito. Lo que se vigila es que el número **no crezca**: un escritor
 *   nuevo pone el CI en rojo y obliga a justificarlo o a usar la vía legítima.
 */
export type ReglaRecurso = 'guardarrail_compartido' | 'trinquete'

/** Recurso cuyo doble-escritor es peligroso: dos puertas con criterios distintos al mismo dato. */
export interface RecursoSensible {
  /** Columna en SQL (snake_case). */
  columna: string
  /** Propiedad en Drizzle (camelCase). */
  propiedad: string
  /** Por qué está vigilado — se muestra cuando el guardarraíl falla. */
  porQue: string
  regla: ReglaRecurso
  /**
   * Solo en `guardarrail_compartido`: módulo por el que DEBE pasar toda herramienta viva que
   * escriba el recurso. El guardarraíl comprueba que el fichero lo referencia de verdad.
   */
  moduloGuardarrail?: string
  /**
   * Función SQL que es la ÚNICA vía legítima de escribir el recurso (p. ej.
   * `transition_question_state` para `lifecycle_state`).
   *
   * Sin esto, el detector solo veía `UPDATE`/`INSERT`/Drizzle y **una herramienta que hace lo
   * correcto parecía no escribir nada** — el guardarraíl la marcaba como «dice escribir y no lo
   * hace», empujando justo a lo contrario de lo que se quiere: a escribir a pelo.
   */
  funcionPuerta?: string
  /**
   * Solo en `trinquete`: número de escritores medido al fijar el trinquete. Bajarlo es bienvenido
   * (consolidación); subirlo exige tocar este fichero a conciencia.
   */
  techo?: number
  /** Dónde vive su protección real, si no es este registro. Es el anti-silo: apunta, no duplica. */
  guardarrailPropio?: string
}

/**
 * Lista EXPLÍCITA y corta a propósito. El registro no cataloga los cientos de scripts del repo:
 * solo lo que hace daño duplicar. Crece por necesidad (cada incidente añade su recurso), nunca
 * por inventario — un registro que intenta abarcarlo todo se queda desactualizado en una semana.
 *
 * Cifras medidas con la simulación el 26/07/2026 sobre 3.342 ficheros.
 */
export const RECURSOS_SENSIBLES: RecursoSensible[] = [
  {
    columna: 'seguimiento_url',
    propiedad: 'seguimientoUrl',
    regla: 'guardarrail_compartido',
    moduloGuardarrail: 'lib/convocatoria/seguimientoVigilable',
    porQue:
      'la consumen los sensores VIVOS del radar (detect-oep-llm, detect-notas-convocatoria); escribirla sin comprobar que la página sirve contenido deja la fuente ciega en silencio (T-114/T-125, 6 casos reales)',
  },
  {
    columna: 'fetcher_type',
    propiedad: 'fetcherType',
    regla: 'guardarrail_compartido',
    moduloGuardarrail: 'lib/convocatoria/seguimientoVigilable',
    porQue:
      'decide si una fuente se descarga con navegador (headless) o por HTTP. Medido 26/07: 67 filas en `headless` y CERO escritores en código — se ha tocado a mano. Registrarlo evita que se construya de cero algo que ya existe (pasó en T-125)',
  },
  {
    columna: 'programa_url',
    propiedad: 'programaUrl',
    regla: 'guardarrail_compartido',
    moduloGuardarrail: 'lib/convocatoria/linkCoherence',
    porQue:
      'es el ENLACE del botón más oficial de la landing ("Ver convocatoria en {diario_oficial}") y a la vez la fuente del temario que hashea el Sistema 2 de literalidad de epígrafe. No tenía escritor propio: se editaba a mano desde scripts de construcción, sin comprobar que la URL fuese el documento de esa convocatoria en el boletín que el botón anuncia. Así llegó a producción `policia-nacional` con plazo ABIERTO prometiendo el BOE y llevando al portal de aspirantes en inglés (T-134); medido ese día, 56 de 123 landings activas estaban en la zona ciega del detector',
  },
  {
    columna: 'lifecycle_state',
    propiedad: 'lifecycleState',
    regla: 'trinquete',
    funcionPuerta: 'transition_question_state',
    // 42, no 19 (31/07/2026). No aparecieron 23 escritores nuevos: el detector no reconocía la
    // llamada a `transition_question_state`, así que **los que usaban la vía CORRECTA eran
    // invisibles** y el trinquete se calibró contando solo a los que escribían a pelo. Al añadir
    // la función-puerta salieron todos. El número sirve igual como trinquete —que no crezca—,
    // pero ahora mide lo que decía medir.
    techo: 42,
    guardarrailPropio:
      'función SQL `transition_question_state` + trigger `tg_questions_lifecycle_audit_fallback` (registra cualquier UPDATE directo como `bypass_detected`) — ver CLAUDE.md §Lifecycle',
    porQue:
      'ya tiene invariante física (`is_active` es GENERATED) y audit trail; aquí solo se vigila que no aparezcan escritores nuevos por la puerta de atrás',
  },
  {
    columna: 'article_numbers',
    propiedad: 'articleNumbers',
    regla: 'trinquete',
    techo: 32,
    guardarrailPropio:
      'pipeline `verify:scope` (dump→plan→apply, con clasificador auto_safe vs judgment_gate) — ver docs/runbooks/verificar-epigrafes-scope.md',
    porQue:
      'es el temario SERVIDO: un escritor sin simulación de huérfanas puede dejar preguntas fuera de los tests en silencio. Los 31 primeros son scripts de construcción puntuales, legítimos. El 32.º (26/07/2026) es `scripts/reanclar-preguntas.cjs`: solo QUITA de la lista números explícitamente enumerados en un plan revisado (nunca añade), y lo hace en la misma transacción en la que re-ancla las preguntas de ese artículo fantasma — separarlo en verify:scope dejaría el hueco entre las dos escrituras. Trae su propia simulación de huérfanas (`lib/contenido/reanclarGuardas.js`, 13 tests): bloquea el destino sin scope y la pérdida de temas no declarada, que es justo el fallo silencioso que este trinquete vigila',
  },
]

/** Un fichero de esquema DEFINE columnas, no las escribe. Se detecta por contenido, no por nombre. */
export function esDefinicionDeEsquema(codigo: string): boolean {
  return /\bpgTable\s*\(/.test(codigo)
}

function escapa(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * ¿Este código ESCRIBE el recurso? Cubre las cuatro formas reales del repo.
 *
 * Los cuantificadores van acotados (`{0,N}`) a propósito: sin tope, un `UPDATE` al principio del
 * fichero casaría con una columna mencionada 800 líneas más abajo (falso positivo), y además un
 * `[\s\S]*` sobre ficheros de miles de líneas es un cañón de backtracking.
 */
export function escribeRecurso(codigo: string, recurso: RecursoSensible): boolean {
  if (!codigo || esDefinicionDeEsquema(codigo)) return false
  const col = escapa(recurso.columna)
  const prop = escapa(recurso.propiedad)

  const patrones = [
    // UPDATE … SET … col =
    new RegExp(`\\bUPDATE\\b[\\s\\S]{0,300}?\\bSET\\b[\\s\\S]{0,400}?\\b${col}\\b\\s*=`, 'i'),
    // INSERT INTO tabla ( … col … )
    new RegExp(`\\bINSERT\\s+INTO\\b[\\s\\S]{0,400}?\\b${col}\\b`, 'i'),
    // Drizzle: .set({ … camelCase: … })  ·  .values({ … camelCase: … })
    new RegExp(`\\.(?:set|values)\\(\\s*\\{[\\s\\S]{0,600}?\\b${prop}\\b\\s*:`),
  ]

  // La función-puerta cuenta como escritura: es la vía CORRECTA de tocar el recurso.
  if (recurso.funcionPuerta) {
    patrones.push(new RegExp(`\\b${escapa(recurso.funcionPuerta)}\\s*\\(`, 'i'))
  }
  return patrones.some((re) => re.test(codigo))
}

/** Recursos sensibles que escribe este fichero (vacío si no escribe ninguno). */
export function recursosEscritos(
  codigo: string,
  recursos: RecursoSensible[] = RECURSOS_SENSIBLES,
): string[] {
  return recursos.filter((r) => escribeRecurso(codigo, r)).map((r) => r.columna)
}
