// __tests__/health/seguimientoVigilableMirror.parity.test.ts
//
// Paridad NÚCLEO ↔ ESPEJO del clasificador de vigilabilidad de `seguimiento_url`.
//
// El writer real de `content_health_findings` es el `@Cron` del backend
// (`backend/src/content-health-sweep/content-health-sweep.service.ts`), que NO puede importar del
// `lib/` del frontend (proyecto NestJS aparte) y por eso lleva un **mirror inline** de
// `lib/convocatoria/seguimientoVigilable.cjs`. Un mirror a mano se desincroniza solo: pasó con el
// sweep entero el 22/07 (8 detectores de diferencia, snapshot incompleto cada noche EN SILENCIO).
//
// `__tests__/health/content-sweep-parity.test.ts` ya vigila que ambos emitan los mismos `kind`s.
// Lo que NO vigila —y es justo donde duele— es que la LÓGICA sea la misma: los dos pueden emitir
// `seguimiento_fuente_ciega` y discrepar en QUÉ marcan. Este test cierra eso.
//
// Cómo se compara (lección de T-134): **evaluando los literales** del espejo, no con una regex
// sobre regex-literales — una regex sobre barras escapadas se rompe con el primer patrón raro y el
// test mentiría en silencio. Y además se comprueba el COMPORTAMIENTO sobre textos reales.

import fs from 'fs'
import path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
const {
  clasificarVigilancia,
  PATRONES_CABECERA_FALSA,
  PATRONES_CUERPO_FALSO,
  UMBRAL_CABECERA,
  UMBRAL_CIEGA,
  UMBRAL_DUDOSO,
} = require('../../lib/convocatoria/seguimientoVigilable.cjs')

const REPO = path.resolve(__dirname, '../..')
const BACKEND = fs.readFileSync(
  path.join(REPO, 'backend/src/content-health-sweep/content-health-sweep.service.ts'),
  'utf8',
)

/** Evalúa un `const <nombre>...= [ … ];` del fichero del backend quitándole el tipo TS. */
function literalArray(nombre: string): Array<{ nivel: string; re: RegExp; motivo: string }> {
  const m = BACKEND.match(new RegExp(`const ${nombre}[^=]*=\\s*(\\[[\\s\\S]*?\\n\\];)`))
  if (!m) throw new Error(`no encuentro el literal ${nombre} en el service del backend`)
  // eslint-disable-next-line no-new-func
  return new Function(`return ${m[1].replace(/;$/, '')}`)()
}

function literalNumero(nombre: string): number {
  const m = BACKEND.match(new RegExp(`const ${nombre}\\s*=\\s*(\\d+)`))
  if (!m) throw new Error(`no encuentro la constante ${nombre} en el service del backend`)
  return Number(m[1])
}

const huella = (ps: Array<{ nivel: string; re: RegExp; motivo: string }>) =>
  ps.map((p) => `${p.nivel}::${p.re.source}::${p.re.flags}::${p.motivo}`).sort()

describe('seguimientoVigilable — paridad núcleo puro ↔ mirror inline del @Cron', () => {
  it('los UMBRALES son idénticos en los dos lados', () => {
    expect(literalNumero('VIG_UMBRAL_CIEGA')).toBe(UMBRAL_CIEGA)
    expect(literalNumero('VIG_UMBRAL_DUDOSO')).toBe(UMBRAL_DUDOSO)
    expect(literalNumero('VIG_UMBRAL_CABECERA')).toBe(UMBRAL_CABECERA)
  })

  it('los patrones de CUERPO son los mismos (nivel, regex y motivo)', () => {
    expect(huella(literalArray('VIG_PATRONES'))).toEqual(huella(PATRONES_CUERPO_FALSO))
  })

  it('los patrones de CABECERA son los mismos (nivel, regex y motivo)', () => {
    expect(huella(literalArray('VIG_PATRONES_CABECERA'))).toEqual(huella(PATRONES_CABECERA_FALSA))
  })

  // Que los patrones existan no basta: el 22/07 el backend TENÍA detectores que no llegaba a
  // ejecutar. La cabecera debe evaluarse ANTES de la puerta por longitud — si se colara dentro del
  // `if (t.length < VIG_UMBRAL_DUDOSO)`, el mirror volvería a ser ciego a la página de error RICA,
  // que es exactamente el fallo que arregla T-165, y los literales seguirían cuadrando.
  it('el mirror EVALÚA la cabecera, y lo hace antes de la puerta por longitud', () => {
    const iCabecera = BACKEND.indexOf('for (const p of VIG_PATRONES_CABECERA)')
    const iLongitud = BACKEND.indexOf('if (t.length < VIG_UMBRAL_DUDOSO)')
    expect(iCabecera).toBeGreaterThan(0)
    expect(iLongitud).toBeGreaterThan(0)
    expect(iCabecera).toBeLessThan(iLongitud)
  })

  // COMPORTAMIENTO sobre literales reales de `convocatoria_seguimiento_checks` (27/07/2026).
  // Aplicar los patrones del espejo a mano y comprobar que dictan el mismo nivel que el núcleo:
  // si alguien cambia una regex en un solo lado, aquí se ve con el caso que deja de cazar.
  describe('mismo veredicto sobre los textos reales que motivaron el detector', () => {
    const menus = ' Inicio Buscar Accesibilidad Mapa web Contacto Ciudadania Profesionales '.repeat(40)
    const casos: Array<[string, string, string]> = [
      ['tcae-extremadura', 'Extremadura Salud - Error No se encontr la p gina [oposiciones] solicitada', 'pagina_no_encontrada'],
      ['seris-rioja', 'Error 404 - Rioja Salud Buscar Buscar Acceso privado Portada Ciudadanos', 'pagina_no_encontrada'],
      ['subalterno-parlamento-andalucia', 'Parlamento de Andaluc a P gina de error Facebook', 'pagina_error'],
      ['tcae-galicia', 'Sergas - Servizo de autenticaci n ou identificaci n de usuarios ACCEDE', 'muro_login'],
      ['apsp-carm', 'FICHA DEL CUERPO/OPCI N TITULACI N REQUERIDA: Sin exigencia de titulaci n', 'ficha_de_catalogo'],
    ]

    const cabeceraDelEspejo = (texto: string) => {
      const aplastado = texto
        .slice(0, literalNumero('VIG_UMBRAL_CABECERA'))
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/�/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      return literalArray('VIG_PATRONES_CABECERA').find((p) => p.re.test(aplastado))
    }

    it.each(casos)('%s → %s en los dos lados', (_slug, cabecera, nivelEsperado) => {
      const texto = cabecera + menus
      expect(clasificarVigilancia({ httpStatus: 200, texto }).nivel).toBe(nivelEsperado)
      expect(cabeceraDelEspejo(texto)?.nivel).toBe(nivelEsperado)
    })

    it('un tablón real no lo marca NINGUNO de los dos', () => {
      const texto = 'Convocatorias de Procesos Selectivos Buscar por Cuerpo y Oferta' + menus
      expect(clasificarVigilancia({ httpStatus: 200, texto }).vigilable).toBe(true)
      expect(cabeceraDelEspejo(texto)).toBeUndefined()
    })
  })
})
