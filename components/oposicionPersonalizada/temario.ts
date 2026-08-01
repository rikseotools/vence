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
  articleNumber: string
}

export interface Tema {
  id: string
  titulo: string
  articulos: ArticuloElegido[]
}

export interface Temario {
  nombre: string
  temas: Tema[]
}

/** Clave de identidad de un artículo dentro de un tema: la ley y su número. */
const clave = (a: { lawId: string; articleNumber: string }) => `${a.lawId}::${a.articleNumber}`

export function temaVacio(id: string, indice: number): Tema {
  return { id, titulo: `Tema ${indice}`, articulos: [] }
}

/** Añade un artículo a un tema. Idempotente: repetir no duplica (regla 1). */
export function anadirArticulo(temario: Temario, temaId: string, art: ArticuloElegido): Temario {
  return {
    ...temario,
    temas: temario.temas.map((t) => {
      if (t.id !== temaId) return t
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
  art: { lawId: string; articleNumber: string },
): Temario {
  return {
    ...temario,
    temas: temario.temas.map((t) =>
      t.id === temaId ? { ...t, articulos: t.articulos.filter((a) => clave(a) !== clave(art)) } : t,
    ),
  }
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
): Array<{ lawId: string; shortName: string; articleNumbers: string[] }> {
  const orden: string[] = []
  const porLey = new Map<string, { shortName: string; articleNumbers: string[] }>()
  for (const a of tema.articulos) {
    if (!porLey.has(a.lawId)) {
      porLey.set(a.lawId, { shortName: a.shortName, articleNumbers: [] })
      orden.push(a.lawId)
    }
    porLey.get(a.lawId)!.articleNumbers.push(a.articleNumber)
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

/** Cuántos artículos tiene el temario entero (contando repetidos entre temas: son reales). */
export function totalArticulos(temario: Temario): number {
  return temario.temas.reduce((n, t) => n + t.articulos.length, 0)
}

/**
 * Nombre público: «\<nombre\> by \<Nombre I.\>» (decisión de Manuel, 01/08).
 *
 * La autoría va EN EL NOMBRE a propósito: es lo que sostiene la idea de temarios con seguidores
 * y, sobre todo, **le pone dueño a una etiqueta**. Medido el 30/07: los nombres genéricos
 * («Estudiante», «Renfe», «Administrativo») son justo los que concentran la gente que se apunta
 * y no llega a hacer un test.
 *
 * Se construye con el nombre de pila y las INICIALES del resto — ni el email ni el apellido
 * completo, que son datos personales innecesarios para lo que esto resuelve.
 */
export function nombrePublico(nombreOposicion: string, autor: string | null | undefined): string {
  const base = nombreOposicion.trim()
  const partes = String(autor ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (partes.length === 0) return base
  const pila = partes[0]
  const iniciales = partes
    .slice(1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join('')
  return iniciales ? `${base} by ${pila} ${iniciales}` : `${base} by ${pila}`
}
