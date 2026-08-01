// backend/src/fraud-sweep/pareja-farmeo.ts — ESPEJO de lib/security/parejaFarmeo.js. (T-372)
//
// ⚠️ El backend compila con `rootDir: src` y NO puede importar `lib/` de la raíz, así que la
// lógica está REPLICADA. Un espejo desincronizado es peor que no tenerlo: el mismo equipo se
// clasificaría distinto según quién mire —el panel y el CLI por un lado, la alerta nocturna por
// otro—. Lo impide `__tests__/backend/fraudSweepParejaParity.test.ts`, que los compara POR
// COMPORTAMIENTO sobre los equipos reales de producción.
//
// El porqué del detector, la aritmética del punto ciego y la calibración están en el núcleo:
// no se repiten aquí para que no diverjan también los comentarios.

export const TOPE_FREE = 25
export const MARGEN_CLAVADA = 1
export const MIN_DIAS = 3
export const MIN_PROPORCION = 0.5

export interface CuentaDia { userId: string; preguntas: number }
export interface DiaEquipo { fecha: string; cuentas: CuentaDia[] }
export interface Opciones { tope?: number; margen?: number; minDias?: number; minProporcion?: number }
export interface VeredictoEquipo {
  veredicto: 'farmeo' | 'revisar' | 'normal'
  diasClavados: number
  diasActivos: number
  proporcion: number
  motivo: string
}

export function estaClavada(preguntas: number, tope = TOPE_FREE, margen = MARGEN_CLAVADA): boolean {
  return Number(preguntas) >= tope - margen
}

export function clasificarDia(cuentas: CuentaDia[] | null | undefined, opts: Opciones = {}) {
  const { tope = TOPE_FREE, margen = MARGEN_CLAVADA } = opts
  const activas = (cuentas || []).filter((c) => Number(c && c.preguntas) > 0)
  const clavadas = activas.filter((c) => estaClavada(c.preguntas, tope, margen))
  return {
    clavadas: clavadas.length,
    activas: activas.length,
    todasClavadas: activas.length >= 2 && clavadas.length === activas.length,
  }
}

export function clasificarEquipo(dias: DiaEquipo[] | null | undefined, opts: Opciones = {}): VeredictoEquipo {
  const { minDias = MIN_DIAS, minProporcion = MIN_PROPORCION } = opts
  const evaluados = (dias || []).map((d) => clasificarDia(d && d.cuentas, opts))
  const diasActivos = evaluados.filter((e) => e.activas > 0).length
  const diasClavados = evaluados.filter((e) => e.todasClavadas).length
  const proporcion = diasActivos ? diasClavados / diasActivos : 0

  const base = { diasClavados, diasActivos, proporcion: Number(proporcion.toFixed(2)) }
  if (diasClavados < minDias) {
    return { ...base, veredicto: 'normal', motivo: `solo ${diasClavados} día(s) con todas las cuentas al tope` }
  }
  if (proporcion < minProporcion) {
    return {
      ...base,
      veredicto: 'revisar',
      motivo: `${diasClavados} días al tope pero solo el ${Math.round(proporcion * 100)}% de sus ${diasActivos} días activos`,
    }
  }
  return {
    ...base,
    veredicto: 'farmeo',
    motivo: `${diasClavados} de ${diasActivos} días activos con TODAS las cuentas al tope (${Math.round(proporcion * 100)}%)`,
  }
}

export function gravedad(v: VeredictoEquipo | null | undefined): 'high' | 'medium' {
  if (!v || v.veredicto !== 'farmeo') return 'medium'
  return v.diasClavados >= 8 ? 'high' : 'medium'
}
