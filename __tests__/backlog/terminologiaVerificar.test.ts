/**
 * @jest-environment node
 */
// Las palabras del CLI no pueden empujar a lo contrario de lo que toca (T-441).
//
// El cubo de tareas despiertas se anunciaba como «trabajo casi terminado, se cierran rápido».
// Están IMPLEMENTADAS y sin comprobar: lo que falta no es teclear `done`, es ir a mirar
// producción. Con esa frase el atajo mental era cerrarlas — y así una tarea se da por buena sin
// que nadie haya verificado nada, que es el fallo que motivó T-392.
import { readFileSync } from 'fs'
import { join } from 'path'

const bruto = readFileSync(join(process.cwd(), 'scripts/backlog.cjs'), 'utf8')
// Se mide el CÓDIGO, no los comentarios: el propio comentario que explica el cambio CITA la
// frase vieja, y una comprobación sobre el fichero entero la contaría como si siguiera viva.
// (Mismo error cometido hoy en otro guardarraíl: uno que mide comentarios no mide nada.)
const cli = bruto.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('las palabras dicen lo que hay que HACER, no lo fácil que es', () => {
  it('el cubo de despiertas NO promete que se cierren rápido', () => {
    expect(cli).not.toMatch(/se cierran rápido/)
  })

  it('dice que están implementadas y SIN COMPROBAR, y que hay que mirar producción', () => {
    expect(cli).toMatch(/IMPLEMENTADA\(S\) Y SIN COMPROBAR/)
    expect(cli).toMatch(/MIRAR producción antes de cerrarlas/)
  })

  // El deploy solo DESPIERTA: no toca el status. Decir «se cierran solas» sería mentira, y esa
  // confusión es justo la que hay que evitar en los mensajes.
  it('el deploy anuncia que pasan a poder verificarse, no que se cierren', () => {
    expect(cli).toMatch(/pasan a LISTA\(S\) PARA VERIFICAR/)
    expect(cli).toMatch(/ya se puede verificar/)
  })

  it('al cerrar una que venía de pausa, recuerda que el outcome debe decir QUÉ se verificó', () => {
    expect(cli).toMatch(/el outcome debería decir QUÉ verificaste/)
  })
})
