/**
 * La marca de simulación ETIQUETA, jamás AUTORIZA. (T-434, 01/08/2026)
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
 *
 * Al verificar el despliegue de T-434, el canario cantó «2 usuarios curados» y los dos eran
 * corridas de nuestra propia simulación. Una simulación con identidad recorre la aplicación DE
 * VERDAD, así que sus eventos son indistinguibles de los de una persona: el canario informaba de
 * progreso donde no había ninguno, y la alerta `sesion_sin_email` —que dispara a la primera—
 * saltaba en cada ejecución. Una alerta que salta por nuestras propias pruebas enseña a
 * ignorarla, que es la forma más cara de perder una alerta.
 *
 * La solución fue marcar ese tráfico (`CLAIM_SIMULACION` en el token de sesión) y excluirlo de
 * las métricas. Pero eso mete en el token un claim que la aplicación LEE, y ahí está el peligro
 * que vigila este fichero.
 *
 * ── EL PELIGRO, DICHO SIN ADORNOS ───────────────────────────────────────────────────────────
 *
 * Si algún día ese claim decidiera algo —saltarse un límite, entrar a admin, evitar un cobro—
 * sería una **puerta trasera**: bastaría un token con `venceSim: true` para tenerla abierta.
 *
 * Hoy es inofensivo por dos razones y solo una aguanta:
 *   (a) ponerlo exige `AUTH_SECRET`, y quien lo tiene ya puede firmar cualquier sesión — así que
 *       la marca no añade poder. **Esta razón deja de valer el día que el secreto se filtre**, y
 *       ese es justo el día en que importaría.
 *   (b) nadie lo lee para autorizar. Esta es la que sostiene la seguridad, y por eso se
 *       comprueba aquí en vez de confiarla a que nadie se despiste.
 *
 * Es el mismo criterio que el resto de la casa: impedir en el punto de escritura, no avisar.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const CLAIM = 'venceSim'

/** Ficheros de código de la app (no pruebas, no simulaciones, no dependencias). */
function ficherosDeApp(dirs: string[]): string[] {
  const salida: string[] = []
  const visita = (dir: string) => {
    let entradas: string[]
    try {
      entradas = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entradas) {
      if (e === 'node_modules' || e === '.next' || e === 'dist') continue
      const p = join(dir, e)
      const st = statSync(p)
      if (st.isDirectory()) visita(p)
      else if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(e)) salida.push(p)
    }
  }
  dirs.forEach((d) => visita(join(ROOT, d)))
  return salida
}

describe('la marca de simulación no puede conceder nada', () => {
  const ficheros = ficherosDeApp(['app', 'lib', 'backend/src', 'middleware.ts'].filter(Boolean))

  it('el nombre del claim se escribe UNA sola vez en todo el código', () => {
    // Nadie más puede teclear `'venceSim'` a pelo: dos literales del mismo claim divergen en
    // silencio el día que uno se renombre, y entonces la exclusión de métricas deja de casar
    // sin que nada falle. Quien lo necesite, que importe la constante.
    const conLiteral = ficheros
      .filter((f) => readFileSync(f, 'utf8').includes(`'${CLAIM}'`) || readFileSync(f, 'utf8').includes(`"${CLAIM}"`))
      .map((f) => f.replace(ROOT + '/', ''))
    expect(conLiteral).toEqual(['lib/sim/session.ts'])
  })

  it('solo la usa un puñado de sitios conocidos', () => {
    const usan = ficheros
      .filter((f) => readFileSync(f, 'utf8').includes('CLAIM_SIMULACION'))
      .map((f) => f.replace(ROOT + '/', ''))
      .sort()
    // `lib/sim/session.ts` la DECLARA; `lib/auth/authjs.ts` la ETIQUETA en la telemetría.
    // Antes de ampliar esta lista, la pregunta no es «¿molesta?», es «¿DECIDE algo?».
    expect(usan).toEqual(['lib/auth/authjs.ts', 'lib/sim/session.ts'])
  })

  it('donde se lee, solo alimenta `metadata` — nunca una condición de acceso', () => {
    const authjs = readFileSync(join(ROOT, 'lib/auth/authjs.ts'), 'utf8')
    // Se cuentan las LECTURAS REALES del token (`token[CLAIM_SIMULACION]`), no las menciones en
    // comentarios: son las únicas que podrían decidir algo. Hoy son dos —el helper que produce
    // la etiqueta y el catch del reintento— y ninguna gobierna un `if` de permisos.
    const lecturas = authjs.match(/token\[CLAIM_SIMULACION\]/g) ?? []
    expect(lecturas.length).toBe(2)
    // Cada lectura desemboca en una comparación a `true` que va a parar a metadata.
    expect(authjs).toMatch(/const esSimulacion = token\[CLAIM_SIMULACION\] === true/)
    // Y en ningún caso decide un permiso, un plan o un límite.
    expect(authjs).not.toMatch(
      /if\s*\([^)]*CLAIM_SIMULACION[^)]*\)\s*\{[^}]*(admin|premium|isAdmin|bypass|skip)/i,
    )
  })

  it('no aparece en NINGÚN sitio donde se decidan permisos', () => {
    const sensibles = ficheros.filter((f) =>
      /(auth\/(verifyAuth|mintAccessToken)|admin\/|middleware|guard|permission|entitle)/i.test(f),
    )
    const culpables = sensibles
      .filter((f) => readFileSync(f, 'utf8').includes(CLAIM))
      .map((f) => f.replace(ROOT + '/', ''))
    expect(culpables).toEqual([])
  })
})

describe('el tráfico de simulación queda FUERA de lo que se mide', () => {
  it('el canario de perfiles excluye la marca', () => {
    const canario = readFileSync(join(ROOT, 'scripts/canary-perfil-sin-resolver.cjs'), 'utf8')
    expect(canario).toMatch(/metadata->>'simulacion'/)
  })

  it('las tres reglas de alerta de T-434 también', () => {
    const reglas = readFileSync(join(ROOT, 'backend/src/alerts/alert-rules.ts'), 'utf8')
    for (const ev of ['auth_sesion_sin_email', 'auth_perfil_recuperado', 'auth_reintento_roto']) {
      const i = reglas.indexOf(`event_type = '${ev}'`)
      expect(i).toBeGreaterThan(-1)
      // El filtro va inmediatamente después del event_type de esa consulta.
      expect(reglas.slice(i, i + 260)).toMatch(/metadata->>'simulacion'/)
    }
  })

  it('toda sesión forjada por el harness nace marcada (no «cuando me acuerde»)', () => {
    const sesion = readFileSync(join(ROOT, 'lib/sim/session.ts'), 'utf8')
    // El constructor COMPARTIDO la pone, así que cualquier simulación futura la hereda.
    expect(sesion).toMatch(/sessionTokenPayload[\s\S]{0,600}\[CLAIM_SIMULACION\]:\s*true/)
  })
})
