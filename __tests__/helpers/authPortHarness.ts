// Harness de AUTENTICACIÓN para tests — se simula el PUERTO, nunca un proveedor.
//
// ## Por qué existe (30/07/2026)
//
// La app habla con `@/lib/auth`, un puerto con un adaptador por proveedor. Pero la suite
// mockeaba `lib/supabase` —el proveedor concreto— fichero a fichero. Mientras el default fue
// Supabase eso pasó desapercibido; el día que el default se puso en Auth.js (lo que corre en
// producción desde el 03/07) **60 tests se cayeron de golpe**.
//
// El diagnóstico importa más que los 60: llevaban semanas **verdes probando el proveedor que
// ya nadie usa**, así que no cubrían la app real y no habrían detectado una regresión en
// ella. Un test acoplado al proveedor anula justo aquello para lo que existe un puerto.
//
// Este harness invierte eso: simula la INTERFAZ (`AuthClientPort`), así que un test escrito
// con él vale para Supabase, para Auth.js y para el que venga — no hay nada que migrar la
// próxima vez.
//
// ## Uso (el `jest.mock` va en el ÁMBITO DEL MÓDULO: jest lo iza por encima de los imports)
//
//     jest.mock('@/lib/auth', () => require('../helpers/authPortHarness').mockDelPuerto())
//     import { puertoAuth } from '../helpers/authPortHarness'
//
//     beforeEach(() => puertoAuth.reset())
//     puertoAuth.sesionDe({ id: 'u1', email: 'a@b.c' })   // hay sesión
//     puertoAuth.emitir('SIGNED_IN')                      // dispara onAuthStateChange
//     puertoAuth.sinSesion()                              // desloguea
//
// El harness NO conoce Supabase ni Auth.js. Si un test necesita saber cuál hay detrás, ese
// test pertenece al adaptador (`__tests__/lib/auth/`), no a la app.

export interface UsuarioDePrueba {
  id: string
  email: string | null
  fullName?: string | null
  avatarUrl?: string | null
}

export interface SesionDePrueba {
  user: {
    id: string
    email: string | null
    metadata?: { fullName?: string | null; avatarUrl?: string | null }
    /**
     * Objeto CRUDO del proveedor.
     *
     * El puerto lo declara como `raw?: unknown` y `AuthContext` lo usa de verdad
     * (`session.user.raw` → el `User` que expone al resto de la app). Es un **acoplamiento
     * residual**: la app no debería necesitar el objeto del proveedor para funcionar, y
     * mientras lo necesite, cambiar de proveedor exige que el nuevo adaptador rellene `raw`
     * con la misma forma. Se reproduce aquí para que el test cubra la app REAL en vez de una
     * versión idealizada de ella; queda anotado en T-289 como deuda a cerrar.
     */
    raw?: unknown
  }
  accessToken: string
  expiresAt: number | null
}

export type EventoAuth =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'

type Suscriptor = (c: { event: EventoAuth; session: SesionDePrueba | null }) => void

/**
 * El estado vive en `globalThis`, NO en variables de módulo.
 *
 * Motivo concreto: los tests que llaman `jest.resetModules()` (patrón normal para recargar
 * el módulo bajo prueba entre casos) hacen que la factory del `jest.mock` vuelva a evaluar
 * este fichero y cree **una instancia nueva**. El test seguiría apuntando a la instancia
 * vieja: configuraría una sesión en un sitio y el código leería otro, con el fallo apuntando
 * a cualquier parte menos a la causa. Anclarlo al global lo hace inmune al reseteo.
 */
interface EstadoHarness {
  sesion: SesionDePrueba | null
  tokenDisponible: boolean
  suscriptores: Set<Suscriptor>
}
const CLAVE = '__venceAuthPortHarness__'
const g = globalThis as unknown as Record<string, EstadoHarness | undefined>
const estado: EstadoHarness = (g[CLAVE] ??= {
  sesion: null,
  tokenDisponible: true,
  suscriptores: new Set<Suscriptor>(),
})

function emitirInterno(event: EventoAuth, s?: SesionDePrueba | null) {
  const payload = s === undefined ? estado.sesion : s
  // Copia de la lista: un suscriptor que se da de baja dentro del callback (patrón normal al
  // desmontar un componente) no debe romper la iteración.
  for (const cb of Array.from(estado.suscriptores)) cb({ event, session: payload })
}

