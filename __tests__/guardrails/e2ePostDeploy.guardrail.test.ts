/**
 * [T-713] El paso que EJECUTA las pruebas de navegador sigue en el script de despliegue.
 *
 * ── Por qué hace falta vigilarlo ────────────────────────────────────────────
 * Esas 6 pruebas llevaban desde que existen sin ejecutarse: no estaban rotas ni desactivadas,
 * simplemente **ningún workflow invocaba el proyecto que las recoge**. La forma de que eso vuelva
 * a pasar no es que alguien las borre — es que este bloque desaparezca de `deploy-frontend.sh` en
 * un refactor y nadie lo note, porque el deploy seguiría diciendo «OK» exactamente igual.
 *
 * Es el mismo modo de fallo que ya costó caro dos veces: el gate de integración corriendo 492
 * runs sin base de datos, y el propio `authenticated` sin invocar. Un verde que no comprueba nada.
 *
 * Lo que se comprueba es lo MÍNIMO que hace falta para que corran de verdad, no el texto:
 * que se invoque el proyecto, que la sesión use el proveedor que funciona hoy, y que sin cuenta
 * desechable se salte EN VOZ ALTA en vez de correr contra la de un usuario real.
 */
import fs from 'fs'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'deploy-frontend.sh')
const src = () => fs.readFileSync(SCRIPT, 'utf8')

describe('[T-713] el deploy ejecuta las pruebas de navegador con sesión', () => {
  it('el script existe (si no, esto pasaría en verde sin comprobar nada)', () => {
    expect(fs.existsSync(SCRIPT)).toBe(true)
    expect(src().length).toBeGreaterThan(1000)
  })

  it('invoca el proyecto `authenticated`, que es el que recoge los 6 specs', () => {
    expect(src()).toMatch(/playwright test --project=authenticated/)
  })

  it('usa el proveedor de sesión que funciona hoy (`own-mint`), no el de Supabase congelado', () => {
    // `bridge` acuña por Supabase, CONGELADO desde el 04/07/2026. Si alguien lo cambia a ese,
    // las pruebas dejarían de poder entrar y el deploy lo diría… o peor, se saltarían.
    expect(src()).toMatch(/E2E_SESSION_PROVIDER=own-mint/)
    expect(src()).not.toMatch(/E2E_SESSION_PROVIDER=bridge/)
  })

  it('el secreto sale de SSM y NUNCA está escrito en el script', () => {
    const s = src()
    expect(s).toMatch(/ssm get-parameter[\s\S]{0,120}\/vence-frontend\/AUTH_SECRET/)
    // Un AUTH_SECRET pegado aquí acabaría en el repo. La comprobación es estrecha a propósito:
    // busca una asignación con valor literal, no la palabra suelta.
    expect(s).not.toMatch(/AUTH_SECRET\s*=\s*["']?[A-Za-z0-9+/=]{20,}/)
  })

  it('sin cuenta desechable NO corre: una de las pruebas RESPONDE una pregunta', () => {
    // Correr contra la cuenta de un usuario real le ensuciaría las estadísticas. El salto tiene
    // que ser explícito y ruidoso, no un `if` silencioso.
    const s = src()
    expect(s).toMatch(/E2E_USER_ID/)
    expect(s).toMatch(/NO SE EJECUTAN/)
  })

  it('un fallo NO tumba el deploy, pero se canta (la imagen ya está viva cuando esto corre)', () => {
    const s = src()
    const bloque = s.slice(s.indexOf('[7/7]'))
    expect(bloque).toMatch(/FALLAN LAS PRUEBAS DE NAVEGADOR/)
    // Y deja a mano cómo revertir: el fallo es de producto, la decisión es humana.
    expect(s).toMatch(/Rollback: aws ecs update-service/)
  })
})
