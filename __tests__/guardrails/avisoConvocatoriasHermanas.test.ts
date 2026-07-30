// GUARDARRAÍL: la relación entre convocatorias hermanas vive en la BASE DE DATOS.
//
// ## Qué pasó (30/07/2026)
//
// Una usuaria estudió durante días el temario de la convocatoria equivocada. Auxiliar
// Administrativo de la Comunidad de Madrid tiene dos abiertas con programas distintos
// (examen octubre 2026 con Windows 10, junio 2027 con Windows 11) y se sirven como dos
// oposiciones separadas. En el selector se distinguen; una vez dentro, nada lo decía.
//
// La tentación al arreglarlo es escribir los pares de slugs en un fichero de configuración.
// Sería un silo: el catálogo de oposiciones vive en la base de datos, y esa lista se
// desincronizaría en la siguiente renovación de convocatoria — que las habrá, porque esto
// pasa cada vez que una oposición renueva con cambio de temario.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('de dónde sale que dos convocatorias son hermanas', () => {
  it('existe la columna en la migración, no una lista en código', () => {
    const mig = leer('supabase/migrations/20260730_grupo_convocatoria.sql')
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS grupo_convocatoria/)
    expect(mig).toMatch(/CREATE INDEX IF NOT EXISTS/)
  })

  it('la consulta lee esa columna y solo devuelve oposiciones ACTIVAS', () => {
    const q = leer('lib/api/convocatoria/hermanas.ts')
    expect(q).toContain('grupo_convocatoria')
    expect(q).toMatch(/o\.is_active/)
  })

  it('ningún fichero de código lleva los pares de slugs a mano', () => {
    // Si alguien "arregla" esto con un array de slugs, este test lo caza.
    const sospechosos = ['lib/convocatoria/convocatoriasHermanas.ts', 'components/convocatoria/AvisoConvocatoriasHermanas.tsx']
    for (const rel of sospechosos) {
      const src = leer(rel)
      expect(src).not.toMatch(/auxiliar-administrativo-madrid-2027['"]\s*[,\]]/)
    }
  })

  it('un fallo de la consulta NO puede tumbar la página de tests', () => {
    // Sin datos no se pinta el aviso: un aviso de menos molesta, una página caída mucho más.
    const q = leer('lib/api/convocatoria/hermanas.ts')
    expect(q).toMatch(/catch\s*\{[\s\S]*return \[\]/)
  })

  it('el aviso se pinta donde la persona elige oposición, no en una esquina', () => {
    const hub = leer('components/test/TestHubClient.tsx')
    expect(hub).toContain('AvisoConvocatoriasHermanas')
    // Y ofrece el flujo de cambio que YA existe, sin duplicarlo.
    expect(hub).toMatch(/onCambiar=\{\(\) => setShowOposicionModal\(true\)\}/)
  })

  it('deja rastro de si se ve y si se cierra (si nadie lo cierra, es que no se ve)', () => {
    const c = leer('components/convocatoria/AvisoConvocatoriasHermanas.tsx')
    expect(c).toContain('aviso_convocatorias_hermanas')
    expect(c).toMatch(/accion: 'mostrado'/)
    expect(c).toMatch(/accion: 'cerrado'/)
  })
})
