/**
 * @jest-environment node
 */
// T-434 — el navegador NO puede seguir mandando una identidad que no es la suya.
//
// ## Qué fija este fichero y por qué no basta con los unitarios
//
// `decidirIdentidadAjena` tiene sus unitarios y decide bien. Pero el defecto **nunca estuvo en
// la decisión**: estaba en que nadie la tomaba. El pre-hydrate resucita el id de la sesión
// Supabase legacy de `localStorage`, `INITIAL_SESSION` llega después con el id bueno, y hasta el
// 05/08/2026 nada comparaba los dos. Medido: **182 personas en 14 días**, 180 de ellas con
// identidad verificada (o sea, sanas), 0 con fila en `user_profiles` bajo el id que rebotaba, y
// **1.920 de los 401 de `/api/v2/user-stats` traían el id por el query string y no por token**.
//
// El modo de fallo que este fichero impide es el más silencioso de todos y ya ocurrió aquí
// ([T-443], punto 1): un commit rancio deja el módulo y sus tests en `main` y **borra la llamada**.
// El arreglo parece desplegado y no hace nada. Con el cableado borrado, los 16 unitarios de
// `sesionFantasma` siguen en verde y la simulación es la única que lo vería… si alguien la corre.
//
// ⚠️ **Esto es un guardarraíl de TEXTO: comprueba que el cableado ESTÁ, no que FUNCIONE.** La
// prueba de ejecución es `npm run sim:sesion-fantasma` (navegador real, medida antes del rescate
// tardío de 15 s). Las dos capas son distintas y ninguna sustituye a la otra.

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const CONTEXT = readFileSync(join(ROOT, 'contexts/AuthContext.tsx'), 'utf8')
const NUCLEO = readFileSync(join(ROOT, 'lib/auth/sesionFantasma.ts'), 'utf8')
const ALMACEN = readFileSync(join(ROOT, 'lib/auth/legacySupabaseStorage.ts'), 'utf8')
const ADAPTER = readFileSync(join(ROOT, 'lib/auth/adapters/authjsAdapter.ts'), 'utf8')
const CLIENTE = readFileSync(join(ROOT, 'lib/observability/client.ts'), 'utf8')
const REGLAS = readFileSync(join(ROOT, 'backend/src/alerts/alert-rules.ts'), 'utf8')
const SIM = readFileSync(join(ROOT, 'scripts/sim/sim-sesion-fantasma.ts'), 'utf8')

