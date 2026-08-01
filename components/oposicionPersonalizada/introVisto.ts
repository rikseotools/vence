// components/oposicionPersonalizada/introVisto.ts — ¿hay que enseñar la explicación? (T-327)
//
// Núcleo PURO: recibe lo que hay guardado y devuelve una decisión. Sin React y sin tocar
// `localStorage` directamente, para poder probar los casos raros (almacenamiento bloqueado,
// valor corrupto) sin navegador.
//
// ── POR QUÉ NO VA EN LA BASE DE DATOS ───────────────────────────────────────────────────────
//
// La casa tiene las dos formas y no son intercambiables: la barra de meta diaria se oculta con
// una columna de `user_profiles` **porque es una preferencia de cuenta** (si la apagas, la
// quieres apagada en todos tus dispositivos). Esto es otra cosa: es «ya he leído para qué sirve
// esta pantalla». Un dato de una sola vez, sin valor fuera de este navegador y que no merece una
// migración ni un viaje al servidor en cada carga.
//
// ── LO QUE SÍ IMPORTA: FALLAR HACIA ENSEÑARLO ───────────────────────────────────────────────
//
// Si `localStorage` no está disponible (modo privado, permisos, cuota llena), la decisión es
// **enseñar la explicación**. Equivocarse por enseñar de más molesta un segundo; equivocarse por
// esconderla deja al usuario delante de un buscador de leyes sin saber qué hace ahí.

/** Clave por usuario: dos cuentas en el mismo navegador no comparten el «ya visto». */
export function claveIntro(userId: string | null | undefined): string {
  const uid = String(userId ?? '').trim()
  return uid ? `oposicion_personalizada_intro_visto:${uid}` : 'oposicion_personalizada_intro_visto'
}

/** El único valor que cuenta como «ya lo he leído». Cualquier otra cosa es basura → se enseña. */
export const MARCA_VISTO = '1'

/**
 * ¿Se enseña la explicación?
 * @param guardado lo que había en el almacén (o `null` si no había nada o no se pudo leer)
 */
export function debeMostrarIntro(guardado: string | null | undefined): boolean {
  return guardado !== MARCA_VISTO
}

/** Lee la marca sin que un almacén roto tumbe la pantalla. `null` = no se sabe → se enseña. */
export function leerMarca(
  almacen: Pick<Storage, 'getItem'> | null | undefined,
  userId: string | null | undefined,
): string | null {
  if (!almacen) return null
  try {
    return almacen.getItem(claveIntro(userId))
  } catch {
    return null
  }
}

/** Guarda «ya visto». Devuelve si se pudo: quien llame decide si le importa (aquí, no). */
export function marcarVisto(
  almacen: Pick<Storage, 'setItem'> | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!almacen) return false
  try {
    almacen.setItem(claveIntro(userId), MARCA_VISTO)
    return true
  } catch {
    // Almacenamiento lleno o bloqueado. Se cierra igual en esta sesión y volverá a salir la
    // próxima vez: molesto, pero muy preferible a que el botón de cerrar no haga nada.
    return false
  }
}
