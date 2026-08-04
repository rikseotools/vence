// lib/oposicionPersonalizada/enlaceEditor.ts — llevar al editor SIN perder de vista cuál es. [T-523]
//
// ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────────────────────
//
// Cuando una oposición personalizada existe pero está vacía, la pantalla ya no da 404: dice qué
// pasa y ofrece «Ir al editor del temario» (`AvisoTemarioVacio`, [T-508]). Pero ese enlace iba a
// `/oposicion-personalizada` a secas, así que el usuario aterrizaba en la LISTA de sus
// oposiciones y tenía que volver a localizar la suya y pulsarla. Venía de pulsar su temario: ya
// había dicho cuál era.
//
// El id viaja ahora en la URL y el editor la abre directamente. Es la parte de [T-523] que
// pedía «conservando el contexto de qué oposición es».
//
// ── POR QUÉ ESTO ES UN MÓDULO Y NO DOS PLANTILLAS ───────────────────────────────────────────
//
// Porque hay DOS extremos que tienen que estar de acuerdo —quien escribe la URL
// (`AvisoTemarioVacio`) y quien la lee (`CreadorTemario`)— y son ficheros distintos que nadie
// edita a la vez. Escribir `?editar=` a mano en los dos sitios es la forma conocida de que un
// día uno diga `?editar` y el otro lea `?edit`. Aquí el nombre del parámetro se declara UNA vez.

/** Nombre del parámetro. No lo escribas a mano en ningún otro sitio. */
export const PARAM_EDITAR = 'editar'

/**
 * Enlace al editor del temario. Con `id`, el editor abre esa oposición; sin él, la lista.
 *
 * El id se normaliza a hex sin guiones porque las dos formas circulan por la app: las rutas de
 * `/oposicion-personalizada/[id]/**` lo reciben ya sin guiones, y el UUID de `custom_oposiciones`
 * los lleva. Un id que no sea hex de 32 se descarta en vez de propagarse: preferimos mandar al
 * editor sin contexto que construir una URL con basura dentro.
 */
export function enlaceEditor(id?: string | null): string {
  const limpio = String(id ?? '').replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(limpio)) return '/oposicion-personalizada'
  return `/oposicion-personalizada?${PARAM_EDITAR}=${limpio}`
}

/**
 * Lee de la query cuál hay que abrir. Devuelve `null` si no viene o si no es un id creíble.
 *
 * Acepta la cadena con o sin `?` inicial para poder llamarla con `window.location.search` tal
 * cual, que es como llega en el cliente.
 */
export function idAEditarDesdeUrl(search?: string | null): string | null {
  const crudo = String(search ?? '')
  const qs = crudo.startsWith('?') ? crudo.slice(1) : crudo
  let valor: string | null = null
  try {
    valor = new URLSearchParams(qs).get(PARAM_EDITAR)
  } catch {
    return null
  }
  const limpio = String(valor ?? '').replace(/-/g, '')
  return /^[0-9a-f]{32}$/i.test(limpio) ? limpio : null
}
