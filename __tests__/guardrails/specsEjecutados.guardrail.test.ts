/**
 * [T-713] Un spec de Playwright que ningún proyecto de CI ejecuta NO es una capa.
 *
 * Medido el 08/08/2026: **6 de 8** specs no se ejecutaban nunca. Y no eran специmenores — son los
 * que se escribieron porque un fallo se escapó de todas las demás capas: el registro de IP roto
 * 27 días en silencio ([T-314]), el envío explícito de impugnaciones ([T-198]), el configurador
 * de leyes (regresión `442bc679`). El daño real no es perder esos 6: es que **quien escribe el
 * séptimo cree que ha añadido una capa**, igual que el gate de integración que corrió 492 veces
 * sin base de datos.
 *
 * Este guardarraíl lee los proyectos DEL config real y los workflows DE VERDAD, así que no se
 * puede quedar desfasado respecto a lo que CI hace: si alguien deja de invocar un proyecto, esto
 * se pone rojo con los specs que se quedaron sin ejecutar.
 */
import fs from 'fs'
import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { specsSinEjecutar, explicar } = require('@/lib/calidad/specsEjecutados.cjs')

const RAIZ = process.cwd()

/** Todos los `*.spec.ts` bajo `e2e/`, en la forma que usa `testMatch`. */
function specs(): string[] {
  const out: string[] = []
  const anda = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) anda(p)
      else if (/\.spec\.ts$/.test(e.name)) out.push(path.relative(path.join(RAIZ, 'e2e'), p))
    }
  }
  anda(path.join(RAIZ, 'e2e'))
  return out
}

/**
 * Qué scripts de npm invocan los workflows (es lo que decide si un proyecto CORRE).
 *
 * Se aceptan DOS formas, y la segunda no es un extra: `e2e-smoke.yml` no escribe el script en el
 * `run`, lo CALCULA (`echo "script=test:e2e:prod" >> "$GITHUB_OUTPUT"`) y luego hace
 * `npm run ${{ steps.target.outputs.script }}`. Buscando solo `npm run …` el detector daba CERO
 * proyectos vivos — o sea, se declaraba ciego siendo el caso normal de este repo.
 */
function scriptsInvocadosPorCI(): string[] {
  const dir = path.join(RAIZ, '.github/workflows')
  const txt = fs.readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
  return [...txt.matchAll(/(?:npm run |script=)(test:e2e[:a-z-]*)/g)].map((m) => m[1])
}

/**
 * Proyectos del config real y si CI los ejecuta.
 *
 * `preview-aws` cuenta como NO ejecutado a propósito: su workflow solo se dispara en
 * `pull_request` contra `main`, y en este repo se empuja DIRECTO a `main` (política de la casa),
 * así que ese disparador no salta nunca. Un proyecto que solo corre en un evento que no ocurre
 * no protege de nada, y contarlo como vivo dejaría el guardarraíl en verde mintiendo.
 */
function proyectos() {
  const scripts = scriptsInvocadosPorCI()
  const corre = (s: string) => scripts.includes(s)
  return [
    { nombre: 'prod', testMatch: /(^|\/)smoke-[^/]*\.spec\.ts$/, ejecutadoPorCI: corre('test:e2e:prod') },
    { nombre: 'preview-aws', testMatch: /(^|\/)smoke-[^/]*\.spec\.ts$/, ejecutadoPorCI: false },
    { nombre: 'authenticated', testMatch: /^authed\/.*\.spec\.ts$/, ejecutadoPorCI: corre('test:e2e:auth') },
  ]
}

/**
 * Los 6 que YA estaban huérfanos cuando se midió esto (08/08/2026). Se declaran para que el
 * guardarraíl nazca en VERDE y no bloquee a las demás sesiones — un guardarraíl que nace rojo se
 * salta con `--skip` y deja de proteger, que es como se pierden.
 *
 * **Esta lista solo puede ENCOGER.** Ninguno nuevo puede entrar: para eso está el guardarraíl.
 *
 * ⏳ Ejecutarlos de verdad es una DECISIÓN pendiente, con coste en las dos salidas:
 *   (a) invocar el proyecto `authenticated` desde `e2e-smoke.yml` → exige `AUTH_SECRET` como
 *       secret de GitHub, y ese secreto FIRMA sesiones: quien lo tenga puede acuñar la de
 *       cualquier usuario. No es un secret más.
 *   (b) correrlos en el smoke post-deploy (`scripts/deploy-frontend.sh` [6/6]), donde el secreto
 *       ya sale de SSM y no se expone → pero añade minutos a un deploy que mantiene el lock
 *       global, y con varias sesiones desplegando eso lo paga todo el mundo.
 * El proveedor de sesión que hace falta ya está listo (`own-mint`, [T-713]); lo que falta es
 * elegir dónde corren.
 */
