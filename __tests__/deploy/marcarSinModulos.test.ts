/**
 * @jest-environment node
 */
// El marcado de deploys tiene que funcionar desde un árbol SIN node_modules (T-404 bis).
//
// El deploy corre desde un árbol dedicado, y ese árbol puede no tener node_modules: el build es
// Docker y no los necesita, así que nadie los echa en falta. Sin fallback, el `require('postgres')`
// reventaba, el fail-open se lo tragaba EN SILENCIO y la fila nunca se escribía — `deploy-estado`
// decía «libre» con un deploy corriendo.
//
// Encontrado en el PRIMER deploy real por el camino nuevo. Ningún test lo habría visto: en el
// repo principal los módulos SÍ están.
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'scripts/deploy-marcar.cjs'), 'utf8')

describe('deploy-marcar.cjs — carga postgres aunque el árbol esté pelado', () => {
  it('intenta primero el require normal', () => {
    expect(src).toMatch(/try \{ return require\('postgres'\) \}/)
  })

  // El primer intento de arreglo apuntaba a REPO, que es ESTE árbol — el mismo que no tiene los
  // módulos. No servía de nada, y solo se vio al probarlo de verdad.
  it('el fallback localiza el repo PRINCIPAL por git, no el árbol actual', () => {
    expect(src).toMatch(/--git-common-dir/)
    expect(src).toMatch(/path\.resolve\(REPO, comun, '\.\.'\)/)
    expect(src).toMatch(/principal, 'node_modules', 'postgres'/)
  })

  it('sigue siendo fail-open: un fallo del marcado nunca tumba un deploy', () => {
    expect(src).toMatch(/main\(\)\.catch\(\(\) => \{\}\)/)
    expect(src).toMatch(/process\.exit\(0\)/)
  })
})
