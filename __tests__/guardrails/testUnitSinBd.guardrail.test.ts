/**
 * @jest-environment node
 */
// Ninguna suite que hable con la BD puede correr en el `pre-commit`. (T-576)
//
// ── LO QUE COSTÓ ────────────────────────────────────────────────────────────────────────────
// `w1` no podía commitear NADA. Ni él, ni `w2`, ni `l2`, ni el supervisor operando dentro de sus
// árboles. El `pre-commit` corre `npm run test:unit`, y ahí dentro había **12 suites que consultan
// la BD de negocio** — que un trabajador de la flota no puede leer POR DISEÑO (`vence_coordinacion`
// son 4 tablas de coordinación; `vence_lector` no da `conversion_events`, `temario_pdf_jobs`…).
//
// No son unitarias: un test que hace DELETE/INSERT contra la BD real es de integración por
// definición, y que viviera bajo `test:unit` era un error de ETIQUETA. Corregirlo no debilita el
// gate — lo hace honesto y más rápido para todas las sesiones.
//
// ── POR QUÉ HACE FALTA EL TRINQUETE ─────────────────────────────────────────────────────────
// Esto vuelve solo. Nadie va a mover una suite a `test:unit` a propósito: se cuela creando una
// nueva en la carpeta cómoda. `lib/admin/suiteRegistry.ts` ya vigila lo mismo para las CARPETAS de
// integración; el hueco era justo el complementario —las de fuera— y ahí es donde vivía el fallo.
//
// ── LA DETECCIÓN, Y POR QUÉ NO ES UN GREP ───────────────────────────────────────────────────
// Buscar `DATABASE_URL` o `postgres(` como TEXTO da 44 ficheros y casi todos son falsos: los
// guardarraíles leen código fuente como cadena, y el encargo de la flota menciona la variable
// dentro de un texto. Lo que delata a una suite es que **IMPORTE** el cliente o el helper: para
// hablar con la BD hay que traérsela. Y si la MOCKEA, no habla con ninguna base.
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

const ROOT = path.resolve(__dirname, '../..')

/**
 * Una LÍNEA DE IMPORT de verdad, no una mención.
 *
 * Tiene que anclarse a principio de línea y exigir la forma completa del import. Sin eso, los
 * guardarraíles vecinos —que analizan el uso de `pg` y llevan sus patrones escritos como cadenas y
 * expresiones regulares— salen marcados: son ficheros que HABLAN de la BD sin tocarla, y con ellos
 * dentro el trinquete daría 8 falsos y se acabaría apagando.
 */
const IMPORTA_BD =
  /^[ \t]*(?:import[^\n]*from|(?:const|let|var)[^=\n]*=[ \t]*require\()[ \t]*['"](?:pg|postgres)['"]/m

// ── POR QUÉ SOLO EL DRIVER, Y NO «USA getAdminDb» ────────────────────────────────────────
// Se probó añadir los nombres de las fábricas de conexión (`getAdminDb`, `getPoolerDb`, `pgConfig`…)
// y marcaba ocho suites que las **MOCKEAN**: tests de la propia fábrica, o unitarios que la
// sustituyen. Ninguna de las ocho falla con el rol restringido —o sea, ninguna conecta—, así que
// el detector estaba midiendo otra cosa.
//
// La verdad de referencia es OBSERVADA, no inferida: correr `test:unit` dentro del worktree de un
// trabajador con su rol acotado. Fueron 12. Y de esas 12, todas se delatan por lo mismo: **importar
// el driver**. Es la señal inequívoca —para hablar con Postgres hay que traerse `pg` o `postgres`—
// y no admite falsos, que es lo que decide si un trinquete sobrevive o se apaga.

/** Una suite que sustituye el cliente no toca ninguna base: nombrarlo es parte del mock. */
const MOCKEA = /jest\.mock\(\s*['"][^'"]*(lib\/db|helpers\/db|['"]pg['"]|postgres)/

function hablaConLaBd(rutaAbs: string): boolean {
  let src = ''
  try { src = fs.readFileSync(rutaAbs, 'utf8') } catch { return false }
  if (MOCKEA.test(src)) return false
  return IMPORTA_BD.test(src)
}

/** Las suites que `npm run test:unit` correría HOY. Se le pregunta a jest, no se reimplementa. */
function suitesDelPreCommit(): string[] {
  const script = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:unit'])
  const args = (script.match(/--testPathIgnorePatterns='[^']*'/g) || [])
    .map((a) => a.replace(/'/g, '').split('='))
    .flatMap(([k, v]) => [k, v])
  const salida = execFileSync('npx', ['jest', '--listTests', ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  })
  return salida.trim().split('\n').filter(Boolean)
}

describe('el pre-commit no puede depender de la BD de negocio', () => {
  // Correr jest dentro de jest es lento: se hace UNA vez.
  const suites = suitesDelPreCommit()

  it('jest resuelve el alcance de test:unit (si esto falla, la comprobación no vale)', () => {
    expect(suites.length).toBeGreaterThan(500)
  })

  it('ninguna de ellas importa un cliente de base de datos', () => {
    const culpables = suites.filter(hablaConLaBd).map((f) => path.relative(ROOT, f)).sort()
    expect({
      cuantas: culpables.length,
      // El mensaje va en el propio valor esperado para que el fallo diga QUÉ hacer, no solo qué pasa.
      // Un guardarraíl que solo dice «rojo» se apaga; uno que dice cómo arreglarlo, se arregla.
      arreglo: culpables.length
        ? 'renómbralas a *.integration.test.ts (o muévelas a __tests__/integration/): un test que ' +
          'habla con la BD real NO es unitario, y en el pre-commit bloquea a cualquier sesión con ' +
          'credenciales acotadas — a toda la flota, de hecho. Seguirán corriendo en CI.'
        : null,
      culpables,
    }).toEqual({ cuantas: 0, arreglo: null, culpables: [] })
  })

  // La otra mitad: sacarlas del pre-commit sin que corran en ningún sitio sería apagarlas, que es
  // peor que el problema. El patrón de integración tiene que recogerlas.
  it('y el job de integración SÍ las recoge', () => {
    const script = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:integration'])
    expect(script).toMatch(/canary/)
    expect(script).toMatch(/integration\\?\.test/)
  })
})
