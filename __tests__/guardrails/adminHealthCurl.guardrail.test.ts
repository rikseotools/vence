/**
 * @jest-environment node
 */
// Guardarraíl: las instrucciones para llamar a `/api/admin/health` tienen que corresponderse con
// lo que de verdad exige la autenticación. (T-442, 01/08/2026)
//
// ── QUÉ PASÓ ─────────────────────────────────────────────────────────────────────────────────
// La cabecera del fichero decía `curl -H "Authorization: Bearer $CRON_SECRET"` y **llevaba tiempo
// sin funcionar**. Cuando se añadió el guard global de `/api/admin/*` (`lib/security/adminApiGuard
// .ts`, del arreglo de los 38 endpoints admin sin auth), ese guard pasó a exigir por
// `Authorization: Bearer` un **JWT de admin**, no el `CRON_SECRET` — así que rechaza con «Token
// inválido» ANTES de llegar a la ruta. La forma que funciona necesita LAS DOS cabeceras:
// `x-cron-secret` (para el guard) y `Authorization: Bearer` (para la comprobación propia de la
// ruta).
//
// El coste no fue teórico: quien fuera a diagnosticar un incidente siguiendo el runbook se comía
// un 401 y concluía que el endpoint estaba roto. Nadie lo notó porque **una documentación
// equivocada no rompe ningún test** — y por eso hace falta este.
//
// Es de FICHERO, no de red: comprueba que las instrucciones nombran las dos cabeceras. Si mañana
// el guard cambia de criterio y alguien actualiza `adminApiGuard`, este test seguirá pasando —
// no puede verificar la autenticación real. Lo que sí impide es lo que pasó: que las
// instrucciones se queden en una versión anterior de la verdad sin que nada chille.
import fs from 'fs'
import path from 'path'

const RAIZ = path.join(__dirname, '..', '..')
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), 'utf8')

describe('las instrucciones de /api/admin/health nombran LAS DOS cabeceras', () => {
  const ruta = leer('app/api/admin/health/route.ts')
  // Solo la cabecera del fichero: el cuerpo tiene la lógica, no las instrucciones.
  const cabecera = ruta.slice(0, ruta.indexOf('export ') > 0 ? ruta.indexOf('export ') : 2000)

  it('la ruta documenta `x-cron-secret` (la que pide el guard del proxy edge)', () => {
    expect(cabecera).toContain('x-cron-secret')
  })

  it('…y también `Authorization: Bearer` (la que pide la propia ruta)', () => {
    expect(cabecera).toMatch(/Authorization:\s*Bearer/)
  })

  it('el runbook de salud documenta las dos igual', () => {
    // Si el runbook y el código se contradicen, gana el que alguien lea primero — y eso no se
    // puede saber. Tienen que decir lo mismo.
    const runbook = leer('docs/runbooks/health-check.md')
    const bloque = runbook.slice(runbook.indexOf('/api/admin/health') - 400, runbook.indexOf('/api/admin/health') + 400)
    expect(bloque).toContain('x-cron-secret')
    expect(bloque).toMatch(/Authorization:\s*Bearer/)
  })

  it('el guard sigue aceptando `x-cron-secret` (si deja de hacerlo, estas instrucciones mienten)', () => {
    // No verifica la autenticación —eso solo se puede en vivo— pero ata la instrucción a la
    // existencia del mecanismo que la justifica.
    expect(leer('lib/security/adminApiGuard.ts')).toContain("headers.get('x-cron-secret')")
  })
})
