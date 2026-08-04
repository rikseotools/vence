// __tests__/architecture/defaultDeOposicionReal.test.ts
//
// UN VALOR POR DEFECTO QUE ES UNA OPOSICIÓN REAL. [T-541]
//
// Este defecto ha mordido CINCO veces y las cinco de la misma forma: quien olvida pasar su
// oposición no recibe un error ni una pantalla rota, sino **la oposición de otro**, que carga
// perfectamente. No falla: teletransporta. Y como no falla, lo descubre un usuario semanas
// después.
//
//   · 18/06  el enlace «Registrarse gratis» del modal de PDF mandaba a
//            `oposicion=auxiliar_enfermeria_osakidetza` desde ocho temarios (caso Alicia). De ahí
//            salió el guardarraíl hermano `temarioRegisterLink.test.ts`… que solo cubrió ESE
//            enlace: el `oposicion` por defecto de los mismos ocho ficheros siguió apuntando a
//            Osakidetza hasta hoy.
//   · 13/07  `ExamReviewLayout` con la flagship por defecto: «Volver a Tests» sacaba de su
//            oposición a todo el que no fuera del Estado (flor/MariSol).
//   · 04/08  `TopicContentView` y `TestPageWrapper`/`TestLayout`: cuatro enlaces sacaban al
//            usuario de su oposición personalizada (Sergio, premium).
//
// ── QUÉ VIGILA, Y QUÉ NO ────────────────────────────────────────────────────────────────────
//
// Solo los ficheros que viven DENTRO de una oposición (`app/<slug>/**`). Ahí son clones por
// oposición y el default legítimo es el suyo: que nombre a OTRA no tiene ningún caso de uso.
//
// NO opina sobre las páginas globales (`app/perfil`, `app/test/aleatorio`, `app/mis-estadisticas`,
// rutas de API…): no tienen oposición propia, así que caer en la flagship es una decisión de
// producto, no un descuido. Marcarlas ahogaría la señal — la calibración es lo que separa un
// guardarraíl de un ruido.
//
// En los componentes COMPARTIDOS (`components/**`) esto no hace falta: `positionType` de
// `TestConfigurator` es ya **obligatoria por tipo**, que es más fuerte que cualquier test.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { ALL_OPOSICION_SLUGS, ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'

const { defaultsDeOposicion } = require('@/lib/calidad/defaultDeOposicion.cjs')

const raiz = process.cwd()
const IDENTIFICADORES = new Set<string>([...ALL_OPOSICION_SLUGS, ...ALL_OPOSICION_IDS])

/** Ficheros de código bajo `app/<slug>/**` donde `<slug>` es una oposición del catálogo. */
function ficherosDeOposiciones(): Array<{ ruta: string; propia: string }> {
  const salida: Array<{ ruta: string; propia: string }> = []
  const appDir = join(raiz, 'app')
  for (const dir of readdirSync(appDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || !ALL_OPOSICION_SLUGS.includes(dir.name)) continue
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) salida.push({ ruta: relative(raiz, p), propia: dir.name })
      }
    }
    walk(join(appDir, dir.name))
  }
  return salida
}

describe('ninguna página de una oposición tiene a OTRA por defecto', () => {
  const ficheros = ficherosDeOposiciones()

  it('encuentra páginas de oposición que revisar (si no, el guardarraíl no mira nada)', () => {
    expect(ficheros.length).toBeGreaterThan(100)
  })

  it('ningún default nombra una oposición distinta de la suya', () => {
    const fallos: string[] = []
    for (const { ruta, propia } of ficheros) {
      const hits = defaultsDeOposicion(readFileSync(join(raiz, ruta), 'utf8'), IDENTIFICADORES, propia)
      for (const h of hits) fallos.push(`${ruta}:${h.linea} → ${h.prop} = '${h.valor}' (la suya es '${propia}')`)
    }
    expect(fallos).toEqual([])
  })
})

describe('el componente compartido del configurador exige la oposición, no la supone', () => {
  it('`positionType` es obligatoria en el tipo (lo impide el compilador, no un aviso)', () => {
    const tipos = readFileSync(join(raiz, 'components/TestConfigurator.types.ts'), 'utf8')
    // Solo la interfaz de PROPS. El mismo fichero declara `positionType?` en el payload de
    // configuración guardada, donde ser opcional es correcto: mirar el fichero entero mezclaría
    // dos contratos distintos y el guardarraíl fallaría por algo que está bien.
    const props = tipos.slice(tipos.indexOf('interface TestConfiguratorProps'))
    const bloque = props.slice(0, props.indexOf('\n}'))
    expect(bloque).toMatch(/^\s{2}positionType: string$/m)
    expect(bloque).not.toMatch(/positionType\?: string/)
  })

  it('…y no ha vuelto a colarse un default de oposición en el componente', () => {
    const comp = readFileSync(join(raiz, 'components/TestConfigurator.tsx'), 'utf8')
    const hits = defaultsDeOposicion(comp, IDENTIFICADORES, null)
    expect(hits).toEqual([])
  })
})

describe('el guardarraíl hermano del enlace de registro sigue en pie', () => {
  // Se comprueba aquí a propósito: aquel cubrió el enlace y dejó fuera el `oposicion` por
  // defecto de los MISMOS ficheros, que es como el defecto sobrevivió mes y medio. Si alguien
  // borra ese fichero, esta pareja deja de tener sentido y hay que enterarse.
  it('existe', () => {
    expect(existsSync(join(raiz, '__tests__/architecture/temarioRegisterLink.test.ts'))).toBe(true)
  })
})
