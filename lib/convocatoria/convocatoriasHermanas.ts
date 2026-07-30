/**
 * lib/convocatoria/convocatoriasHermanas.ts — NÚCLEO PURO: ¿hay que avisar de que esta
 * oposición tiene otra convocatoria viva con un temario distinto?
 *
 * ## Por qué existe (30/07/2026, caso Ana Isabel)
 *
 * Auxiliar Administrativo de la Comunidad de Madrid tiene **dos convocatorias abiertas a la
 * vez con programas distintos**: la de examen octubre 2026 (Windows 10) y la de junio 2027
 * (Windows 11). Se sirven como dos oposiciones separadas ([T-063]) y en el selector se
 * distinguen bien… pero **una vez dentro nada te dice que existe la otra**.
 *
 * Una usuaria estuvo estudiando el temario que no le tocaba y se enteró de casualidad,
 * escribiendo a soporte por otra cosa: *«me he metido en la convocatoria equivocada»*. Eso no
 * es un despiste suyo: la aplicación tenía el dato y no se lo dijo.
 *
 * La decisión de avisar es pura para poder probarla sin base de datos ni navegador. Quién es
 * hermana de quién vive en `oposiciones.grupo_convocatoria` (columna, no fichero: el catálogo
 * está en la base de datos y una copia en código se desincronizaría a la siguiente
 * renovación de convocatoria, que las habrá).
 */

export interface OposicionHermana {
  slug: string
  nombre: string
  /** Fecha de examen, si se conoce. Es lo que de verdad distingue una convocatoria de otra. */
  examDate?: string | Date | null
  /** `true` si es la que la persona tiene seleccionada ahora mismo. */
  actual?: boolean
}

export interface AvisoHermanas {
  mostrar: boolean
  /** Las otras convocatorias (sin la actual). */
  otras: OposicionHermana[]
  motivo: 'ok' | 'sin_grupo' | 'sin_hermanas' | 'sin_actual'
}

/**
 * @param hermanas  TODAS las oposiciones activas del mismo `grupo_convocatoria`, incluida la
 *                  actual (marcada con `actual: true`).
 */
export function decidirAvisoHermanas(hermanas: OposicionHermana[] | null | undefined): AvisoHermanas {
  const lista = (hermanas || []).filter((h) => h && h.slug)
  if (lista.length === 0) return { mostrar: false, otras: [], motivo: 'sin_grupo' }

  const actual = lista.find((h) => h.actual)
  // Sin saber cuál es la suya, el aviso no puede decir «la otra»: callarse es mejor que
  // confundir a quien ya está estudiando.
  if (!actual) return { mostrar: false, otras: [], motivo: 'sin_actual' }

  const otras = lista.filter((h) => h.slug !== actual.slug)
  if (otras.length === 0) return { mostrar: false, otras: [], motivo: 'sin_hermanas' }

  return { mostrar: true, otras, motivo: 'ok' }
}

/** Fecha de examen en formato corto («octubre de 2026»), o null si no se conoce. */
export function etiquetaExamen(fecha: string | Date | null | undefined): string | null {
  if (!fecha) return null
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

/**
 * La fecha de examen SOLO si el nombre no la lleva ya.
 *
 * Los nombres de estas oposiciones suelen incluirla justamente para distinguirlas
 * («…Comunidad de Madrid (examen junio 2027)»), así que añadir «(examen en junio de 2027)»
 * detrás lo dice dos veces seguidas y hace que el aviso parezca escrito por una máquina.
 *
 * Se compara por MES y AÑO, no por la cadena entera: el nombre escribe «junio 2027» y la
 * etiqueta «junio de 2027», y una comparación literal no las reconocería como lo mismo.
 */
export function fechaComplementaria(
  nombre: string,
  fecha: string | Date | null | undefined,
): string | null {
  const etq = etiquetaExamen(fecha)
  if (!etq) return null
  const [mes, , anio] = etq.split(' ')
  const n = String(nombre || '').toLowerCase()
  if (n.includes(mes) && n.includes(anio)) return null // el nombre ya lo dice
  if (n.includes(anio) && /examen/.test(n)) return null // «(examen 2027)» sin mes: tampoco se repite
  return etq
}

/**
 * Texto del aviso. Se construye aquí (y no en el componente) para que se pueda probar y para
 * que diga SIEMPRE lo mismo esté donde esté pintado.
 *
 * No adorna ni vende: nombra el riesgo («temario distinto»), lo que la persona tiene que
 * hacer («asegúrate») y cuál es la otra opción.
 */
export function textoAvisoHermanas(aviso: AvisoHermanas): string | null {
  if (!aviso.mostrar) return null
  const n = aviso.otras.length
  const cabecera =
    n === 1
      ? 'Esta oposición tiene dos convocatorias abiertas con temario distinto.'
      : `Esta oposición tiene ${n + 1} convocatorias abiertas con temario distinto.`
  return `${cabecera} Asegúrate de que tienes seleccionada la convocatoria a la que te presentas.`
}
