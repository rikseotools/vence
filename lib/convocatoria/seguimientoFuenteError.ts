// Wrapper tipado sobre `seguimientoFuenteError.cjs`. La lógica vive en el .cjs porque
// `scripts/health-sweep.cjs` la requiere con `node` pelado; aquí solo se le pone tipo para el
// resto de la app. Una sola fuente de verdad (misma convención que seguimientoUrlSalud.ts).
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./seguimientoFuenteError.cjs') as {
  diagnosticarSeguimientoError: (entrada: {
    estadoProceso?: string | null
    seguimientoUrl?: string | null
  }) => DiagnosticoSeguimientoError
}

export interface DiagnosticoSeguimientoError {
  severidad: 'error' | 'warn'
  motivo: string
}

export const diagnosticarSeguimientoError = impl.diagnosticarSeguimientoError