const HUERFANOS_DECLARADOS = [
  'authed/bearer-en-rutas-con-dueno.spec.ts',
  'authed/dispute-envio-explicito.spec.ts',
  'authed/dispute-panel-no-arrastra-pregunta.spec.ts',
  'authed/laws-configurator.spec.ts',
  'authed/question-evolution.spec.ts',
  'authed/session-ip-se-registra.spec.ts',
]

describe('[T-713] todo spec de Playwright lo ejecuta algún proyecto de CI', () => {
  it('el inventario no está vacío (si no, esto pasaría en verde sin medir nada)', () => {
    expect(specs().length).toBeGreaterThan(1)
    expect(proyectos().some((p) => p.ejecutadoPorCI)).toBe(true)
  })

  it('ningún spec NUEVO se queda sin ejecutar', () => {
    const { huerfanos, sinProyectosVivos } = specsSinEjecutar(specs(), proyectos())
    // Sin proyectos vivos no se puede afirmar nada — se dice, no se aprueba en falso.
    expect(sinProyectosVivos).toBe(false)
    const nuevos = huerfanos.filter((s: string) => !HUERFANOS_DECLARADOS.includes(s))
    expect(nuevos.length === 0 ? '' : explicar(nuevos)).toBe('')
  })

  it('la lista de declarados solo ENCOGE (al hacer que uno corra, se quita de aquí)', () => {
    const { huerfanos } = specsSinEjecutar(specs(), proyectos())
    const yaNoLoSon = HUERFANOS_DECLARADOS.filter((s) => !huerfanos.includes(s))
    expect(
      yaNoLoSon.length === 0
        ? ''
        : `Estos ya SÍ se ejecutan: quítalos de HUERFANOS_DECLARADOS.\n  · ${yaNoLoSon.join('\n  · ')}`,
    ).toBe('')
    expect(huerfanos.length).toBeLessThanOrEqual(HUERFANOS_DECLARADOS.length)
  })
})

describe('[T-713] el núcleo puro', () => {
  const P = [
    { nombre: 'vivo', testMatch: /^smoke-/, ejecutadoPorCI: true },
    { nombre: 'muerto', testMatch: /^authed\//, ejecutadoPorCI: false },
  ]

  it('un spec recogido por un proyecto VIVO no es huérfano', () => {
    expect(specsSinEjecutar(['smoke-a.spec.ts'], P).huerfanos).toEqual([])
  })

  it('un spec recogido SOLO por un proyecto que nadie invoca SÍ es huérfano', () => {
    expect(specsSinEjecutar(['authed/b.spec.ts'], P).huerfanos).toEqual(['authed/b.spec.ts'])
  })

  it('un spec que no casa con ningún proyecto también es huérfano', () => {
    expect(specsSinEjecutar(['suelto.spec.ts'], P).huerfanos).toEqual(['suelto.spec.ts'])
  })

  it('si NINGÚN proyecto está vivo, no acusa a nadie — avisa de que no puede medir', () => {
    const muertos = P.map((p) => ({ ...p, ejecutadoPorCI: false }))
    const r = specsSinEjecutar(['smoke-a.spec.ts', 'authed/b.spec.ts'], muertos)
    expect(r.sinProyectosVivos).toBe(true)
    expect(r.huerfanos).toEqual([])
  })

  it('el mensaje nombra el fichero y da salidas (un «mal» a secas se ignora)', () => {
    const t = explicar(['authed/b.spec.ts'])
    expect(t).toContain('e2e/authed/b.spec.ts')
    expect(t).toContain('smoke-')
  })
})
