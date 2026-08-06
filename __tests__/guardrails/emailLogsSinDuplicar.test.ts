/**
 * Quien envía con `sendEmailV2` NO vuelve a escribir en `email_logs`. (T-448)
 *
 * `sendEmailV2` termina llamando a `logEmailSent`, que inserta la fila en `email_logs` **y** en
 * `email_events` con el mismo `emailType`. Un `insert(emailLogs)` añadido después «por si acaso»
 * no es redundancia inofensiva: **duplica la fila en cada envío**.
 *
 * Medido el 06/08/2026 sobre RDS, el caso que lo motiva (`fin_suscripcion_precio_heredado`):
 * **40 filas de `email_logs` para 20 personas** — dos por cabeza, todos los días desde su estreno,
 * mientras `email_events` tenía una por persona. El daño es de MEDIDA, que es el peor sitio:
 *
 *   · `email_logs` es de donde salen las cuentas de campaña (los 424 recordatorios de [T-456] se
 *     contaron así), y quedaban al doble;
 *   · la idempotencia de estas campañas (`yaAvisado`) consulta esta misma tabla — quien la lea
 *     contando filas en vez de personas se lleva el doble;
 *   · y no lo delata nada, porque los dos inserts van en `try/catch`: el correo sale bien.
 *
 * Se comprueba por PATRÓN DE ESCRITURA, no por mención: importar `emailLogs` para LEERLO (que es
 * lo que hace la idempotencia) es legítimo y no debe marcarse.
 */
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

/**
 * Los enviadores propios que gestionan su registro entero (no pasan por `sendEmailV2`), así que
 * su `insert(emailLogs)` es el ÚNICO y es correcto.
 */
const ESCRITORES_LEGITIMOS = [
  'lib/api/emails/queries.ts', // logEmailSent: el escritor canónico
  'lib/emails/emailService.server.ts', // resumen semanal: enviador propio, escribe él una sola vez
]

function ficherosDelRepo(): string[] {
  return execFileSync('git', ['ls-files', 'lib', 'app', 'backend/src', 'scripts'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f))
}

describe('nadie duplica la fila de email_logs (T-448)', () => {
  it('quien llama a sendEmailV2 no escribe además en email_logs', () => {
    const culpables = ficherosDelRepo().filter((f) => {
      if (ESCRITORES_LEGITIMOS.includes(f)) return false
      let src = ''
      try { src = readFileSync(join(ROOT, f), 'utf8') } catch { return false }
      // Escritura de verdad, no una lectura ni una mención.
      const escribe = /\.insert\(\s*emailLogs\s*\)/.test(src)
      const envia = /sendEmailV2\s*\(/.test(src)
      return escribe && envia
    })

    expect({
      culpables,
      arreglo: culpables.length
        ? 'quita el insert: sendEmailV2 ya escribe esa fila (logEmailSent) con el mismo emailType. ' +
          'Dejarlo duplica el registro en CADA envío y descuadra las cuentas de campaña, sin que ' +
          'nada lo delate (los inserts van en try/catch, así que el correo sale bien igual).'
        : null,
    }).toEqual({ culpables: [], arreglo: null })
  })

  it('la lista de escritores legítimos apunta a ficheros que existen', () => {
    // Si uno se renombra y la exención se queda huérfana, el guardarraíl deja de mirar algo que
    // cree estar mirando.
    for (const f of ESCRITORES_LEGITIMOS) {
      expect(() => readFileSync(join(ROOT, f), 'utf8')).not.toThrow()
    }
  })

  it('el escritor canónico sigue escribiendo en las DOS tablas', () => {
    // Si alguien quitara el insert de `email_events` de `logEmailSent`, este guardarraíl seguiría
    // en verde mientras los correos dejan de dejar rastro — que es el fallo de [T-456].
    const src = readFileSync(join(ROOT, 'lib/api/emails/queries.ts'), 'utf8')
    expect(src).toMatch(/\.insert\(emailLogs\)/)
    expect(src).toMatch(/\.insert\(emailEvents\)/)
  })
})
