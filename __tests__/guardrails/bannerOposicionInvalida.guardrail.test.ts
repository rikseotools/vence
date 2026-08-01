/**
 * El aviso de «tu oposición no está disponible» tiene que DECIR CUÁL. (T-327)
 *
 * Manuel lo vio en producción: una franja naranja diciendo «la oposición que tienes seleccionada
 * aún no está disponible en Vence» — sin nombrarla. Dos problemas a la vez:
 *
 *  · **el usuario no sabe qué le pasa.** No puede ni contárnoslo bien: «me sale un aviso raro».
 *  · **nosotros tampoco.** Para ayudarle hay que abrirle el perfil en la base de datos, así que
 *    un aviso pensado para que se arregle solo acaba costando una intervención manual.
 *
 * Un aviso que no dice sobre QUÉ avisa no es un aviso: es una alarma sin dirección.
 *
 * Lo que este fichero impide: que alguien simplifique el banner quitando el nombre (la tentación
 * es real, el texto queda más corto) y que el contexto deje de conservar cuál era la oposición
 * inválida — que es de donde sale el nombre. Lo segundo es lo fácil de romper sin querer: la
 * rama que marca el fallo BORRA la oposición del estado, y guardar el dato antes de borrarlo
 * parece código de más hasta que alguien pregunta «¿cuál?».
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

describe('el contexto conserva QUÉ oposición no se pudo resolver', () => {
  const ctx = leer('contexts/OposicionContext.tsx')

  it('lo expone en su contrato', () => {
    expect(ctx).toMatch(/objetivoInvalido:\s*\{\s*id:\s*string;\s*nombre:\s*string \| null\s*\}\s*\| null/)
  })

  it('lo GUARDA en la rama del fallo ANTES de nulear la oposición', () => {
    // El orden importa: esa rama pone `userOposicion` a null, así que guardarlo después
    // guardaría un null y el banner volvería a no tener nombre.
    const i = ctx.indexOf('setNeedsOposicionFix(true)')
    expect(i).toBeGreaterThan(-1)
    const bloque = ctx.slice(i, i + 400)
    expect(bloque).toMatch(/setObjetivoInvalido\(\{/)
    expect(bloque.indexOf('setObjetivoInvalido')).toBeLessThan(bloque.indexOf('setUserOposicion(null)'))
  })

  it('lo LIMPIA cuando la oposición sí es válida (si no, el aviso se queda pegado)', () => {
    expect(ctx).toMatch(/setNeedsOposicionFix\(false\)\s*\n\s*setObjetivoInvalido\(null\)/)
  })
})

describe('el banner nombra la oposición', () => {
  const header = leer('app/Header.tsx')

  it('lee el dato del contexto', () => {
    expect(header).toContain('objetivoInvalido')
  })

  it('lo pinta DENTRO del aviso y destacado', () => {
    const i = header.indexOf('aún no está disponible en Vence')
    expect(i).toBeGreaterThan(-1)
    const bloque = header.slice(Math.max(0, i - 800), i + 200)
    expect(bloque).toMatch(/objetivoInvalido\.nombre \|\| objetivoInvalido\.id/)
    // En otro color: en el mismo se leería como parte de la frase, no como el dato a mirar.
    expect(bloque).toMatch(/bg-white\/25|text-yellow-100/)
  })

  it('sin nombre conocido enseña el IDENTIFICADOR, no «(sin nombre)»', () => {
    // El id ya permite buscarla. Un «(sin nombre)» no ayuda ni al usuario ni a quien lo mire.
    expect(header).toContain('objetivoInvalido.nombre || objetivoInvalido.id')
  })
})
