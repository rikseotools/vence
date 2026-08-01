// components/oposicionPersonalizada/temario.ts — NÚCLEO PURO del creador de temario propio. (T-327)
//
// Sin React, sin red, sin BD: recibe estado y devuelve estado. Todo lo que decide QUÉ acaba en
// el temario vive aquí, para poder probarlo sin montar la pantalla.
//
// ── LAS REGLAS QUE NO SON OBVIAS Y POR QUÉ ──────────────────────────────────────────────────
//
// 1. **Un artículo no puede estar dos veces en el mismo tema.** Al guardar, cada tema se
//    convierte en filas de `topic_scope` (una por ley, con su array de artículos). Un duplicado
//    ahí no da error: **infla el temario en silencio** y el usuario ve el mismo artículo repetido
//    en sus tests sin saber por qué.
// 2. **El mismo artículo SÍ puede estar en dos temas distintos.** Es legítimo y pasa en los
//    temarios oficiales (una materia transversal que dos temas citan). No se impide.
// 3. **Los artículos se agrupan POR LEY dentro del tema**, que es exactamente la forma de
//    `topic_scope` (`position_type`, `topic_id`, `law_id`, `article_numbers[]`). Guardar la
//    estructura con la forma del destino evita una traducción a medias en el momento de escribir.
// 4. **Un tema vacío no se guarda.** No es un error del usuario —está a medias— pero un tema sin
//    artículos sirve 0 preguntas: aparecería en su temario y al entrar no habría nada.

export interface ArticuloElegido {
  lawId: string
  /** Nombre corto de la ley, para pintarlo sin volver a consultar. */
  shortName: string
  /**
   * Número de artículo, o **`null` = LA LEY ENTERA**.
   *
   * No es un atajo de la interfaz: es el modelo de datos de la casa. En `topic_scope`,
   * `article_numbers IS NULL` significa «toda la ley», y los lectores lo respetan. Guardar «la
   * ley entera» enumerando sus artículos de hoy sería **una foto que envejece**: en cuanto la ley
   * gane un artículo, el temario del usuario dejaría de incluirlo sin que nadie se entere. Con
   * `null`, «entera» sigue siendo entera el año que viene.
   */
  articleNumber: string | null
}

/** ¿Esta entrada representa la ley completa? */
export const esLeyEntera = (a: { articleNumber: string | null }) => a.articleNumber === null

export interface Tema {
  id: string
  titulo: string
  articulos: ArticuloElegido[]
}

export interface Temario {
  nombre: string
  temas: Tema[]
}

/** Clave de identidad dentro de un tema: la ley y su número (o la marca de ley entera). */
const clave = (a: { lawId: string; articleNumber: string | null }) =>
  `${a.lawId}::${a.articleNumber ?? '*'}`

export function temaVacio(id: string, indice: number): Tema {
  return { id, titulo: `Tema ${indice}`, articulos: [] }
}

/**
 * Añade un artículo (o la ley entera) a un tema. Idempotente: repetir no duplica (regla 1).
 *
 * ── LA LEY ENTERA Y LOS ARTÍCULOS SUELTOS NO PUEDEN CONVIVIR ────────────────────────────────
 *
 * Son dos formas de decir lo mismo y tenerlas a la vez hace que el temario **mienta sobre sí
 * mismo**: al guardar habría que elegir una, y la que se descartara dejaría al usuario con un
 * temario distinto del que construyó. Así que:
 *
 *  · añadir **la ley entera** ABSORBE los artículos sueltos de esa ley que ya hubiera (ya están
 *    dentro; dejarlos sería ruido que además se pinta dos veces);
 *  · añadir **un artículo** de una ley que ya está entera **no hace nada** (ya está incluido).
 *    Y no es un fallo del usuario: es que pedir algo que ya tiene no debería cambiarle nada.
 */
export function anadirArticulo(temario: Temario, temaId: string, art: ArticuloElegido): Temario {
  return {
    ...temario,
    temas: temario.temas.map((t) => {
      if (t.id !== temaId) return t
      const yaEntera = t.articulos.some((a) => a.lawId === art.lawId && esLeyEntera(a))

      if (esLeyEntera(art)) {
        if (yaEntera) return t
        // La ley entera se queda, y los sueltos de esa ley se van (quedan absorbidos).
        return { ...t, articulos: [...t.articulos.filter((a) => a.lawId !== art.lawId), art] }
      }

      if (yaEntera) return t
      if (t.articulos.some((a) => clave(a) === clave(art))) return t
      return { ...t, articulos: [...t.articulos, art] }
    }),
  }
}

/** Añade VARIOS de una vez (elegir una ley entera, o un título). Misma regla anti-duplicado. */
export function anadirArticulos(
  temario: Temario,
  temaId: string,
  arts: ArticuloElegido[],
): Temario {
  return arts.reduce((acc, a) => anadirArticulo(acc, temaId, a), temario)
}

export function quitarArticulo(
  temario: Temario,
  temaId: string,
  art: { lawId: string; articleNumber: string | null },
): Temario {
  return {
    ...temario,
    temas: temario.temas.map((t) =>
      t.id === temaId ? { ...t, articulos: t.articulos.filter((a) => clave(a) !== clave(art)) } : t,
    ),
  }
}

