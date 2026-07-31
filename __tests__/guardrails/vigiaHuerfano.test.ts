/**
 * @jest-environment node
 */
// El vigía tiene que MORIR con la sesión que lo lanzó (T-432).
//
// Escribe sus avisos en la SALIDA de esa sesión. Si se cierra, el proceso no muere —Linux se lo
// entrega a init— y sigue consultando la BD, detectando novedades y contándoselas a nadie.
// Medido el 31/07: dos vigías llevaban 33 HORAS así, uno de ellos duplicado.
//
// Y es peor que desperdiciar: en `--loop` recuerda lo ya avisado, así que un huérfano puede
// marcar como visto algo QUE NADIE LLEGÓ A VER. La vigilancia no falla — finge funcionar.
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'scripts/vigia.cjs'), 'utf8')

describe('vigia.cjs — no vigila para nadie', () => {
  it('recuerda quién era su padre al arrancar', () => {
    expect(src).toMatch(/const padreAlArrancar = process\.ppid/)
  })

  // Sin depender de señales: varios se lanzaron con `nohup`, que las ignora A PROPÓSITO. Lo que
  // no se puede falsear es que, al morir el padre, el sistema reasigna el proceso y el ppid CAMBIA.
  it('detecta la orfandad comparando el ppid, no esperando una señal', () => {
    expect(src).toMatch(/process\.ppid !== padreAlArrancar/)
    expect(src).toMatch(/nohup/)   // el porqué queda escrito en el código
  })

  it('solo aplica en modo --loop (una pasada suelta no tiene a quién sobrevivir)', () => {
    expect(src).toMatch(/loop && process\.ppid !== padreAlArrancar/)
  })

  it('sale del bucle en vez de seguir, y DICE por qué', () => {
    expect(src).toMatch(/salgo en vez de vigilar para nadie/)
    expect(src).toMatch(/if \(huerfano\(\)\) \{[\s\S]{0,220}break/)
  })

  // Comprueba ANTES y DESPUÉS de la espera: si solo mirara antes, un vigía huérfano se quedaría
  // dormido hasta la siguiente vuelta —hasta 15 minutos con `--cada 900`— consultando la BD.
  it('comprueba a los dos lados de la espera', () => {
    const bloque = src.slice(src.indexOf('const nuevas = await pasada'), src.indexOf('} while (loop)'))
    expect((bloque.match(/huerfano\(\)/g) || []).length).toBe(2)
  })

  it('cierra la conexión a la BD al salir, también si sale por orfandad', () => {
    expect(src).toMatch(/finally \{[\s\S]{0,120}sql\.end\(\)/)
  })
})
