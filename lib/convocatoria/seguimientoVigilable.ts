// Wrapper tipado sobre `seguimientoVigilable.cjs`. La lógica vive en el .cjs porque
// `scripts/health-sweep.cjs` la requiere con `node` pelado; aquí solo se le pone tipo para el
// resto de la app. Una sola fuente de verdad (misma convención que `seguimientoUrlSalud.ts`).

/* eslint-disable @typescript-eslint/no-var-requires */
const impl = require('./seguimientoVigilable.cjs') as {
  clasificarVigilancia: (entrada: EntradaVigilancia) => DiagnosticoVigilancia
  verificarUrlCandidata: (
    entrada: EntradaVigilancia & { anclas?: string[] },
  ) => DiagnosticoVigilancia & { anclasEncontradas: string[] }
  UMBRAL_CIEGA: number
  UMBRAL_DUDOSO: number
}

/** Niveles de diagnóstico. `ok` = el cron puede vigilar de verdad; el resto, no. */
export type NivelVigilancia =
  | 'ok'
  /** El fetch falló o devolvió !2xx. RUIDOSO: ya visible como `seguimiento_change_status='error'`. */
  | 'fetch_error'
  /** 200 con cuerpo de bloqueo de WAF. */
  | 'bloqueo_waf'
  /** 200 y la página declara estar en desuso / trasladada. */
  | 'pagina_en_desuso'
  /** 200 y solo hay una redirección por JS que no llega a destino. */
  | 'redireccion_sin_destino'
  /** 200 y el cuerpo es una pantalla de error de la aplicación. */
  | 'error_aplicacion'
  /** 200 y casi nada de texto: SPA cuyo contenido carga por JS → hash congelado. */
  | 'shell_sin_contenido'
  /** 200 con poco texto: puede ser página real corta. Cola de revisión. */
  | 'contenido_dudoso'
  /** Solo en `verificarUrlCandidata`: hay contenido pero no menciona el proceso. */
  | 'sin_anclas'

export interface EntradaVigilancia {
  /** Código HTTP del último check (0 si el fetch ni llegó). */
  httpStatus?: number | null
  /** `error_message` del último check, si lo hubo. */
  error?: string | null
  /** TEXTO EXTRAÍDO (no el HTML). El detector le pasa `content_preview`. */
  texto?: string | null
}

export interface DiagnosticoVigilancia {
  /** `true` solo si el cron puede detectar cambios reales en esa URL. */
  vigilable: boolean
  nivel: NivelVigilancia
  /** `error` = ciega y SILENCIOSA (accionable). `warn` = cola de revisión o fallo ya visible. */
  severidad: 'error' | 'warn' | 'ok'
  motivo: string
}

export const clasificarVigilancia = impl.clasificarVigilancia
export const verificarUrlCandidata = impl.verificarUrlCandidata
export const UMBRAL_CIEGA = impl.UMBRAL_CIEGA
export const UMBRAL_DUDOSO = impl.UMBRAL_DUDOSO