/** Quita VARIOS de golpe (desmarcar un título entero, o «desmarcar todos»). */
export function quitarArticulos(
  temario: Temario,
  temaId: string,
  arts: Array<{ lawId: string; articleNumber: string | null }>,
): Temario {
  return arts.reduce((acc, a) => quitarArticulo(acc, temaId, a), temario)
}

export function renombrarTema(temario: Temario, temaId: string, titulo: string): Temario {
  return {
    ...temario,
    temas: temario.temas.map((t) => (t.id === temaId ? { ...t, titulo } : t)),
  }
}

export function quitarTema(temario: Temario, temaId: string): Temario {
  return { ...temario, temas: temario.temas.filter((t) => t.id !== temaId) }
}

/**
 * Agrupa los artículos de un tema POR LEY — la forma exacta de `topic_scope` (regla 3).
 * El orden de las leyes es el de su primera aparición: lo que el usuario construyó.
 */
export function agruparPorLey(
  tema: Tema,
): Array<{ lawId: string; shortName: string; articleNumbers: string[] | null }> {
  const orden: string[] = []
  const porLey = new Map<string, { shortName: string; articleNumbers: string[] | null }>()
  for (const a of tema.articulos) {
    if (!porLey.has(a.lawId)) {
      porLey.set(a.lawId, { shortName: a.shortName, articleNumbers: [] })
      orden.push(a.lawId)
    }
    const g = porLey.get(a.lawId)!
    // `null` gana y se queda: es «toda la ley», que es exactamente lo que espera `topic_scope`.
    if (esLeyEntera(a)) g.articleNumbers = null
    else if (g.articleNumbers !== null) g.articleNumbers.push(a.articleNumber as string)
  }
  return orden.map((lawId) => ({ lawId, ...porLey.get(lawId)! }))
}

export interface Problema {
  campo: 'nombre' | 'temas' | 'tema'
  temaId?: string
  mensaje: string
}

/**
 * ¿Se puede guardar? Devuelve los problemas, no un booleano: la pantalla tiene que poder decir
 * QUÉ falta, y «guardar está deshabilitado» sin motivo es la peor forma de pedir algo.
 */
export function problemasParaGuardar(temario: Temario): Problema[] {
  const problemas: Problema[] = []
  const nombre = temario.nombre.trim()
  if (!nombre) {
    problemas.push({ campo: 'nombre', mensaje: 'Ponle un nombre a tu oposición.' })
  } else if (nombre.length < 3) {
    problemas.push({ campo: 'nombre', mensaje: 'El nombre es demasiado corto.' })
  }

  const conArticulos = temario.temas.filter((t) => t.articulos.length > 0)
  if (conArticulos.length === 0) {
    problemas.push({
      campo: 'temas',
      mensaje: 'Añade al menos un artículo a un tema: un temario vacío no serviría preguntas.',
    })
  }
  // Un tema a medias no impide guardar (regla 4), pero se avisa de que se quedará fuera.
  for (const t of temario.temas) {
    if (t.articulos.length === 0 && temario.temas.length > 1) {
      problemas.push({
        campo: 'tema',
        temaId: t.id,
        mensaje: `«${t.titulo}» está vacío y no se guardará.`,
      })
    }
    if (!t.titulo.trim()) {
      problemas.push({ campo: 'tema', temaId: t.id, mensaje: 'Este tema no tiene título.' })
    }
  }
  return problemas
}

/** ¿Bloquea el guardado? Solo el nombre y el «no hay ni un artículo». Lo demás es aviso. */
export function puedeGuardar(temario: Temario): boolean {
  return !problemasParaGuardar(temario).some((p) => p.campo === 'nombre' || p.campo === 'temas')
}

/**
 * ¿Está este artículo ya en el tema?
 *
 * Es lo que marca la casilla en la pantalla, y va contra el TEMARIO en vez de contra un estado
 * de selección aparte. Llevar dos listas —«lo marcado» y «lo que hay en el tema»— es la forma
 * clásica de que se separen: basta con quitar un artículo desde el panel de la derecha para que
 * la casilla de la izquierda siga marcada, y entonces la pantalla miente sobre lo que has creado.
 *
 * Cuenta como presente si está la LEY ENTERA: pedir el art. 24 de una ley que ya entra completa
 * no es «no lo tienes», es que ya está dentro.
 */
export function estaEnTema(
  tema: Tema | undefined | null,
  lawId: string,
  articleNumber: string,
): boolean {
  if (!tema) return false
  return tema.articulos.some(
    (a) => a.lawId === lawId && (esLeyEntera(a) || a.articleNumber === articleNumber),
  )
}

/** Cuántos de esos artículos ya están en el tema. Para el tick de un título («todos/algunos»). */
export function cuantosEnTema(
  tema: Tema | undefined | null,
  lawId: string,
  articleNumbers: string[],
): number {
  return articleNumbers.filter((n) => estaEnTema(tema, lawId, n)).length
}

/** Cuántos artículos tiene el temario entero (contando repetidos entre temas: son reales). */
export function totalArticulos(temario: Temario): number {
  return temario.temas.reduce((n, t) => n + t.articulos.length, 0)
}

// El nombre público vive en `lib/` porque lo comparten la pantalla y el SERVIDOR (al fijar la
// oposición objetivo compone el nombre que se verá en la cabecera). Se reexporta para no cambiar
// los imports de quien ya lo usaba desde aquí.
export { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'
