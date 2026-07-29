// Vence Sim — SELECCIÓN de journeys. Parte pura: qué se corre y cuándo.
//
// Existe para que "verificar un release" no dependa de una lista escrita a mano en el script
// de despliegue (que sería un silo, y se quedaría vieja al añadir journeys). Cada journey
// declara si vigila algo que un despliegue puede romper; el verificador pregunta aquí.

import type { Journey } from './journey'

/** Filtro por nombre (subcadena), como el argumento del runner. */
export function porNombre<T extends { name: string }>(journeys: T[], filtro: string): T[] {
  if (!filtro) return journeys
  return journeys.filter(j => j.name.includes(filtro))
}

/**
 * Los que deben correr tras publicar una versión: los que declaran `postDeploy`.
 *
 * Se marcan en el journey y no en el script del proveedor porque el despliegue cambia de casa
 * (AWS hoy, koigrid mañana) y la lista no debería mudarse con él.
 */
export function paraVerificarRelease<T extends { postDeploy?: boolean }>(journeys: T[]): T[] {
  return journeys.filter(j => j.postDeploy === true)
}

/**
 * Resuelve la selección del runner a partir de sus argumentos.
 *
 * `--post-deploy` gana al filtro por nombre: es un modo, no un texto de búsqueda.
 */
export function seleccionar(
  journeys: Journey[],
  opts: { filtro?: string; soloPostDeploy?: boolean },
): Journey[] {
  if (opts.soloPostDeploy) return paraVerificarRelease(journeys)
  return porNombre(journeys, opts.filtro ?? '')
}

/** Lee los argumentos del runner (puro: recibe el array, no toca `process`). */
export function leerArgs(argv: string[]): { filtro: string; soloPostDeploy: boolean } {
  const soloPostDeploy = argv.includes('--post-deploy')
  const filtro = argv.find(a => !a.startsWith('--')) ?? ''
  return { filtro, soloPostDeploy }
}
