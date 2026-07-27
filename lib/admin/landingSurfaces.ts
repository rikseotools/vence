// lib/admin/landingSurfaces.ts — INVENTARIO de las superficies que pinta la landing de una
// oposición, cada una con los detectores de salud que la vigilan.
//
// Responde a una sola pregunta, y la responde ANTES de que un defecto llegue al opositor:
// **¿qué parte de la landing NO está vigilada por nadie?**
//
// ## Por qué existe (T-134, 26/07/2026)
//
// Los detectores de contenido nacieron de uno en uno, cada uno tras su incidente: la tarjeta de
// plazas cuando una mintió, las FAQs cuando una landing salió a medias, el enlace del BOE cuando
// apuntó al año anterior. Nadie tenía la vista de conjunto, así que **un hueco solo se descubría
// cuando un usuario se caía por él**. El caso que lo motivó: el botón más oficial de la página
// ("Ver convocatoria en BOE") llevaba al portal de aspirantes EN INGLÉS en una oposición con el
// plazo abierto, y los tres detectores de enlaces daban verde porque los tres necesitaban
// reconocer un boletín en la URL para poder hablar.
//
// Este registro invierte el orden: primero se enumera lo que el opositor VE, y después se exige
// que cada cosa tenga detector — o que el hueco esté declarado, con su motivo y su tarea.
//
// ## Cómo se hace cumplir (no depende de que nadie lea esto)
//
// `__tests__/guardrails/landingSurfaces.guardrail.test.ts` (CI, sin BD ni red):
//   · cada superficie nombra marcadores que EXISTEN en `app/[oposicion]/page.tsx` (si la página
//     deja de pintar algo, o lo renombra, el inventario deja de ser ficción y el test avisa);
//   · cada `kind` citado existe en `runbookRegistry` (nada de vigilancia imaginaria);
//   · una superficie sin detectores DEBE declarar `hueco` con motivo — el silencio no vale;
//   · a la inversa: todo kind de landing/convocatoria/seguimiento está asignado a una superficie,
//     así que un detector nuevo obliga a decir QUÉ vigila.
//
// Mismo patrón que `runbookRegistry` (kind→guía), `toolRegistry` (columna→herramienta) y
// `content-sweep-parity` (CLI↔@Cron): registro + test que se pone rojo. En este repo, un registro
// sin test es documentación que caduca.

export interface SuperficieLanding {
  /** Qué ve el opositor, en cristiano. */
  titulo: string
  /** Identificadores que DEBEN aparecer en `app/[oposicion]/page.tsx` (variable o campo). */
  marcadores: string[]
  /** Kinds de `content_health_findings` que la vigilan. Vacío ⇒ obligatorio declarar `hueco`. */
  kinds: string[]
  /** Qué NO cubre ningún detector, y por qué. Se exige cuando `kinds` está vacío; opcional si no. */
  hueco?: string
  /** Tarea del backlog donde vive ese hueco (formato T-NNN), si la hay. */
  tarea?: string
}

