/**
 * @jest-environment node
 */
// __tests__/canary/landingSsotContractBD.test.ts
//
// (Entorno `node` a propósito: el driver de Postgres usa `clearImmediate`, que jsdom no trae — en
// jsdom la conexión muere y la query «falla» por el entorno, no por el contrato. Un canario que se
// pone rojo por su propio andamiaje enseña a ignorarlo.)
//
// CANARY del CONTRATO entre la query de la landing y la vista `oposiciones_ssot`.
//
// ## Qué avería vigila (28/07/2026)
//
// La landing lee de la vista con SQL crudo, y la vista la editan MIGRACIONES: son dos ficheros que
// nadie ata. El día que la query pidió `plazas_discapacidad_incluidas` —una columna que la vista
// usaba por dentro para derivar `plazas_total` pero NO proyectaba— Postgres devolvió `42703`, el
// `catch` de `getOposicionLandingData` lo tradujo a `return null` y la página se habría quedado
// PLAUSIBLE en vez de rota: sin plazas, sin fechas, sin BOE, sin SEO, sin FAQs y sin estadísticas,
// con 200, sin badge, y con el null cacheado. Ni el typecheck ni los unitarios ven ese contrato:
// solo lo sabe la BD.
//
// ## Por qué llama a la función real y no repite la lista de columnas
//
// Copiar aquí el SELECT sería crear la tercera copia del mismo contrato y garantizar que drifta.
// Se ejecuta la función que usa la página: si le falta UNA columna a la vista, devuelve null y esto
// se pone rojo. Cubre además cualquier futura columna que alguien añada al SELECT sin migrar.
//
// Guardado por DATABASE_URL (mismo patrón que `oposicionIdentityBD`): se SALTA en CI sin BD y corre
// en local / post-deploy con `DATABASE_URL=... npx jest landingSsotContractBD`.

const HAS_DB = !!process.env.DATABASE_URL
const d = HAS_DB ? describe : describe.skip

d('CANARY: la vista oposiciones_ssot sirve TODO lo que pide la landing', () => {
  // Slugs activos de verdad, elegidos por lo que ejercitan: el primero es la landing de más tráfico,
  // el segundo tiene el cupo de discapacidad DENTRO del turno libre (que es el dato que destapó el
  // fallo) y el tercero lo tiene sin declarar (la rama que calla).
  const SLUGS = ['auxiliar-administrativo-estado', 'auxilio-judicial']

  it.each(SLUGS)('%s devuelve datos, no null', async (slug) => {
    const { getOposicionLandingData } = await import('@/lib/api/convocatoria/queries')
    const data = await getOposicionLandingData(slug)
    // null aquí NO significa «no hay convocatoria»: significa que la query REVENTÓ (el catch se lo
    // come). Si algún día un slug legítimo deja de existir, cámbialo — no relajes la aserción.
    expect(data).not.toBeNull()
    expect(data!.nombre).toBeTruthy()
  }, 30000)

  it('la relación del cupo de discapacidad llega al render (no se queda en la vista)', async () => {
    const { getOposicionLandingData } = await import('@/lib/api/convocatoria/queries')
    const data = await getOposicionLandingData('auxilio-judicial')
    expect(data).not.toBeNull()
    // El campo debe EXISTIR en el objeto (aunque su valor sea null en otras convocatorias): es lo
    // que decide si la frase dice «de las cuales N» o «y otras N», y sin él la landing y la meta
    // description se contradicen. `undefined` = la vista no lo proyecta.
    expect(data).toHaveProperty('plazasDiscapacidadIncluidas')
    expect(data!.plazasDiscapacidadIncluidas).not.toBeUndefined()
  }, 30000)
})
