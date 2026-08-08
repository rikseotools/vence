// __tests__/flota/sondaMaquinaSeInvoca.test.ts — [T-712]
//
// La sonda de salud de máquina de [T-677] estaba desplegada, corriendo y **sin medir nada**.
//
// El bucle recorría `MAQ.trabajadoresQueReciben()`, que devuelve `{ trabajador, maquina }`, y le
// pasaba el OBJETO ENTERO a `maquinaDe()`. Esa función devolvía `null` —su forma de decir «ese
// trabajador no está declarado»— y la línea siguiente hacía `continue`. Resultado: 439 pasadas
// del bucle y UN solo evento `flota_maquina_salud`, el que emitió una persona a mano desde el
// panel, que sí desestructuraba (`f.trabajador`).
//
// Es un falso verde de manual y encima en la herramienta que vigila a las demás: el MISMO código
// medía bien cuando alguien pasaba por delante y no medía nada cuando no había nadie. Y se
// diagnosticó primero como un problema de SSH («el supervisor se sondea a sí mismo»), que era
// una hipótesis razonable y FALSA — comprobado en el VPS: `VENCE_FLOTA_AQUI=flota-1` está puesto
// y `maquinaDe('w1').local` da `true`, así que nunca hubo ssh de por medio.
//
// Dos capas, porque el arreglo de una línea no impide la recaída:
//   1. `maquinaDe` LANZA ante un tipo que no sea string, en vez de devolver `null`. Así el error
//      de programación deja de salir por la misma puerta que un estado normal.
//   2. Este test fija que el bucle desestructura, que es lo que se rompió.

const fs = require('fs')
const path = require('path')

const MAQ = require('../../lib/flota/maquinas.cjs')

describe('[T-712] maquinaDe distingue «no declarado» de «me has pasado otra cosa»', () => {
  it('un nombre que no existe sigue dando null: es un estado normal, no un error', () => {
    expect(MAQ.maquinaDe('trabajador-retirado')).toBeNull()
  })

  it('el objeto de trabajadoresQueReciben() LANZA en vez de colarse como «no declarado»', () => {
    const item = MAQ.trabajadoresQueReciben()[0]
    expect(item).toEqual(expect.objectContaining({ trabajador: expect.any(String) }))
    // Esto es lo que hacía el bucle. Antes devolvía null y el `continue` lo enterraba.
    expect(() => MAQ.maquinaDe(item)).toThrow(TypeError)
  })

  it('el mensaje dice CÓMO se arregla (un error que no enseña la salida se rodea a ciegas)', () => {
    const item = MAQ.trabajadoresQueReciben()[0]
    expect(() => MAQ.maquinaDe(item)).toThrow(/desestructura/i)
  })

  it('desestructurando sí resuelve, que es la prueba de que el dato estaba bien', () => {
    const { trabajador } = MAQ.trabajadoresQueReciben()[0]
    expect(MAQ.maquinaDe(trabajador)).not.toBeNull()
  })

  it('otros tipos equivocados también lanzan (null/undefined/número)', () => {
    for (const malo of [null, undefined, 42, ['w1']]) {
      expect(() => MAQ.maquinaDe(malo as never)).toThrow(TypeError)
    }
  })
})

describe('[T-712] el bucle del supervisor invoca la sonda con el NOMBRE', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('ningún `for (const w of MAQ.trabajadoresQueReciben())` sin desestructurar', () => {
    // La forma exacta que falló. Se mira el código, no la prosa de los comentarios.
    const sinComentarios = fuente
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*(\/\/|\*).*$/gm, '')
    const malos = [...sinComentarios.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+MAQ\.trabajadores\w+\(\)/g)]
    expect(malos.map((m) => m[0])).toEqual([])
  })

  it('la sonda se llama desde el BUCLE, no solo al pintar el panel', () => {
    // [T-677] ya midió que medir solo en el panel es «una alerta que depende de que alguien pase
    // por delante». Si alguien la saca del bucle otra vez, esto lo dice.
    const bucle = fuente.slice(fuente.indexOf("if (cmd === 'bucle')"))
    expect(bucle.length).toBeGreaterThan(1000) // que el ancla siga existiendo, no un slice vacío
    expect(bucle).toContain('medirMaquina(')
  })

  it('una máquina que no se puede medir deja rastro, no un `continue` mudo', () => {
    expect(fuente).toContain("estado: 'sin_medida'")
  })
})
