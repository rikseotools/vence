// lib/laws/agruparPorTitulo.ts — repartir los artículos de una ley en sus TÍTULOS. (T-327)
//
// PURO: recibe artículos y secciones, devuelve grupos. Sin BD.
//
// ── LOS TRES CASOS QUE HAY QUE RESOLVER, Y NINGUNO ES EL FÁCIL ──────────────────────────────
//
// 1. **La ley NO tiene títulos.** No es la excepción: de 1.036 leyes en temas vivos, **744 no
//    tienen secciones** (medido 28/07, ficha T-064). Así que «agrupar por título» tiene que
//    seguir funcionando cuando no hay ninguno — se devuelve un único grupo sin nombre, que es
//    exactamente la lista plana de siempre.
//
// 2. **La pertenencia se calcula por RANGO NUMÉRICO** (`article_range_start/end`), porque es lo
//    único que guarda `law_sections`. Eso deja fuera a todo lo que no es un número puro.
//
// 3. **Y ahí está el fallo que importa: las DISPOSICIONES.** `DA1`, `DT3`, `DF2`, `preámbulo`…
//    no caen en ningún rango. Si se agrupara sin más, **desaparecerían de la pantalla** y el
//    usuario no podría meterlas en su temario sin que nada le avisara. Van a un grupo propio al
//    final, visible y seleccionable. Perder contenido en silencio es peor que enseñarlo mal.

export interface SeccionEntrada {
  id: string
  /** «I», «Preliminar», «VIII»… tal cual viene de `law_sections.section_number`. */
  sectionNumber: string | null
  title: string
  from: number | null
  to: number | null
}

export interface ArticuloEntrada {
  articleNumber: string
  questionCount: number
}

export interface GrupoArticulos {
  /** `null` en el grupo de los que no caen en ningún título (o si la ley no tiene títulos). */
  seccionId: string | null
  titulo: string | null
  articulos: ArticuloEntrada[]
}

/** Nº de artículo como entero, o `null` si no es un número puro (`DA1`, `55 bis`, `preámbulo`). */
export function numeroDe(articleNumber: string): number | null {
  return /^\s*\d+\s*$/.test(articleNumber) ? parseInt(articleNumber, 10) : null
}

/**
 * Reparte los artículos en sus títulos, respetando el orden en que llegan.
 *
 * @param articulos ya ordenados como se van a pintar
 * @param secciones títulos de la ley (vacío = la ley no tiene estructura)
 */
export function agruparPorTitulo(
  articulos: ArticuloEntrada[],
  secciones: SeccionEntrada[],
): GrupoArticulos[] {
  const utiles = (secciones ?? []).filter(
    (s) => typeof s.from === 'number' && typeof s.to === 'number' && s.from! <= s.to!,
  )

  // Caso 1: sin estructura → un solo grupo, que es la lista plana de siempre.
  if (utiles.length === 0) {
    return articulos.length ? [{ seccionId: null, titulo: null, articulos }] : []
  }

  const grupos = new Map<string, GrupoArticulos>()
  for (const s of utiles) {
    grupos.set(s.id, { seccionId: s.id, titulo: s.title, articulos: [] })
  }
  const sueltos: ArticuloEntrada[] = []

  for (const a of articulos) {
    const n = numeroDe(a.articleNumber)
    // Se busca la sección MÁS ESTRECHA que lo contenga: si dos rangos se solapan (pasa en leyes
    // mal pobladas), meterlo en la primera que casa lo pondría en el título más ancho, que es el
    // menos informativo. Ante datos ambiguos, se elige la respuesta más precisa.
    const dueña =
      n === null
        ? null
        : utiles
            .filter((s) => n >= s.from! && n <= s.to!)
            .sort((x, y) => x.to! - x.from! - (y.to! - y.from!))[0] ?? null

    if (dueña) grupos.get(dueña.id)!.articulos.push(a)
    else sueltos.push(a)
  }

  const salida = utiles
    .map((s) => grupos.get(s.id)!)
    // Un título sin artículos servibles no se pinta: sería una cabecera que no se puede abrir.
    .filter((g) => g.articulos.length > 0)

  // Caso 3: las disposiciones y demás, al final y VISIBLES.
  if (sueltos.length > 0) {
    salida.push({ seccionId: null, titulo: 'Disposiciones y otros', articulos: sueltos })
  }
  return salida
}

/** Todos los artículos de un grupo, para el tick de «añadir el título entero». */
export function articulosDe(grupo: GrupoArticulos): string[] {
  return grupo.articulos.map((a) => a.articleNumber)
}