/**
 * Espías del puerto. Son `jest.fn` para poder afirmar que la app llamó AL PUERTO (y no a un
 * proveedor), que es la propiedad que queremos conservar.
 *
 * La superficie replica `AuthClientPort` entera: si alguien añade un método al puerto y no
 * lo añade aquí, el test que lo use fallará en vez de pasar por casualidad.
 */
export const espiasPuerto = {
  getSession: jest.fn(async () => estado.sesion),
  getUser: jest.fn(async () => estado.sesion?.user ?? null),
  getAccessToken: jest.fn(async () => (estado.tokenDisponible ? estado.sesion?.accessToken : undefined)),
  signOut: jest.fn(async () => {
    estado.sesion = null
    emitirInterno('SIGNED_OUT', null)
  }),
  onAuthStateChange: jest.fn((cb: Suscriptor) => {
    estado.suscriptores.add(cb)
    // La función de baja pasa por un espía propio para poder afirmar el invariante «al
    // desmontar hay que desuscribirse» — sin él, una fuga de suscripciones (listener vivo
    // tras desmontar el componente) no la detectaría nadie.
    return () => {
      espiasPuerto.unsubscribe()
      estado.suscriptores.delete(cb)
    }
  }),
  /** Espía de la función de baja devuelta por `onAuthStateChange`. */
  unsubscribe: jest.fn(),
  refreshSession: jest.fn(async () => estado.sesion),
  updateUser: jest.fn(async () => estado.sesion?.user ?? null),
  signInWithGoogle: jest.fn(async () => ({ success: true })),
  signInWithIdToken: jest.fn(async () => ({ session: estado.sesion, user: estado.sesion?.user ?? null })),
  completeOAuthCallback: jest.fn(async () => estado.sesion),
}

/** Factory para el `jest.mock('@/lib/auth', …)` del test. */
export function mockDelPuerto() {
  return {
    auth: espiasPuerto,
    getAuthClient: () => espiasPuerto,
  }
}

export const puertoAuth = {
  /** Establece la sesión activa (y opcionalmente el token que devolverá el puerto). */
  sesionDe(user: UsuarioDePrueba, opts?: { accessToken?: string; expiresAt?: number | null }): SesionDePrueba {
    // Establecer una sesión implica que el puerto vuelve a entregar token. Sin esto, un
    // `sinToken()` de un test anterior se filtraba al siguiente y lo hacía fallar por un
    // motivo que no era el suyo — dependencia de orden, el peor tipo de test frágil.
    estado.tokenDisponible = true
    estado.sesion = {
      user: {
        id: user.id,
        email: user.email,
        metadata: { fullName: user.fullName ?? null, avatarUrl: user.avatarUrl ?? null },
        // Forma mínima que la app espera encontrar en `raw` (ver nota del tipo).
        raw: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.fullName ?? null, avatar_url: user.avatarUrl ?? null },
          app_metadata: {},
          aud: 'authenticated',
          created_at: '',
        },
      },
      accessToken: opts?.accessToken ?? 'token-de-prueba',
      expiresAt: opts?.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
    }
    return estado.sesion
  },
  /** Deja el puerto sin sesión (sin emitir evento: eso lo decide el test). */
  sinSesion(): void {
    estado.sesion = null
  },
  /** Dispara un cambio de estado hacia los suscriptores, como haría el proveedor real. */
  emitir(event: EventoAuth, s?: SesionDePrueba | null): void {
    emitirInterno(event, s)
  },
  sesionActual: (): SesionDePrueba | null => estado.sesion,
  /** El puerto deja de entregar token (401 transitorio, cooldown del singleflight…). */
  sinToken(): void {
    estado.tokenDisponible = false
  },
  espias: espiasPuerto,
  /** Estado limpio entre tests. Llamar en `beforeEach`. */
  reset(): void {
    estado.sesion = null
    estado.tokenDisponible = true
    estado.suscriptores.clear()
    Object.values(espiasPuerto).forEach((e) => (e as jest.Mock).mockClear())
  },
}
