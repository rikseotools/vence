/**
 * [T-711] Una espera de deploy que dejó de poder cumplirse tiene que VERSE.
 *
 * [T-620] impide pausar contra un sha inalcanzable, y deja pasar a propósito el caso
 * `sin_pushear` (pausar antes de empujar es legítimo). El hueco está después: si esa rama no se
 * fusiona nunca, el sha jamás llega a `origin/main` y la tarea duerme indefinidamente sin salir en
 * ninguna cola. Medido el 08/08: 15 tareas así, cuatro de ellas desde el día anterior.
 */
const { esperasVaradas } = require('../../lib/backlog/esperasVaradas.cjs')

const T = (id: string, sha: string) => ({ id, title: `titulo de ${id}`, wake_on_deploy_sha: sha })
const SANA = { existe: true, enOriginMain: true, enHead: true }
const EN_RAMA = { existe: true, enOriginMain: false, enHead: false }
const SIN_PUSHEAR = { existe: true, enOriginMain: false, enHead: true }

describe('[T-711] esperasVaradas', () => {
  it('no denuncia la espera SANA: su commit ya está en origin/main', () => {
    expect(esperasVaradas([T('T-1', 'aaa')], () => SANA)).toEqual([])
  })

  it('denuncia el commit que vive en una rama sin fusionar, y dice CUÁL', () => {
    const r = esperasVaradas([T('T-600', 'b7f184da7')], () => EN_RAMA,
      () => ['origin/flota/T-600-temas-sin-description'])
    expect(r).toHaveLength(1)
    expect(r[0].donde).toContain('origin/flota/T-600-temas-sin-description')
    expect(r[0].donde).toMatch(/mergear esa rama/)
  })

  it('NO dice «no lo alcanza nadie» de un commit que existe: eso manda a buscar donde no hay nada', () => {
    // El error que se cometió al estrenarlo: cuatro tareas señaladas como shas perdidos cuando
    // sus commits estaban perfectamente en `origin/flota/…`.
    const r = esperasVaradas([T('T-1', 'aaa')], () => EN_RAMA, () => ['origin/flota/rama'])
    expect(r[0].donde).not.toMatch(/no está en/)
  })

  it('descarta `origin/main` al nombrar la rama (si estuviera ahí, no sería una varada)', () => {
    const r = esperasVaradas([T('T-1', 'aaa')], () => EN_RAMA, () => ['origin/main', 'origin/flota/x'])
    expect(r[0].donde).toContain('origin/flota/x')
  })

  it('sin rama remota y sin pushear: dice que hay que empujarlo', () => {
    const r = esperasVaradas([T('T-1', 'aaa')], () => SIN_PUSHEAR, () => [])
    expect(r[0].donde).toMatch(/empújalo/i)
  })

  it('sin rama remota y sin HEAD: manda repuntar la espera', () => {
    const r = esperasVaradas([T('T-1', 'aaa')], () => EN_RAMA, () => [])
    expect(r[0].donde).toMatch(/repunta la espera/)
  })

  it('NO acusa cuando git no pudo contestar: lo que no se sabe no se denuncia', () => {
    // Mismo fail-open que el resto del andamiaje: aquí no hay nada irreversible que proteger,
    // y lo peor que pasa es que la tarea siga esperando, que es lo que ya hacía.
    expect(esperasVaradas([T('T-1', 'aaa')], () => ({}))).toEqual([])
  })

  it('un `medir` que revienta no tumba el parte entero', () => {
    expect(() => esperasVaradas([T('T-1', 'aaa')], () => { throw new Error('git roto') })).not.toThrow()
    expect(esperasVaradas([T('T-1', 'aaa')], () => { throw new Error('git roto') })).toEqual([])
  })

  it('un `ramas` que revienta degrada el mensaje, no la lista', () => {
    const r = esperasVaradas([T('T-1', 'aaa')], () => EN_RAMA, () => { throw new Error('git roto') })
    expect(r).toHaveLength(1)
    expect(r[0].donde).toBeTruthy()
  })

  it('ignora filas sin sha y aguanta entradas vacías', () => {
    expect(esperasVaradas([{ id: 'T-1' } as any], () => EN_RAMA)).toEqual([])
    expect(esperasVaradas([], () => EN_RAMA)).toEqual([])
    expect(esperasVaradas(null as any, () => EN_RAMA)).toEqual([])
  })

  it('no reimplementa el criterio: delega en `clasificarShaEspera`', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'backlog', 'esperasVaradas.cjs'), 'utf8')
    expect(src).toContain("require('./esperaDeploy.cjs')")
    expect(src).toContain('clasificarShaEspera')
  })
})

describe('[T-718] `wake` levanta las CINCO esperas, también la de deploy', () => {
  const fs = require('fs')
  const path = require('path')
  const cli = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'backlog.cjs'), 'utf8')
  const bloque = cli.slice(cli.indexOf("cmd === 'wake'"), cli.indexOf("cmd === 'wake'") + 2500)

  it('limpia también `wake_on_deploy_sha`, que era la única que se quedaba', () => {
    // Es justo la que puede volverse IMPOSIBLE: si la rama con ese commit no se fusiona nunca,
    // ningún deploy puede contenerlo. 16 tareas así el 08/08, algunas de dos días — el detector
    // de [T-711] las enseñaba y NO había comando para desatascarlas: `wake` decía «despierta» y
    // las dejaba exactamente igual.
    expect(bloque).toMatch(/wake_on_deploy_sha\s*=\s*NULL/)
    expect(bloque).toMatch(/wake_on_deploy_surface\s*=\s*NULL/)
  })

  it('sigue levantando las otras: reloj y revisión', () => {
    expect(bloque).toMatch(/snooze_until\s*=\s*NULL/)
    expect(bloque).toMatch(/review_requested_at\s*=\s*NULL/)
  })

  it('es UN solo UPDATE: despertar a medias es como se quedaron varadas', () => {
    const updates = (bloque.match(/UPDATE public\.backlog_tasks/g) || []).length
    expect(updates).toBe(1)
  })
})
