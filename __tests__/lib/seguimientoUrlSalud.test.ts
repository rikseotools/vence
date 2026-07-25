/**
 * @jest-environment node
 */
// Guardarraíl del detector de `seguimiento_url` desfasadas (falso negativo silencioso:
// el monitor vigila un ciclo ya cerrado y nunca avisa de la convocatoria nueva).
//
// Los casos son REALES, tomados de la BD el 20/07/2026. Lo que fija este test no es tanto
// "detecta stale" como "NO convierte las señales ruidosas en errores": esa es la diferencia
// entre un detector útil y otra bandeja que se aprende a ignorar (el error de `hash_change`).
// Importa del .cjs (fuente de verdad) igual que lo hace health-sweep, para testear
// exactamente lo que corre en el sweep, no una copia.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  diagnosticarSeguimientoUrl,
  procesoConFichaViva,
} = require('@/lib/convocatoria/seguimientoUrlSalud.cjs')

describe('seguimiento_url — detección graduada de ciclo desfasado', () => {
  it('DOC de boletín inmutable de año viejo → error (señal limpia)', () => {
    // Caso real: auxiliar-administrativo-ayuntamiento-madrid, convocatoria vigente 2025.
    const d = diagnosticarSeguimientoUrl(
      'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-21734',
      2025,
    )
    expect(d.nivel).toBe('stale_boletin')
    expect(d.severidad).toBe('error')
  })

  it('un boletín del AÑO vigente NO es stale', () => {
    expect(
      diagnosticarSeguimientoUrl('https://www.boe.es/…/BOE-A-2025-999', 2025).severidad,
    ).toBe('ok')
  })

  it('OPE plurianual con años viejos en el path NO es error (evita el falso positivo)', () => {
    // Caso real: auxiliar-enfermeria-osakidetza, url "ope-2023-2024-2025", vigente 2026.
    // "2023-2024-2025" es el NOMBRE de la OPE, no un desfase. No puede ser error.
    const d = diagnosticarSeguimientoUrl(
      'https://www.osakidetza.euskadi.eus/ope-2023-2024-2025/webosk00-procon/es/',
      2026,
    )
    expect(d.severidad).not.toBe('error')
  })

  it('año viejo en path (no boletín) → warn, no error', () => {
    // Caso real: celador-sescam-clm, url ".../oferta-de-empleo-publico-2023-2024", vigente 2025.
    const d = diagnosticarSeguimientoUrl(
      'https://sanidad.castillalamancha.es/…/oferta-de-empleo-publico-2023-2024',
      2025,
    )
    expect(d.nivel).toBe('posible_ciclo_viejo')
    expect(d.severidad).toBe('warn')
  })

  it('URL genérica de índice SIN proceso vivo → OK, no pinga el badge (índice legítimo, T-112 25/07)', () => {
    // Caso real: auxiliar-administrativo-diputacion-ourense, url ".../gl/emprego", vigente 2026.
    // ~14 de 20 seguimiento_url_stale eran índices legítimos → sobre-marcado; ya no pingan el badge.
    const d = diagnosticarSeguimientoUrl('https://www.depourense.gal/gl/emprego', 2026)
    expect(d.nivel).toBe('url_generica')
    expect(d.severidad).toBe('ok')
  })

  it('URL genérica CON proceso vivo (procesoEnJuego) → ERROR (ceguera accionable, no se descarta)', () => {
    // Caso raíz: auxiliar-administrativo-ayuntamiento-murcia, seguimiento_url = índice genérico
    // (emplea.murcia.es/convocatorias) con proceso VIVO → nos dejó ciegos a la 2ª convocatoria.
    // Con el proceso vivo, la señal deja de ser "ruido descartable" y pasa a error persistente.
    const d = diagnosticarSeguimientoUrl(
      'https://emplea.murcia.es/convocatorias',
      2026,
      { procesoEnJuego: true },
    )
    expect(d.nivel).toBe('url_generica')
    expect(d.severidad).toBe('error')
  })

  it('la escalada solo aplica a la genérica: proceso vivo NO convierte una URL sana en error', () => {
    // procesoEnJuego solo sube la genérica; una URL concreta y correcta sigue ok aunque el proceso viva.
    const d = diagnosticarSeguimientoUrl(
      'https://www.unileon.es/convocatorias-ptgas-pdi/convocatoria-de-proceso-selectivo-x',
      2026,
      { procesoEnJuego: true },
    )
    expect(d.severidad).toBe('ok')
  })

  it('URL a convocatoria concreta del año vigente → ok', () => {
    // Caso real: administrativo-universidad-leon, repuntada a su convocatoria propia, vigente 2026.
    const d = diagnosticarSeguimientoUrl(
      'https://www.unileon.es/convocatorias-ptgas-pdi/convocatoria-de-proceso-selectivo-para-ingreso-por-el-sistema-general-de',
      2026,
    )
    expect(d.severidad).toBe('ok')
  })

  it('procesoConFichaViva: solo estados con convocatoria PUBLICADA cuentan como proceso vivo (T-112 25/07)', () => {
    // Con ficha publicada viva → una URL genérica es ceguera accionable (procesoEnJuego=true).
    for (const e of [
      'convocatoria_publicada',
      'convocada',
      'inscripcion_abierta',
      'inscripcion_cerrada',
      'lista_admitidos',
      'pendiente_examen',
    ]) {
      expect(procesoConFichaViva(e)).toBe(true)
    }
    // Sin ficha concreta que apuntar → el índice del portal es vigilancia legítima (no pinga).
    // `oep_aprobada` (esperando bases: salamanca/ávila/huelva), `sin_oep`, procesos ya pasados.
    for (const e of [
      'oep_aprobada',
      'sin_oep',
      'examen_realizado',
      'nombramientos',
      null,
      undefined,
    ]) {
      expect(procesoConFichaViva(e)).toBe(false)
    }
  })

  it('genérica en oep_aprobada (bases pendientes) NO pinga: procesoEnJuego se deriva del estado', () => {
    // Caso real: auxiliar-administrativo-diputacion-avila, seguimiento_url = índice de RRHH,
    // estado_proceso='oep_aprobada' (OEP viva pero SIN convocatoria) → la genérica es legítima.
    const enJuego = procesoConFichaViva('oep_aprobada') // false
    const d = diagnosticarSeguimientoUrl(
      'https://www.diputacionavila.es/recursos-humanos/oferta-de-empleo-publico',
      2024,
      { procesoEnJuego: enJuego },
    )
    expect(d.nivel).toBe('url_generica')
    expect(d.severidad).toBe('ok')
    // y CON ficha publicada (inscripcion_cerrada) la misma URL sí sería error accionable
    expect(
      diagnosticarSeguimientoUrl(
        'https://www.diputacionavila.es/recursos-humanos/oferta-de-empleo-publico',
        2024,
        { procesoEnJuego: procesoConFichaViva('inscripcion_cerrada') },
      ).severidad,
    ).toBe('error')
  })

  it('sin url o sin año vigente → ok (no se puede diagnosticar, no se inventa)', () => {
    expect(diagnosticarSeguimientoUrl(null, 2026).severidad).toBe('ok')
    expect(diagnosticarSeguimientoUrl('https://x.es/BOE-A-2020-1', null).severidad).toBe('ok')
  })

  it('sin procesoEnJuego, solo la señal LIMPIA escala a error (año-viejo warn, genérica ok)', () => {
    // La invariante que impide repetir lo de hash_change: sin el flag de proceso vivo, como mucho
    // un error por caso limpio (boletín viejo). La genérica sin proceso vivo es 'ok' (T-112: índice
    // legítimo, no pinga); solo sube a error CON procesoEnJuego (test aparte).
    const casos: Array<[string, number]> = [
      ['https://www.boe.es/…/BOE-A-2024-1', 2025], // limpio → error
      ['https://x.es/ope-2022/', 2025], // año viejo path → warn
      ['https://x.es/empleo-publico', 2025], // genérica → ok (no pinga)
    ]
    const diags = casos.map(([u, a]) => diagnosticarSeguimientoUrl(u, a))
    expect(diags.filter((d) => d.severidad === 'error')).toHaveLength(1)
    expect(diags.filter((d) => d.severidad === 'ok')).toHaveLength(1) // la genérica
  })
})
