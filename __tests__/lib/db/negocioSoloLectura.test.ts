/**
 * @jest-environment node
 *
 * [T-624] Con qué credencial se lee una tabla de negocio.
 *
 * Hay DOS roles para DOS cosas: `DATABASE_URL` es coordinación (desde [T-539] solo alcanza las 4
 * tablas de la flota) y `VENCE_LECTOR_URL` es lectura de negocio ([T-486]). Un script que solo
 * lee negocio quiere siempre el segundo, y hasta hoy cada uno lo resolvía por su cuenta.
 *
 * Estos tests son DETERMINISTAS en cualquier máquina: el núcleo recibe el entorno y el contenido
 * del fichero, no los busca. La versión anterior se probaba contra el `.env.local` REAL, pasaba
 * en el portátil donde se escribió y fallaba en este worktree — porque los worktrees copian ese
 * fichero y no todos llevan `VENCE_LECTOR_URL`. Un test que depende de un fichero ignorado por
 * git no prueba el código: prueba la máquina.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolver, urlLecturaNegocio, urlLecturaNegocioConFuente, PREFERENCIA } = require('../../../lib/db/negocioSoloLectura.cjs')

const LECTOR = 'postgres://vence_lector:x@host/app'
const COORD = 'postgres://vence_coordinacion:x@host/app'

describe('[T-624] resolver — el rol de MENOR privilegio gana', () => {
  it('con el lector en el entorno, se usa el lector', () => {
    expect(resolver({ VENCE_LECTOR_URL: LECTOR, DATABASE_URL: COORD }, '')).toEqual({
      url: LECTOR, fuente: 'VENCE_LECTOR_URL (entorno)',
    })
  })

  it('EL CASO QUE MOTIVA LA FICHA: el lector del FICHERO gana al de coordinación del ENTORNO', () => {
    // Un trabajador con DATABASE_URL restringido exportado no puede quedarse sin leer negocio
    // solo porque su credencial buena esté en el fichero. Y al revés: no es «el último que
    // alguien exportó», es el rol correcto para la tarea.
    const r = resolver({ DATABASE_URL: COORD }, `VENCE_LECTOR_URL=${LECTOR}\n`)
    expect(r).toEqual({ url: LECTOR, fuente: 'VENCE_LECTOR_URL (.env.local)' })
  })

  it('sin lector por ningún lado, cae a coordinación (una persona no tiene lector y sigue trabajando)', () => {
    expect(resolver({ DATABASE_URL: COORD }, '')).toEqual({ url: COORD, fuente: 'DATABASE_URL (entorno)' })
    expect(resolver({}, `DATABASE_URL=${COORD}\n`)).toEqual({ url: COORD, fuente: 'DATABASE_URL (.env.local)' })
  })

  it('sin ninguna, devuelve null en vez de inventarse una', () => {
    expect(resolver({}, '')).toBeNull()
  })

  it('una variable vacía o con espacios NO cuenta como declarada', () => {
    // `VENCE_LECTOR_URL=` en el fichero es el caso real de una plantilla sin rellenar.
    expect(resolver({ VENCE_LECTOR_URL: '   ', DATABASE_URL: COORD }, '')).toMatchObject({ url: COORD })
    expect(resolver({}, `VENCE_LECTOR_URL=\nDATABASE_URL=${COORD}\n`)).toMatchObject({ url: COORD })
  })

  it('no casa una clave que solo TERMINA igual (VENCE_LECTOR_URL vs OTRA_VENCE_LECTOR_URL)', () => {
    expect(resolver({}, `OTRA_VENCE_LECTOR_URL=${LECTOR}\nDATABASE_URL=${COORD}\n`)).toMatchObject({ url: COORD })
  })

  it('el orden de preferencia está declarado en UN sitio y va de menor a mayor privilegio', () => {
    expect(PREFERENCIA).toEqual(['VENCE_LECTOR_URL', 'DATABASE_URL'])
  })
})

describe('[T-624] urlLecturaNegocio — la envoltura', () => {
  it('devuelve la url, con el entorno y el fichero inyectados', () => {
    expect(urlLecturaNegocio({ env: {}, envFile: `VENCE_LECTOR_URL=${LECTOR}\n` })).toBe(LECTOR)
  })

  it('sin credencial LANZA, y el mensaje dice qué exportar', () => {
    // Quedarse sin credencial es un error de configuración: degradarlo en silencio es cómo un
    // trabajador «funciona» sin mirar nada (T-539).
    expect(() => urlLecturaNegocio({ env: {}, envFile: '' })).toThrow(/VENCE_LECTOR_URL/)
  })

  it('sabe DECIR de dónde salió, para poder imprimirlo', () => {
    expect(urlLecturaNegocioConFuente({ env: { DATABASE_URL: COORD }, envFile: '' }))
      .toMatchObject({ fuente: 'DATABASE_URL (entorno)' })
  })
})
