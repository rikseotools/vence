/**
 * @jest-environment node
 */
// TRINQUETE de T-427: el detector de fichas huérfanas NO puede volver a decidir mirando solo la
// rama local, y su aviso NO puede quedarse sin vigilar.
//
// Por qué hace falta un guardarraíl de código fuente y no basta con los unitarios: el clasificador
// puro tenía seis tests en verde el 29/07 y aun así el incidente del 31/07 pasó de largo, porque el
// fallo estaba en los DATOS que le pasaba el CLI, no en la decisión. Un cambio futuro que vuelva a
// llamar al clasificador con el historial local a secas dejaría todos esos tests en verde y el
// detector ciego otra vez. Esto lo impide en el punto exacto donde se rompió.
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const CLI = readFileSync(join(RAIZ, 'scripts', 'backlog.cjs'), 'utf8')
const REGLAS = readFileSync(join(RAIZ, 'backend', 'src', 'alerts', 'alert-rules.ts'), 'utf8')

describe('la clasificación de fichas huérfanas se apoya en origin/main', () => {
  it('el CLI pasa los hechos de ORIGIN al clasificador, no solo el historial local', () => {
    // Si esto se rompe, el aviso vuelve a leer «sin pushear» sobre una ficha que acaban de borrar.
    expect(CLI).toContain('hechosDeOrigin(')
    const llamada = CLI.slice(CLI.indexOf('clasificarHuerfanas('), CLI.indexOf('clasificarHuerfanas(') + 500)
    expect(llamada).toContain('origen:')
    expect(llamada).toContain('hechosDeOrigin(')
  })

  it('refresca la ref compartida antes de opinar', () => {
    // Sin fetch, una ficha borrada hace diez minutos se ve «todavía presente» y el aviso llega
    // tarde, que es casi tan malo como no darlo.
    expect(CLI).toContain('refrescarOrigin(')
  })

  it('el CLI NO reimplementa el pickaxe por su cuenta: los hechos de git viven en su módulo', () => {
    // Tener dos lectores de git con criterios distintos es exactamente cómo nació el punto ciego
    // (y cómo nacieron las seis copias del session-id de T-407). El CLI usa git para otras cosas
    // (huella de ficheros, ancestros de un deploy) y eso está bien; lo que no puede es volver a
    // tener SU propia búsqueda de fichas en el historial.
    expect(CLI).toContain("require(path.join(__dirname, '..', 'lib', 'backlog', 'gitFichas.cjs'))")
    // El pickaxe COMO ARGUMENTO (`'-S'`) es lo que se movió al módulo. Ojo: el CLI sí imprime un
    // `git log -S'### [T-NNN]'` como pista para recuperar la ficha a mano — eso es texto para una
    // persona, no un lector de git paralelo, y tiene que seguir estando.
    expect(CLI).not.toContain("'-S'")
    expect(CLI).toContain("recupérala:  git log -S")
  })
})

describe('la señal de ficha borrada está VIGILADA (no es un evento ciego)', () => {
  it('el CLI emite el evento cuando detecta una regresión', () => {
    expect(CLI).toContain("'backlog_ficha_borrada'")
    expect(CLI).toContain('INSERT INTO observable_events')
  })

  it('y existe una regla de alerta con ese mismo nombre', () => {
    // Un eventType que ninguna regla mira es ruido que nadie lee: el catch-all
    // `senal_error_sin_vigilancia` solo ve inundaciones (≥150/h) y esto son uno o dos por semana.
    expect(REGLAS).toContain("name: 'backlog_ficha_borrada'")
    expect(REGLAS).toContain('RULE_BACKLOG_FICHA_BORRADA,')   // registrada en ALERT_RULES
  })

  it('la emisión es fail-open: la telemetría no puede tumbar un `sync`', () => {
    const bloque = CLI.slice(CLI.indexOf("'backlog_ficha_borrada'") - 700, CLI.indexOf("'backlog_ficha_borrada'") + 400)
    expect(bloque).toMatch(/try\s*\{/)
    expect(bloque).toMatch(/catch\s*\{/)
  })
})
