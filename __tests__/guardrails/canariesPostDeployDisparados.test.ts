// __tests__/guardrails/canariesPostDeployDisparados.test.ts
//
// GUARDARRAÍL: un canary post-deploy tiene que dispararse desde donde se despliega DE VERDAD.
//
// ## De dónde sale (31/07/2026)
//
// `canary-questions-gate` existe desde el 3 de julio para correr «tras cada deploy». Medido
// ese día en `observable_events`: había dejado rastro **3 veces en su vida** (dos el 3 de
// julio y una el 30). ¿La causa? Su único disparo vivía en
// `.github/workflows/frontend-deploy.yml`, y el equipo despliega con `scripts/deploy-*.sh` —
// que es lo que manda el runbook: *«desplegar SIEMPRE con el script»*. El canary casi nunca
// veía un deploy.
//
// Y el canary de identidad en pagos, recién escrito, iba camino de lo mismo: se enganchó al
// workflow por imitación, se desplegó, y **no corrió**.
//
// Un canary que no se dispara no es una red de seguridad: es una red que *parece* estar ahí,
// que es peor, porque se cuenta como cubierto.
//
// La regla: **todo endpoint `run-*` de un controlador de canary aparece en el script de
// deploy**. Estar además en el workflow es bienvenido; estar SOLO ahí, no.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const BACKEND = join(RAIZ, 'backend/src')

/** Endpoints `run-*` declarados por controladores de canary. */
function endpointsDeCanary(): string[] {
  const salida: string[] = []
  for (const dir of readdirSync(BACKEND, { withFileTypes: true })) {
    if (!dir.isDirectory() || !dir.name.startsWith('canary-')) continue
    const carpeta = join(BACKEND, dir.name)
    for (const f of readdirSync(carpeta)) {
      if (!f.endsWith('.controller.ts')) continue
      const src = readFileSync(join(carpeta, f), 'utf8')
      for (const m of src.matchAll(/@Post\('(run-[a-z0-9-]+)'\)/g)) salida.push(m[1])
    }
  }
  return [...new Set(salida)]
}

/**
 * Exenciones, con motivo. `canary-runner` es el ejecutor genérico (`run-now`), no un canary
 * post-deploy concreto: lo invocan crons y el panel, no el despliegue.
 */
const EXENTOS: Record<string, string> = {
  'run-now':
    'Ejecutor genérico de canaries bajo demanda (canary-runner / cron-runner): lo llaman el ' +
    'panel de admin y los crons, no el despliegue. No vigila una regresión de deploy concreta.',
}

describe('canaries post-deploy — se disparan donde se despliega de verdad', () => {
  const endpoints = endpointsDeCanary().filter((e) => !EXENTOS[e])
  const scriptDeploy = existsSync(join(RAIZ, 'scripts/deploy-frontend.sh'))
    ? readFileSync(join(RAIZ, 'scripts/deploy-frontend.sh'), 'utf8')
    : ''

  it('hay canaries que auditar (si no, el escaneo se quedó ciego)', () => {
    expect(endpoints.length).toBeGreaterThan(0)
  })

  it('el script de deploy existe y es el camino canónico del runbook', () => {
    expect(scriptDeploy.length).toBeGreaterThan(0)
  })

  it.each(endpointsDeCanary().filter((e) => !EXENTOS[e]))(
    '%s se dispara desde scripts/deploy-frontend.sh, no solo desde GitHub Actions',
    (endpoint) => {
      // El bucle del script recorre los nombres, así que basta con que el nombre aparezca.
      expect(scriptDeploy).toContain(endpoint)
    },
  )

  it('toda exención está justificada por escrito', () => {
    for (const [nombre, motivo] of Object.entries(EXENTOS)) {
      expect(motivo.length).toBeGreaterThan(60)
      expect(nombre).toMatch(/^run-/)
    }
  })
})
