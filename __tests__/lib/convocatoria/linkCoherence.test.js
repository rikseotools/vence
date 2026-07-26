const { extraerIdBoe, extraerAño, checkConvocatoriaLinks } = require('@/lib/convocatoria/linkCoherence.cjs')

describe('extraerIdBoe', () => {
  it('extrae el ID de un texto con basura alrededor', () => {
    expect(extraerIdBoe('BOE-A-2026-9946 (RD 387/2026, OEP 2026). Anexo I...')).toBe('BOE-A-2026-9946')
  })
  it('extrae el ID de una URL', () => {
    expect(extraerIdBoe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262')).toBe('BOE-A-2025-26262')
  })
  it('null si no hay ID', () => {
    expect(extraerIdBoe('sin referencia')).toBeNull()
    expect(extraerIdBoe(null)).toBeNull()
  })
})

describe('extraerAño', () => {
  it('extrae el año de una URL de seguimiento', () => {
    expect(extraerAño('.../convocatoria-2025')).toBe(2025)
  })
  it('null si no hay año', () => {
    expect(extraerAño('sin-anio')).toBeNull()
  })
})

describe('checkConvocatoriaLinks — GUARDARRAÍL enlace ≠ referencia', () => {
  it('CAZA el incidente real: muestra OEP 2026 pero enlaza a la convocatoria 2025', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2026-9946 (RD 387/2026, OEP 2026). Anexo I nuevo ingreso: 1450...',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',
      seguimientoUrl: '.../cuerpo-general-auxiliar...-convocatoria-2025',
      año: 2026,
    })
    const tipos = issues.map((i) => i.tipo)
    expect(tipos).toContain('ref_url_mismatch')
    expect(tipos).toContain('seguimiento_year_stale')
    expect(issues.find((i) => i.tipo === 'ref_url_mismatch').severidad).toBe('error')
  })
  it('OK cuando el enlace coincide con la referencia', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2024-14098',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-14098',
      seguimientoUrl: null,
      año: 2024,
    })
    expect(issues).toEqual([])
  })
  it('no marca mismatch si falta uno de los dos IDs (regional, sin BOE)', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOCM-20260218-2',
      programaUrl: 'https://www.comunidad.madrid/...',
      año: 2026,
    })
    expect(issues.filter((i) => i.tipo === 'ref_url_mismatch')).toEqual([])
  })
  it('seguimiento del MISMO año o posterior no es stale', () => {
    const issues = checkConvocatoriaLinks({
      boeReference: 'BOE-A-2026-1', programaUrl: 'id=BOE-A-2026-1',
      seguimientoUrl: '.../convocatoria-2026', año: 2026,
    })
    expect(issues.filter((i) => i.tipo === 'seguimiento_year_stale')).toEqual([])
  })
  it('entrada nula no revienta', () => {
    expect(checkConvocatoriaLinks(null)).toEqual([])
    expect(checkConvocatoriaLinks({})).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GUARDARRAÍL etiqueta ↔ enlace (incidente 25/07: "Ver convocatoria en BOJA" → boe.es)
// ─────────────────────────────────────────────────────────────────────────────
const { normalizarEtiquetaBoletin } = require('@/lib/convocatoria/linkCoherence.cjs')

describe('normalizarEtiquetaBoletin', () => {
  it('normaliza códigos simples', () => {
    expect(normalizarEtiquetaBoletin('boe')).toBe('BOE')
    expect(normalizarEtiquetaBoletin(' BOJA ')).toBe('BOJA')
    expect(normalizarEtiquetaBoletin('B.O.E.')).toBe('BOE')
  })
  it('devuelve null para etiquetas compuestas de la cola larga (no comparables)', () => {
    expect(normalizarEtiquetaBoletin('BOP Córdoba')).toBeNull()
    expect(normalizarEtiquetaBoletin('Sede electrónica')).toBeNull()
    expect(normalizarEtiquetaBoletin('')).toBeNull()
    expect(normalizarEtiquetaBoletin(null)).toBeNull()
  })
})

describe('checkConvocatoriaLinks — etiqueta del botón vs boletín del enlace', () => {
  it('CAZA el incidente real: etiqueta BOJA con enlace al BOE', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOJA',
      boeReference: 'BOE-A-2026-14723',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-14723',
    })
    const it2 = issues.find((i) => i.tipo === 'etiqueta_boletin_mismatch')
    expect(it2).toBeTruthy()
    expect(it2.severidad).toBe('error')
    expect(it2.detalle).toMatch(/BOJA/)
    expect(it2.detalle).toMatch(/BOE/)
  })

  it('no dispara cuando etiqueta y enlace coinciden (BOE)', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOE',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-14723',
    })
    expect(issues.filter((i) => i.tipo === 'etiqueta_boletin_mismatch')).toEqual([])
  })

  it('no dispara cuando etiqueta y enlace coinciden (BOJA real)', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOJA',
      programaUrl: 'https://www.juntadeandalucia.es/boja/2026/132/27',
    })
    expect(issues.filter((i) => i.tipo === 'etiqueta_boletin_mismatch')).toEqual([])
  })

  it('DEFENSIVO: dominio de la cola larga (no reconocido) NO inventa hallazgo', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOE',
      programaUrl: 'https://www.dipucordoba.es/bop/anuncio-1234',
    })
    expect(issues.filter((i) => i.tipo === 'etiqueta_boletin_mismatch')).toEqual([])
  })

  it('DEFENSIVO: etiqueta compuesta (BOP Córdoba) no se compara', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOP Córdoba',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-15802',
    })
    expect(issues.filter((i) => i.tipo === 'etiqueta_boletin_mismatch')).toEqual([])
  })

  it('sin enlace o sin etiqueta no hay hallazgo', () => {
    expect(checkConvocatoriaLinks({ diarioOficial: 'BOE' })).toEqual([])
    expect(checkConvocatoriaLinks({ programaUrl: 'https://www.boe.es/x?id=BOE-A-2026-1' })).toEqual([])
  })

  it('caza también el cruce DOGV↔BOE (regresión de otro boletín del registro)', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'DOGV',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1',
    })
    expect(issues.some((i) => i.tipo === 'etiqueta_boletin_mismatch')).toBe(true)
  })

  it('el registro por HOST reconoce boletines sin patrón de id (BORM, BOA, DOE…)', () => {
    // Antes de T-134 estos caían en `unknown` y NADA se comparaba: 56 de 123 landings a ciegas.
    const casos = [
      ['BORM', 'https://www.borm.es/services/anuncio/ano/2026/numero/901/pdf?id=841582'],
      ['BOA', 'https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=1427868650404'],
      ['DOE', 'https://doe.juntaex.es/pdfs/doe/2025/2440o/25050193.pdf'],
      ['BON', 'https://bon.navarra.es/es/anuncio/-/texto/2025/101/21'],
      ['BOPA', 'https://miprincipado.asturias.es/bopa/2024/12/24/2024-11213.pdf'],
    ]
    for (const [etiqueta, url] of casos) {
      expect(checkConvocatoriaLinks({ diarioOficial: etiqueta, programaUrl: url })).toEqual([])
      // y con la etiqueta cambiada, el mismo enlace SÍ debe cantar
      const cruzado = checkConvocatoriaLinks({ diarioOficial: 'BOE', programaUrl: url })
      expect(cruzado.some((i) => i.tipo === 'etiqueta_boletin_mismatch')).toBe(true)
    }
  })

  it('el eBOJA en PDF converge al mismo boletín que la variante web', () => {
    const url = 'https://www.juntadeandalucia.es/eboja/2026/136/BOJA26-136-00016-9536-01_00340768.pdf'
    expect(checkConvocatoriaLinks({ diarioOficial: 'BOJA', programaUrl: url })).toEqual([])
  })

  it('el portal del Gobierno Vasco NO es el BOPV salvo en la ruta del boletín', () => {
    // euskadi.eus sirve el portal entero; solo /web01-bopv/ es el boletín. Si el filtro de ruta
    // se cayera, el detector daría por bueno el portal y volvería a quedarse ciego.
    expect(checkConvocatoriaLinks({
      diarioOficial: 'BOPV',
      programaUrl: 'https://www.euskadi.eus/web01-bopv/es/bopv2/datos/2026/03/2601237a.pdf',
    })).toEqual([])
    const portal = checkConvocatoriaLinks({
      diarioOficial: 'BOPV',
      programaUrl: 'https://www.euskadi.eus/ope-administracion-general-euskadi/',
      estadoProceso: 'oep_aprobada',
    })
    expect(portal.some((i) => i.tipo === 'enlace_no_es_boletin')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GUARDARRAÍL "el botón promete un boletín y el enlace no es de ninguno" (T-134, 26/07).
// Punto ciego del anterior: ahí el enlace era de OTRO boletín; aquí no es de ninguno y los
// tres checks se callaban. Caso raíz: policia-nacional con plazo abierto → portal en inglés.
// ─────────────────────────────────────────────────────────────────────────────
const { señalesDeUrl } = require('@/lib/convocatoria/linkCoherence.cjs')

describe('señalesDeUrl — qué puede saberse de la URL sin red', () => {
  it('un PDF de bases en una sede institucional ES un documento', () => {
    const s = señalesDeUrl('https://empleopublico.carm.es/publicaciones/37400.pdf')
    expect(s.portadaOSeccion).toBe(false)
  })
  it('una ficha con id numérico ES un documento', () => {
    expect(señalesDeUrl('https://www.jccm.es/tramites/1014761').portadaOSeccion).toBe(false)
  })
  it('un año suelto NO cuenta como identificador de documento', () => {
    // `…/auxiliares-administracion-general-c2-2026` es una SECCIÓN del portal, no un documento:
    // si el año contase como id, el caso real de auxiliar-administrativo-madrid se escaparía.
    const s = señalesDeUrl('https://www.comunidad.madrid/servicios/empleo/auxiliares-administracion-general-c2-2026')
    expect(s.portadaOSeccion).toBe(true)
  })
  it('portada de portal e índice se detectan', () => {
    expect(señalesDeUrl('https://www.correos.es/es/es/personas-y-talento/empleo/index.html').portadaOSeccion).toBe(true)
    expect(señalesDeUrl('https://www.jgpa.es/procesos-selectivos').portadaOSeccion).toBe(true)
  })
  it('idioma extranjero sí, coficiales no (sirven el mismo documento oficial)', () => {
    expect(señalesDeUrl('https://www.policia.es/portalaspirantes/en/web/escala-basica-ejecutiva').idiomaExtranjero).toBe(true)
    expect(señalesDeUrl('https://dogc.gencat.cat/ca/document-del-dogc/?documentId=934181').idiomaExtranjero).toBe(false)
  })
  it('reconoce el temario aunque la ruta venga percent-encoded', () => {
    const s = señalesDeUrl('https://www.juntadeandalucia.es/sites/default/files/2024-06/IAAP_Temario_C1-1000_General%C3%9Anico.pdf')
    expect(s.pareceTemario).toBe(true)
  })
  it('entrada basura no revienta', () => {
    expect(() => señalesDeUrl(null)).not.toThrow()
    expect(() => señalesDeUrl('no-es-una-url')).not.toThrow()
    expect(() => señalesDeUrl('https://x.es/%E0%A4%A')).not.toThrow()
  })
})

describe('checkConvocatoriaLinks — el enlace no es de NINGÚN boletín', () => {
  const POLICIA = 'https://www.policia.es/portalaspirantes/en/web/escala-basica-ejecutiva'

  it('CAZA el caso raíz: plazo abierto, promete el BOE y lleva a un portal en inglés', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOE', programaUrl: POLICIA, estadoProceso: 'inscripcion_abierta',
    })
    const hit = issues.find((i) => i.tipo === 'enlace_no_es_boletin')
    expect(hit).toBeTruthy()
    expect(hit.severidad).toBe('error')
    expect(hit.detalle).toMatch(/portada\/sección/)
    expect(hit.detalle).toMatch(/otro idioma/)
  })

  it('sin convocatoria publicada baja a WARN (la página institucional puede ser lo mejor que hay)', () => {
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOE', programaUrl: POLICIA, estadoProceso: 'oep_aprobada',
    })
    expect(issues.find((i) => i.tipo === 'enlace_no_es_boletin').severidad).toBe('warn')
  })

  it('todos los estados con ficha viva son ERROR (contrato compartido con seguimientoUrlSalud)', () => {
    for (const estado of ['convocatoria_publicada', 'convocada', 'inscripcion_abierta',
      'inscripcion_cerrada', 'lista_admitidos', 'pendiente_examen']) {
      const issues = checkConvocatoriaLinks({ diarioOficial: 'BOE', programaUrl: POLICIA, estadoProceso: estado })
      expect(issues.find((i) => i.tipo === 'enlace_no_es_boletin').severidad).toBe('error')
    }
    for (const estado of ['oep_aprobada', 'sin_oep', 'examen_realizado', 'nombramientos', null]) {
      const issues = checkConvocatoriaLinks({ diarioOficial: 'BOE', programaUrl: POLICIA, estadoProceso: estado })
      expect(issues.find((i) => i.tipo === 'enlace_no_es_boletin').severidad).toBe('warn')
    }
  })

  it('NO marca el documento legítimo publicado en la sede de la entidad (cola larga)', () => {
    // Que la entidad cuelgue las bases en su web es normal; marcar esto sería la bandeja
    // ruidosa que el proyecto ya aprendió a no construir (T-047).
    for (const url of [
      'https://empleopublico.carm.es/publicaciones/37400.pdf',
      'https://www.zaragoza.es/oferta/ofertaDetalle.jsp?id=1681',
      'https://sede.madrid.es/UnidadWeb/Contenidos/Oposiciones/2025/Ficheros/561PolMpal_ConvBoam.pdf',
    ]) {
      const issues = checkConvocatoriaLinks({
        diarioOficial: 'BOE', programaUrl: url, estadoProceso: 'inscripcion_abierta',
      })
      expect(issues.filter((i) => i.tipo === 'enlace_no_es_boletin')).toEqual([])
    }
  })

  it('el TEMARIO bajo el rótulo "Ver convocatoria" queda en WARN, nunca en error', () => {
    // Es correcto como `programa_url` y engañoso como enlace de convocatoria: el arreglo es una
    // decisión de diseño (separar los dos contratos), no un typo de dato → no bloquea el gate.
    const issues = checkConvocatoriaLinks({
      diarioOficial: 'BOE', estadoProceso: 'inscripcion_abierta',
      programaUrl: 'https://web.guardiacivil.es/documentos/pdfs/2024/TEMARIO_INGRESO_GC_ACTUALIZADO_2024.pdf',
    })
    const hit = issues.find((i) => i.tipo === 'enlace_no_es_boletin')
    expect(hit.severidad).toBe('warn')
    expect(hit.detalle).toMatch(/TEMARIO/)
  })

  it('si el enlace SÍ es del boletín prometido no se emite nada (no se solapa con el check 3)', () => {
    expect(checkConvocatoriaLinks({
      diarioOficial: 'BOE', estadoProceso: 'inscripcion_abierta',
      programaUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1',
    })).toEqual([])
  })

  it('etiqueta compuesta de la cola larga sigue sin compararse', () => {
    expect(checkConvocatoriaLinks({
      diarioOficial: 'BOP Córdoba', programaUrl: POLICIA, estadoProceso: 'inscripcion_abierta',
    })).toEqual([])
  })
})
