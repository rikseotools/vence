/**
 * Vence Sim — selección de journeys y resolución del secreto de sesión.
 *
 * Las dos piezas que hacen que el harness NO esté atado a una nube: qué se corre tras publicar
 * una versión (lo declara cada journey, no el script del proveedor) y de dónde sale el secreto
 * de la cuenta de test (env primero; SSM es una comodidad local, no un requisito).
 */
import { leerArgs, porNombre, paraVerificarRelease, seleccionar } from '@/lib/sim/seleccion'
import { proveedorActivo, resolverAuthSecret, resolverIdentidad } from '@/lib/sim/secretos'
import type { Journey } from '@/lib/sim/journey'

const j = (name: string, postDeploy?: boolean) =>
  ({ name, severity: 'high', postDeploy, run: async () => [] }) as unknown as Journey

describe('selección de journeys', () => {
  const todos = [j('examen-controles-flotantes', true), j('por-leyes-network-blip'), j('evolucion-cabecera', false)]

  it('sin filtro los corre todos', () => {
    expect(porNombre(todos, '').map(x => x.name)).toHaveLength(3)
  })

  it('filtra por subcadena del nombre', () => {
    expect(porNombre(todos, 'examen').map(x => x.name)).toEqual(['examen-controles-flotantes'])
  })

  it('para verificar un release corre SOLO los marcados', () => {
    expect(paraVerificarRelease(todos).map(x => x.name)).toEqual(['examen-controles-flotantes'])
  })

  it('`--post-deploy` manda sobre el filtro de nombre (es un modo, no una búsqueda)', () => {
    expect(seleccionar(todos, { filtro: 'por-leyes', soloPostDeploy: true }).map(x => x.name))
      .toEqual(['examen-controles-flotantes'])
  })

  it('lee los argumentos del runner', () => {
    expect(leerArgs(['--post-deploy'])).toEqual({ filtro: '', soloPostDeploy: true })
    expect(leerArgs(['examen'])).toEqual({ filtro: 'examen', soloPostDeploy: false })
    expect(leerArgs(['--post-deploy', 'examen'])).toEqual({ filtro: 'examen', soloPostDeploy: true })
    expect(leerArgs([])).toEqual({ filtro: '', soloPostDeploy: false })
  })

  it('si nadie declara `postDeploy`, la verificación de release no corre nada (y el runner lo dirá)', () => {
    expect(paraVerificarRelease([j('a'), j('b')])).toEqual([])
  })
})

describe('resolución del secreto (agnóstica de la nube)', () => {
  const SECRETO = 'un-secreto-suficientemente-largo'

  it('el entorno gana: no se llama a ninguna nube', () => {
    const ejecutar = jest.fn()
    expect(resolverAuthSecret({ env: { SIM_AUTH_SECRET: SECRETO }, ejecutar })).toBe(SECRETO)
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('acepta también AUTH_SECRET (el nombre que usa el propio app)', () => {
    expect(resolverAuthSecret({ env: { AUTH_SECRET: SECRETO } })).toBe(SECRETO)
  })

  it('un valor de pega (demasiado corto) NO cuela como secreto', () => {
    expect(resolverAuthSecret({ env: { SIM_AUTH_SECRET: 'corto' } })).toBeNull()
  })

  it('con el proveedor `env` NO cae a SSM aunque falte el valor (koigrid: solo entorno)', () => {
    const ejecutar = jest.fn(() => SECRETO)
    expect(resolverAuthSecret({ env: { SIM_SECRET_PROVIDER: 'env' }, ejecutar })).toBeNull()
    expect(ejecutar).not.toHaveBeenCalled()
  })

  it('con `aws-ssm` (por defecto) cae a SSM cuando el entorno no lo trae', () => {
    const ejecutar = jest.fn(() => `${SECRETO}\n`)
    expect(resolverAuthSecret({ env: {}, ejecutar })).toBe(SECRETO)
    expect(ejecutar.mock.calls[0][0]).toContain('/vence-frontend/AUTH_SECRET')
  })

  it('la ruta del parámetro es configurable (otra cuenta u otro nombre)', () => {
    const ejecutar = jest.fn(() => SECRETO)
    resolverAuthSecret({ env: { SIM_AUTH_SECRET_SSM_PATH: '/otro/AUTH' }, ejecutar })
    expect(ejecutar.mock.calls[0][0]).toContain('/otro/AUTH')
  })

  it('si el proveedor falla no revienta: devuelve null y el journey autenticado se salta', () => {
    const ejecutar = jest.fn(() => { throw new Error('sin credenciales') })
    expect(resolverAuthSecret({ env: {}, ejecutar })).toBeNull()
  })

  it('sin manera de ejecutar nada (CI limpio) tampoco revienta', () => {
    expect(resolverAuthSecret({ env: {} })).toBeNull()
  })

  it('proveedorActivo: por defecto aws-ssm, y solo acepta los conocidos', () => {
    expect(proveedorActivo({})).toBe('aws-ssm')
    expect(proveedorActivo({ SIM_SECRET_PROVIDER: 'env' })).toBe('env')
    expect(proveedorActivo({ SIM_SECRET_PROVIDER: 'inventado' })).toBe('aws-ssm')
  })
})

describe('identidad de la cuenta de test', () => {
  it('sin identidad devuelve null (el runner salta el journey en vez de inventarse un usuario)', () => {
    expect(resolverIdentidad({})).toBeNull()
  })

  it('SIM_IDENTITY_USER_ID manda sobre SMOKE_USER_ID', () => {
    expect(resolverIdentidad({ SIM_IDENTITY_USER_ID: 'a', SMOKE_USER_ID: 'b' })?.userId).toBe('a')
  })

  it('cae a SMOKE_USER_ID, la misma cuenta que usan los canary de API', () => {
    expect(resolverIdentidad({ SMOKE_USER_ID: 'b' })).toEqual({ userId: 'b', email: 'smoke@vence.es' })
  })
})
