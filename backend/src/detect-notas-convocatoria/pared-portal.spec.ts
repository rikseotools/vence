/**
 * La defensa que guarda el corpus de clonar menús y captchas como si fueran documentos.
 *
 * Estaba exportada «para testearla» desde el 16/07 y NADIE la testeaba (vivía en `scripts/`, que el
 * jest del backend nunca mira). El 27/07 dejó pasar 11 KB de chrome de `sede.madrid.es`, que se clonó
 * como `oep_decreto` y hubo que borrar a mano.
 *
 * Los textos de aquí son fragmentos REPRESENTATIVOS de muestras medidas ese día, no inventados.
 * Las dos direcciones se fijan: dejar pasar una pared contamina el corpus con algo que **parece
 * prueba**; marcar un documento bueno lo tira, que es peor.
 */
import { esParedDelPortal } from './pared-portal'

// Fragmento del chrome de sede.madrid.es (texto real: 11.306 caracteres, 3 marcadores de navegación).
// OJO a lo que dice: menciona «Acuerdo», «Oferta de Empleo Público», «plazas»… porque LISTA trámites.
// Por eso la regla vieja —que eximía a todo lo que hablara como una norma— no podía cazarla.
const PARED_SEDE = `
BOAM nº 10017/4464 (01/12/2025) - Acuerdo de 27 de noviembre de 2025 de la Junta de Gobierno de la
Ciudad de Madrid por el que se aprueba la Oferta de Empleo Público del Ayuntamiento de Madrid y sus
organismos autónomos para el año 2025, excluidas las plazas correspondientes al cuerpo de Policía
Municipal. Acceso al módulo: Ciudadanía Acceso al módulo: Empresas Conozca la Sede Publicaciones
Oficiales Lo más visto Auxiliar Administrativo/a del Ay... Bombero/a Especialista del Cuerp...
Home Sede electrónica Publicaciones Oficiales Boletín Oficial del Ayuntamiento de Madrid
`.repeat(12)

// Documento REAL: el anuncio del BOE que prueba las 561 plazas de policia-municipal-madrid.
const BOE_REAL = `
II. AUTORIDADES Y PERSONAL B. Oposiciones y concursos ADMINISTRACIÓN LOCAL 25740 Resolución de 5 de
diciembre de 2025, del Ayuntamiento de Madrid, referente a la convocatoria para proveer varias plazas.
En el «Boletín Oficial del Ayuntamiento de Madrid» número 9829 se han publicado las bases que han de
regir la convocatoria para proveer: Ciento trece plazas de Policía del Cuerpo de Policía Municipal…
Turno libre: Policía del Cuerpo de Policía Municipal 561 plazas.
`

// Documento REAL: el acuerdo del BOCM que aprueba la OEP 2024 de Alcalá de Henares.
const BOCM_REAL = `
BOLETÍN OFICIAL DE LA COMUNIDAD DE MADRID III. ADMINISTRACIÓN LOCAL AYUNTAMIENTO DE ALCALÁ DE HENARES
OFERTAS DE EMPLEO La Junta de Gobierno Local, en sesión ordinaria de fecha 23 de enero de 2026, adoptó
el siguiente acuerdo: Aprobar las bases específicas y la convocatoria para dar cobertura a once plazas
pertenecientes a la Administración General, subescala Auxiliar, grupo C, subgrupo C2.
`

describe('esParedDelPortal', () => {
  describe('paredes que DEBE cazar', () => {
    it('EL CASO RAÍZ: el chrome de una sede grande, aunque hable de acuerdos y plazas', () => {
      const motivo = esParedDelPortal(PARED_SEDE)
      expect(motivo).toMatch(/sede electrónica/)
      expect(motivo).toMatch(/marcadores de navegación/)
    })

    it('no se le escapa por tamaño: la pared medida son 11 KB, no 400 bytes', () => {
      expect(PARED_SEDE.length).toBeGreaterThan(4000)
      expect(esParedDelPortal(PARED_SEDE)).not.toBeNull()
    })

    it('la navegación cuenta aunque esté al final (no solo en los primeros 4.000 caracteres)', () => {
      const conNavAlFinal = 'x'.repeat(8000) + ' Acceso al módulo: Ciudadanía … Mapa web'
      expect(esParedDelPortal(conNavAlFinal)).toMatch(/sede electrónica/)
    })

    it('sigue cazando captcha, acceso denegado y rate limit (el BORM devolvía 200 con captcha)', () => {
      expect(esParedDelPortal('Radware Captcha Page: you are a bot')).toBe('captcha / anti-bot')
      expect(esParedDelPortal('Acceso denegado')).toBe('acceso denegado')
      expect(esParedDelPortal('Too many requests')).toBe('rate limit')
    })

    it('sigue cazando el chrome pequeño sin vocabulario normativo (el DOCM)', () => {
      expect(esParedDelPortal('Inicio Mapa web Búsqueda avanzada Política de cookies Contactar'))
        .toBe('chrome del portal (sin norma)')
    })
  })

  describe('documentos REALES que NO debe tocar (falso positivo = tirar la prueba)', () => {
    it('el anuncio del BOE que prueba las 561 plazas', () => {
      expect(esParedDelPortal(BOE_REAL)).toBeNull()
    })

    it('el acuerdo del BOCM que aprueba la OEP de Alcalá', () => {
      expect(esParedDelPortal(BOCM_REAL)).toBeNull()
    })

    it('un boletín largo con estructura de norma (el BOA de Aragón: 0 marcadores de navegación)', () => {
      const boa = `RESOLUCIÓN de 19 de diciembre de 2025, del Director General de la Función Pública,
        por la que se convocan pruebas selectivas. 1. Normas generales. 1.1. El objeto de la presente
        convocatoria es la cobertura de las plazas indicadas en el anexo I. Artículo 35.1.h).`.repeat(20)
      expect(esParedDelPortal(boa)).toBeNull()
    })

    it('UN solo marcador suelto no basta: un pie de página legítimo no es una pared', () => {
      expect(esParedDelPortal(`${BOE_REAL} Mapa web`)).toBeNull()
    })
  })
})
