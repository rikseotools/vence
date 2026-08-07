/**
 * @jest-environment node
 *
 * [T-615] Sin `worktree_sessions` accesible, el barrido de worktrees huérfanos NO puede afirmar
 * que una sesión esté viva — y durante meses lo afirmó.
 *
 * El 06/08/2026 `npm run sesiones:huerfanos` imprimió «✅ ningún worktree guarda trabajo que solo
 * exista ahí» con los 28 worktrees clasificados «en uso», sin haber evaluado el contenido de
 * ninguno. En ese momento `sesion/colas-feedback` llevaba 18 h muerta con un arreglo de
 * `db/schema.ts` que no estaba en `main`.
 *
 * La causa era de UNA línea: sin BD se pasaba `minSinSenal = 0` a `clasificarWorktree`, o sea
 * «acaba de latir». Y como la señal de vida manda sobre todo lo demás, nada se llegaba a mirar.
 *
 * El daño no era solo cosmético: `borrar-worktree.sh` consulta el mismo camino con `--slug` y
 * borra cuando no hay hallazgo, así que sin BD el guard dejaba pasar el borrado de un worktree
 * con trabajo dentro. Ese borrado no se deshace.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { minutosSinSenal } = require('../../scripts/sessions/huerfanos.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarWorktree } = require('../../lib/sessions/trabajoHuerfano.cjs')

const AHORA = new Date('2026-08-06T12:00:00Z').getTime()

describe('[T-615] «no lo sé» no puede parecerse a «acaba de latir»', () => {
  it('sin fila de sesión (BD caída o worktree desconocido) devuelve null, NUNCA 0', () => {
    // 0 significaría «latió hace un instante» y blinda el worktree de toda revisión.
    expect(minutosSinSenal(undefined, AHORA)).toBeNull()
    expect(minutosSinSenal(null, AHORA)).toBeNull()
    expect(minutosSinSenal({}, AHORA)).toBeNull()
    expect(minutosSinSenal({ last_signal_at: null }, AHORA)).toBeNull()
  })

  it('una fecha corrupta tampoco se cuela como número', () => {
    // `new Date('vete a saber').getTime()` es NaN, y NaN < 180 es false: colaría como MUERTA por
    // accidente. Se prefiere decir «no lo sé» a acertar de rebote.
    expect(minutosSinSenal({ last_signal_at: 'vete a saber' }, AHORA)).toBeNull()
  })

  it('con fila real sí calcula los minutos', () => {
    expect(minutosSinSenal({ last_signal_at: '2026-08-06T11:00:00Z' }, AHORA)).toBe(60)
  })

  // ── El caso completo, que es lo que de verdad se rompió ────────────────────────────────────
  it('EL FALLO DEL 06/08: sin BD y sin procesos dentro, un worktree con trabajo propio se AVISA', () => {
    const wt = {
      slug: 'colas-feedback',
      ficherosUnicos: ['db/schema.ts', '__tests__/db/schemaColumnasCriticas.test.ts'],
      commitsAhead: 5,
      commitsUnicos: 5,
      minSinSenal: minutosSinSenal(undefined, AHORA), // sin BD
      procesos: 0,                                    // sesión muerta: nadie dentro
    }
    const c = clasificarWorktree(wt)
    expect(c.veredicto).toBe('contenido_unico')
    expect(c.gravedad).toBe('warn')
  })

  it('lo ANTERIOR daba «en uso» con la entrada mentirosa — hoy NI CON ESA MENTIRA cuela (T-577)', () => {
    // El 06/08 el fallo estaba en la ENTRADA (minutosSinSenal devolvía 0 en vez de null): con el
    // criterio de aquel día, minSinSenal=0 + procesos=0 daba "en_uso". T-577 (07/08) encontró el
    // hueco complementario -- procesos CONFIRMADO en 0 con un latido REAL y fresco (no una mentira
    // de "sin BD") también colaba como "en_uso" hasta 3 horas -- y lo cerró: ahora un `procesos`
    // conocido en 0 nunca se deja tapar por el latido, mienta este o no. Doble candado: aunque
    // `minutosSinSenal` volviera a mentir con un 0, `procesos:0` ya lo intercepta él solo.
    const conLaEntradaMentirosa = clasificarWorktree({
      slug: 'colas-feedback',
      ficherosUnicos: ['db/schema.ts'],
      commitsAhead: 5,
      commitsUnicos: 5,
      minSinSenal: 0, // ← lo que se pasaba sin BD, el bug original de T-615
      procesos: 0,
    })
    expect(conLaEntradaMentirosa.veredicto).toBe('contenido_unico')
  })

  it('una sesión VIVA sigue exenta aunque no haya BD (procesos dentro mandan)', () => {
    // El arreglo no puede volverse un aviso constante sobre quien está trabajando.
    const c = clasificarWorktree({
      slug: 'la-mia',
      ficherosUnicos: ['algo.ts'],
      commitsAhead: 1,
      commitsUnicos: 1,
      minSinSenal: minutosSinSenal(undefined, AHORA),
      procesos: 3,
    })
    expect(c.veredicto).toBe('en_uso')
  })

  it('sin BD y sin trabajo dentro no se inventa un hallazgo', () => {
    const c = clasificarWorktree({
      slug: 'limpio',
      ficherosUnicos: [],
      commitsAhead: 0,
      commitsUnicos: 0,
      minSinSenal: minutosSinSenal(undefined, AHORA),
      procesos: 0,
    })
    expect(c.veredicto).toBe('sin_trabajo')
  })
})