describe('la decisión está CABLEADA (sin esto, el arreglo existe y no lo llama nadie)', () => {
  it('AuthContext importa y llama al núcleo puro', () => {
    expect(CONTEXT).toMatch(/decidirIdentidadAjena.*from '@\/lib\/auth\/sesionFantasma'/s)
    expect(CONTEXT).toMatch(/decidirIdentidadAjena\(\{/)
  })

  it('compara el id PRE-HIDRATADO con el de la SESIÓN — los dos, o no compara nada', () => {
    const llamada = CONTEXT.slice(
      CONTEXT.indexOf('decidirIdentidadAjena({'),
      CONTEXT.indexOf('decidirIdentidadAjena({') + 220,
    )
    expect(llamada).toMatch(/idPrehidratado:\s*idPrehidratadoRef\.current/)
    expect(llamada).toMatch(/idSesion:\s*newUser\.id/)
  })

  it('el pre-hydrate ANOTA de quién es el rastro (sin eso no hay nada que comparar)', () => {
    // Los DOS caminos que resucitan un usuario de `localStorage` tienen que anotarlo: el
    // pre-hydrate normal y el rescate del timeout de 12 s. Si uno se olvida, ese camino vuelve
    // a dejar entrar una identidad ajena sin que nadie la compare.
    const anotaciones = CONTEXT.match(/idPrehidratadoRef\.current\s*=\s*legacy\.id/g) ?? []
    expect(anotaciones.length).toBeGreaterThanOrEqual(2)
    expect(CONTEXT).toMatch(/readLegacySupabaseUser\(\)/)
  })

  it('al descartar se suelta el BLOB LEGACY, que es lo que resucita al fantasma', () => {
    const bloque = CONTEXT.slice(
      CONTEXT.indexOf('if (identidad.descartar)'),
      CONTEXT.indexOf('if (identidad.descartar)') + 700,
    )
    expect(bloque).toMatch(/clearLegacySupabaseSession\(\)/)
    expect(bloque).toMatch(/clearCachedProfile\(\)/)
    // Si no se olvida la marca, la siguiente rotación volvería a creerse el rastro ya soltado.
    expect(bloque).toMatch(/idPrehidratadoRef\.current\s*=\s*null/)
  })

  it('deja rastro observable: es la ÚNICA señal del caso (el servidor lo ve todo sano)', () => {
    expect(CONTEXT).toMatch(/eventType:\s*'auth_identidad_ajena_descartada'/)
    expect(CLIENTE).toMatch(/\|\s*'auth_identidad_ajena_descartada'/)
  })

  it('la señal nace VIGILADA (un evento sin regla es un evento que nadie mira)', () => {
    expect(REGLAS).toMatch(/event_type = 'auth_identidad_ajena_descartada'/)
    expect(REGLAS).toMatch(/RULE_IDENTIDAD_AJENA_NO_DRENA as AlertRule/)
  })
})

describe('UN SOLO criterio de cuál es el rastro legacy', () => {
  it('la expresión vive en un único fichero', () => {
    expect(ALMACEN).toMatch(/export const LEGACY_SB_KEY_RE/)
    // Nadie más la redefine: dos puertas con criterios distintos no protegen, se contradicen.
    for (const [nombre, src] of [
      ['AuthContext', CONTEXT],
      ['authjsAdapter', ADAPTER],
    ] as const) {
      expect(`${nombre}:${/const LEGACY_SB_KEY_RE\s*=/.test(src)}`).toBe(`${nombre}:false`)
    }
  })

  // Han llegado a convivir TRES copias de esta fórmula en el repo (dos en AuthContext), y todas
  // se olvidaban del sufijo `-token`. Se prohíbe la forma, no una escritura concreta.
  it('AuthContext ya NO compone la clave a mano (ninguna de sus formas)', () => {
    expect(CONTEXT).not.toMatch(/`sb-\$\{[^`]*\}-auth`/)
    expect(CONTEXT).not.toMatch(/localStorage\.removeItem\(`sb-/)
  })

  it('el adapter usa el módulo compartido para leer y para borrar', () => {
    expect(ADAPTER).toMatch(/from '\.\.\/legacySupabaseStorage'/)
    expect(ADAPTER).toMatch(/clearLegacySupabaseSession\(\)/)
  })

  it('NUNCA se borra el `code_verifier` de PKCE (dejaría el login a medias)', () => {
    // El `$` final de la expresión es lo único que lo impide: si alguien lo quita, un login por
    // Google que pase por aquí se queda sin poder completar el intercambio.
    const re = /^sb-.*-auth(-token)?$/
    expect(re.test('sb-auth-auth')).toBe(true)
    expect(re.test('sb-auth-auth-token')).toBe(true)
    expect(re.test('sb-auth-auth-code-verifier')).toBe(false)
    expect(ALMACEN).toMatch(/-auth\(-token\)\?\$\//)
  })
})

describe('la simulación sigue midiendo lo que dice medir', () => {
  it('el blob del fixture lleva `access_token` (sin él, supabase-js lo borra antes de nacer)', () => {
    expect(SIM).toMatch(/access_token:/)
    expect(SIM).toMatch(/expires_at:/)
  })

  // CADA caso mide en su ventana porque los dos arreglos actúan en momentos distintos, y una
  // sola espera deja a uno sin poder discriminar. Ya se ha fallado en las dos direcciones: 6 s
  // da rojo falso en el caso sin sesión (ahí el cliente conserva el perfil a propósito) y 22 s
  // daría verde falso en el de identidad ajena (a esa altura el código viejo también ha
  // limpiado). Si alguien las unifica «por simplificar», una de las dos deja de probar nada.
  it('el caso de identidad ajena mide tras el veredicto y ANTES del rescate tardío', () => {
    const m = SIM.match(/const VENTANA_TRAS_VEREDICTO_MS = ([\d_]+)/)
    expect(m).not.toBeNull()
    const ventana = Number(String(m?.[1]).replace(/_/g, ''))
    expect(ventana).toBeGreaterThan(6_000)
    expect(ventana).toBeLessThan(15_000)
  })

  it('el caso sin sesión espera a que venzan los DOS reintentos (si no, rojo falso)', () => {
    const m = SIM.match(/const VENTANA_TRAS_REINTENTOS_MS = ([\d_]+)/)
    expect(m).not.toBeNull()
    expect(Number(String(m?.[1]).replace(/_/g, ''))).toBeGreaterThan(15_000)
  })

  it('el caso «sin sesión» sigue siendo un caso de pleno derecho (lo cableó otra sesión)', () => {
    expect(SIM).toMatch(/al fantasma se le suelta/)
    expect(SIM).not.toMatch(/anotaPendiente/)
  })

  it('conserva el caso del usuario SANO: sin ese contraste solo probaría la mitad que no duele', () => {
    expect(SIM).toMatch(/al usuario SANO no se le toca/)
  })
})

describe('el núcleo no se ha vuelto permisivo', () => {
  it('sigue exigiendo que HAYA sesión para opinar', () => {
    expect(NUCLEO).toMatch(/if \(!e\?\.idSesion\) return \{ descartar: false, motivo: 'sin_sesion' \}/)
  })
})
