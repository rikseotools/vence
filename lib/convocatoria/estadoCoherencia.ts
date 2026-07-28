// Wrapper tipado sobre `estadoCoherencia.cjs`. La lógica vive en el .cjs porque la requieren
// `scripts/audit-estados-convocatoria.cjs` y `scripts/health-sweep.cjs` con `node` pelado; aquí
// solo se le pone tipo para la app y el backend. Una sola fuente de verdad (misma convención que
// `seguimientoUrlSalud` y `lib/backlog/pushGuard`).

// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./estadoCoherencia.cjs') as {
  detectarIncoherenciasEstado: (o: OposicionEstado, hoy: string) => IncoherenciaEstado[]
  abiertaPorFechas: (o: OposicionEstado, hoy: string) => boolean
  catalogadaVisible: (o: OposicionEstado, hoy: string) => boolean
  anioMaxCitado: (texto?: string | null) => number | null
  hoyMadrid: (now?: Date) => string
  POST_EXAMEN: Set<string>
  CATALOGADA_STALE_DAYS: number
}

/** Fila de `oposiciones_ssot` con lo mínimo para auditar la coherencia del estado. */
export interface OposicionEstado {
  slug?: string
  is_active?: boolean | null
  estado_proceso?: string | null
  inscription_start?: string | null
  inscription_deadline?: string | null
  exam_date?: string | null
  exam_date_approximate?: boolean | null
  seguimiento_url?: string | null
  seguimiento_last_checked?: string | null
  /** Referencia de boletín en texto libre; de aquí sale el año de la convocatoria descrita. */
  boe_reference?: string | null
  boe_publication_date?: string | null
}

export interface IncoherenciaEstado {
  /** `error` = contradicción clara · `warn` = sospecha o dato incompleto. */
  severidad: 'error' | 'warn'
  /** Identificador estable de la regla que saltó (para agrupar/medir). */
  regla: string
  mensaje: string
}

export const detectarIncoherenciasEstado = impl.detectarIncoherenciasEstado
export const abiertaPorFechas = impl.abiertaPorFechas
export const catalogadaVisible = impl.catalogadaVisible
export const anioMaxCitado = impl.anioMaxCitado
export const hoyMadrid = impl.hoyMadrid
export const POST_EXAMEN = impl.POST_EXAMEN
export const CATALOGADA_STALE_DAYS = impl.CATALOGADA_STALE_DAYS