export const LANDING_SURFACES: Record<string, SuperficieLanding> = {
  pagina: {
    titulo: 'La landing responde y renderiza (no 404/5xx, no error de render en servidor)',
    marcadores: ['export default async function', 'safeServerFetch'],
    kinds: ['http_down', 'http_5xx', 'server_render_error', 'render_error', 'landing_enlace_roto'],
  },
  hero_badge: {
    titulo: 'Badge del hero: "CONVOCATORIA PUBLICADA {fecha}" y la línea de examen',
    marcadores: ['boeFechaCorta', 'textoExamen', 'examDateApproximate', 'heroAnuncio'],
    // `convocatoria_estado_incoherente` entra aquí desde el 27/07: ahora que el badge DERIVA del
    // estado del proceso, un estado contradictorio contamina directamente lo que anuncia el hero.
    kinds: ['dual_write', 'texto_examen_pasado', 'convocatoria_estado_incoherente'],
    hueco:
      'CERRADO POR CONSTRUCCIÓN el 27/07: el badge y el subtítulo ya no pueden contradecir al ' +
      'estado del proceso, porque los deriva de él `lib/convocatoria/anuncioHero.ts` (mismo criterio ' +
      'que el enlace oficial, F4/T-108). Antes bastaba con tener `boe_publication_date` o ' +
      '`boe_reference` —normalmente del decreto de la OEP— para anunciar "CONVOCATORIA PUBLICADA" ' +
      'aunque no hubiera convocatoria; en `oep_aprobada` ahora dice "PLAZAS APROBADAS". No hace ' +
      'falta detector: no hay estado desde el que el texto pueda mentir. Queda vigilado por los ' +
      'tests del núcleo (__tests__/lib/convocatoria/anuncioHero.test.ts). Nota: `texto_examen_pasado` ' +
      'sigue mirando FAQs y descripción, no el badge — la línea de examen es otra superficie.',
    tarea: 'T-134',
  },
  hero_tarjetas: {
    titulo: 'Tarjetas del hero (plazas, temas, y las que la oposición configure)',
    marcadores: ['estadisticasSafe', 'plazasTotal', 'temasCount'],
    kinds: [
      'plaza_card', 'temas_card', 'landing_incompleta',
      'landing_cifra_sin_respaldo', 'landing_superficies_contradictorias',
    ],
  },
  caja_convocatoria: {
    titulo: 'Caja de la convocatoria: referencia oficial mostrada + fecha',
    marcadores: ['boeRef', 'boeFechaLarga', 'oepDecreto'],
    kinds: ['dual_write', 'convocatoria_link_mismatch'],
  },
  timeline: {
    titulo: 'Timeline de hitos del proceso selectivo',
    marcadores: ['hitos', 'etiquetaFechaHito'],
    kinds: [
      'no_hitos',
      'convocatoria_timeline_incoherente',
      'convocatoria_timeline_caducado',
      'hito_vencido_abierto',
      'convocatoria_docs_incompletos',
    ],
  },
  enlace_oficial: {
    titulo: 'Botón "Ver convocatoria/OEP en {diario_oficial}" (el enlace más oficial de la página)',
    marcadores: ['enlaceOficial', 'diarioOficial', 'programaUrl'],
    kinds: ['convocatoria_link_mismatch', 'convocatoria_etiqueta_boletin', 'convocatoria_enlace_no_boletin'],
    hueco:
      'cuando `diario_oficial` es una etiqueta COMPUESTA ("BOP Córdoba", "Sede electrónica") no se ' +
      'compara nada: el registro de boletines solo entiende códigos simples. Son ~30 landings, casi ' +
      'todas BOP provinciales legítimos, y el coste de equivocarse (marcar como falso un enlace bueno) ' +
      'es mayor que el del hueco',
    tarea: 'T-134',
  },
  enlace_seguimiento: {
    titulo: 'Botón "Seguimiento del proceso"',
    marcadores: ['seguimientoUrl'],
    kinds: ['seguimiento_url_stale', 'seguimiento_fuente_ciega'],
  },
  temario: {
    titulo: 'Temario servido (temas, nombres, número de preguntas)',
    marcadores: ['temasCount', 'topicNamesFromBD'],
    kinds: [
      'empty_topic',
      'low_coverage',
      'article_no_coverage',
      'temario_revision_pendiente',
      'scope_sin_verificar',
    ],
  },
  faqs: {
    titulo: 'FAQs de la landing (y su JSON-LD FAQPage)',
    marcadores: ['faqs', 'landingFaqs'],
    kinds: ['landing_incompleta', 'texto_examen_pasado', 'landing_cifra_sin_respaldo'],
  },
  descripcion: {
    titulo: 'Requisitos de acceso (titulación exigida) y descripción de la oposición',
    marcadores: ['tituloRequerido'],
    kinds: ['landing_incompleta', 'texto_examen_pasado'],
    hueco:
      'MEDIDO al montar este inventario (26/07): `landing_description` NO se pinta en la landing — ' +
      'solo la expone la query de las CARDS del catálogo. O sea que `landing_incompleta` exige un ' +
      'campo que en esta superficie es inerte, igual que `seo_description`. Antes de rellenar más ' +
      'descripciones hay que decidir si se cablean o si el detector deja de pedirlas aquí',
    tarea: 'T-128',
  },
  seo: {
    titulo: 'Metadatos SEO (title y description de la página)',
    marcadores: ['generateMetadata', 'seoTitle'],
    kinds: ['landing_incompleta'],
    hueco:
      '`seo_description` se exige en BD pero la landing NO la sirve: el `<meta name="description">` ' +
      'se autogenera. O se cablea el campo o el detector está pidiendo algo inerte',
    tarea: 'T-128',
  },
  historico: {
    titulo: 'Histórico de convocatorias (bloque de años anteriores)',
    marcadores: ['resumenHist', 'historico'],
    kinds: ['convocatoria_oep_sin_enlace'],
  },
}

/** Kinds que, por nombre, vigilan la landing y por tanto DEBEN estar asignados a una superficie. */
export const PREFIJOS_KIND_LANDING = ['convocatoria_', 'landing_', 'seguimiento_', 'texto_examen_']

/** Todos los kinds citados por el inventario (sin duplicados). */
export function kindsCubiertos(): string[] {
  return [...new Set(Object.values(LANDING_SURFACES).flatMap((s) => s.kinds))].sort()
}

/** Superficies que hoy tienen un hueco declarado (para el panel y para el triaje). */
export function superficiesConHueco(): Array<{ id: string; hueco: string; tarea?: string }> {
  return Object.entries(LANDING_SURFACES)
    .filter(([, s]) => s.hueco)
    .map(([id, s]) => ({ id, hueco: s.hueco as string, tarea: s.tarea }))
}
