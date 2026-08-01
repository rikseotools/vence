/**
 * @jest-environment node
 *
 * La marca de «ya desplegado» sobre el pendiente de una tarea ([T-463], 01/08/2026).
 *
 * POR QUÉ: `pause --tras-deploy` guarda la espera dos veces —en `wake_on_deploy_sha` y en la
 * prosa del `--falta`— y al despertarla solo se limpiaba la columna. El texto seguía diciendo
 * «falta desplegar» para siempre, así que en `list` (el único sitio donde mira una persona) una
 * tarea desplegada y una bloqueada se veían idénticas. Medido: **10 de 10** tareas que decían
 * «desplegar» tenían el código YA VIVO, 3 de ellas críticas.
 *
 * La regla es conservadora a propósito: **añade, nunca borra**. Quitar «1) Desplegar FRONTEND»
 * de un texto ajeno deja un «2)» huérfano y puede llevarse contexto por delante, que es el
 * mismo daño que motivó [T-428].
 */
const { marcarDesplegado, yaMarcado, MARCA } = require('../../lib/backlog/marcaDesplegado.cjs')

describe('marcarDesplegado', () => {
  it('antepone la marca al pendiente que habla de desplegar', () => {
    const antes = '1) Desplegar FRONTEND. 2) Repetir la medición post-deploy.'
    const despues = marcarDesplegado(antes, 'abc1234567')
    expect(despues).toContain(MARCA)
    expect(despues).toContain('abc12345') // sha recortado a 8
    expect(despues).toContain('falta SOLO verificar')
  })

  it('NO borra nada del texto original', () => {
    // El texto es de otra sesión: se conserva entero, palabra por palabra.
    const antes = '1) Desplegar FRONTEND. 2) Repetir la medición con la consulta acotada por hora.'
    expect(marcarDesplegado(antes, 'abc')).toContain(antes)
  })

  it('es idempotente: dos deploys seguidos no apilan dos marcas', () => {
    const antes = 'Desplegar BACKEND y comprobar el barrido nocturno.'
    const uno = marcarDesplegado(antes, 'abc') as string
    expect(marcarDesplegado(uno, 'def')).toBeNull()
    expect(yaMarcado(uno)).toBe(true)
  })

  it('no toca el pendiente que NO habla de desplegar', () => {
    // Si el pendiente es «medir el 11/08», la marca no aporta y solo gastaría el preview de
    // `list`, que recorta a 160 caracteres.
    expect(marcarDesplegado('Medir la exposición en septiembre.', 'abc')).toBeNull()
  })

  it('devuelve null si no hay pendiente que marcar (el llamador se salta el UPDATE)', () => {
    expect(marcarDesplegado(null, 'abc')).toBeNull()
    expect(marcarDesplegado(undefined, 'abc')).toBeNull()
    expect(marcarDesplegado('   ', 'abc')).toBeNull()
  })

  it('aguanta sin sha (no inventa uno ni escribe "undefined")', () => {
    const r = marcarDesplegado('Desplegar frontend y mirar.', null) as string
    expect(r).toContain(MARCA)
    expect(r).not.toContain('undefined')
    expect(r).not.toContain('null')
  })

  it('reconoce «deploy» además de «desplegar»', () => {
    expect(marcarDesplegado('Esperar al deploy y comprobar el cron.', 'abc')).not.toBeNull()
  })

  it('la marca va DELANTE, que es lo que sobrevive al recorte de `list`', () => {
    const r = marcarDesplegado('Desplegar FRONTEND. ' + 'x'.repeat(400), 'abc1234') as string
    expect(r.slice(0, 160)).toContain(MARCA)
  })
})
