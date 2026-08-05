// backend/src/tipificar-documentos/tipo-documento-mirror.ts
//
// MIRROR INLINE de `lib/convocatoria/tipoDocumento.cjs` (T-147). El backend es self-contained
// (rootDir = backend/, la imagen de Docker solo `COPY src ./src` — nunca importa de `../lib`),
// como content-health-sweep, law-completeness y annulled-vigencia-sweep.
//
// ⚠️ MANTENER EN SYNC con lib/convocatoria/tipoDocumento.cjs. El test de paridad
// `tipo-documento-mirror.parity.spec.ts` corre los MISMOS casos reales contra las dos
// implementaciones — si divergen, el CI lo para.
//
// Por qué existe un cron que necesita esto: `detect-notas-convocatoria` clona TODO documento
// como `tipo='nota'` a propósito (las notas son el historial de monitoreo, append por
// content_hash). Sin nada que las reclasifique después, el hub se queda con el 96% del corpus
// sin tipo para siempre y el backlog de T-147 se rellena solo cada día. Este mirror es el
// núcleo que usa `TipificarDocumentosService` para esa reclasificación recurrente — el mismo
// criterio que ya validó `scripts/convocatoria/sim-tipo-documento.cjs`, ahora en un cron.

export type Confianza = 'alta' | 'media' | null;

export interface ClasificacionTipo {
  tipo: string;
  confianza: Confianza;
  motivo: string;
}

export interface DocumentoParaClasificar {
  titulo?: string | null;
  url?: string | null;
  texto?: string | null;
}

const VENTANA = 900;

// Ruido que los portales y los boletines meten ANTES del documento y que desplaza la cabecera
// fuera de la ventana. Espejo de RUIDO en lib/convocatoria/tipoDocumento.cjs.
const RUIDO: RegExp[] = [
  /versi[óo]n imprimible del documento[^.]{0,200}\./gi,
  /la integridad de este documento puede comprobarse[^.]{0,200}\./gi,
  /c[óo]digo seguro de verificaci[óo]n \(?csv\)?:?\s*[\w\s-]{8,60}/gi,
  /csv\s*:?\s*[A-Za-z0-9_+/=-]{8,60}\.?/gi,
  /url de validaci[óo]n\s*:?\s*\S+/gi,
  /firmante\s*nif\/?cif\s*fecha y hora/gi,
  /p[áa]gina \d+ de \d+/gi,
  /this document is a copy|documento es una copia electr[óo]nica[^.]{0,120}\./gi,
  /fima autom[áa]tica/gi,
  /boletín oficial de la provincia\s*/gi,
  /powered by tcpdf[^\n]*/gi,
];

export const plano = (s: string | null | undefined): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Cabecera del documento: texto sin el ruido de portal/boletín, recortado a la ventana. */
export function cabecera(
  texto: string | null | undefined,
  ventana: number = VENTANA,
): string {
  let t = String(texto || '');
  for (const rx of RUIDO) t = t.replace(rx, ' ');
  return plano(t).trim().slice(0, ventana);
}

interface Regla {
  tipo: string;
  ventana?: number;
  re: RegExp;
  excluir?: RegExp;
  extra?: (cab: string, doc: DocumentoParaClasificar) => boolean;
}

// ── Reglas, ORDENADAS POR ESPECIFICIDAD (la primera que casa gana) ──
// Espejo EXACTO de REGLAS en lib/convocatoria/tipoDocumento.cjs. Ver ahí el porqué de cada orden
// y cada exclusión — están medidos sobre el corpus real y no se repiten aquí para no divergir
// en la prosa mientras el código sí se mantiene igual.
const REGLAS: Regla[] = [
  {
    tipo: 'correccion_errores',
    ventana: 350,
    re: /correccion de errores|correccion de error material|rectificacion de errores/,
    excluir: /por (la|el) que se convoca/,
  },
  {
    tipo: 'lista_admitidos',
    re: /(lista|listado|relacion)[^.]{0,60}(provisional|definitiva)[^.]{0,60}(admitid|excluid|aspirantes)|(lista|listado|relacion)[^.]{0,40}(de )?(personas )?(aspirantes )?(admitid|excluid)/,
  },
  {
    tipo: 'anuncio_fecha',
    re: /cronograma|(fecha|fechas|celebracion|llamamiento)[^.]{0,60}(ejercicio|prueba|examen|proceso selectivo)|distribucion de (los )?(opositores|aspirantes)[^.]{0,30}aulas|previsiones de fecha/,
  },
  {
    tipo: 'resolucion_tribunal',
    re: /(nombramiento|designacion|composicion|constitucion|modificacion)[^.]{0,60}(tribunal|comision permanente de seleccion|organo de seleccion)|tribunal calificador[^.]{0,40}(queda|se constituye|acuerda)/,
  },
  {
    tipo: 'bases',
    re: /bases (generales|especificas|reguladoras)|(aprobar|aprueba|aprobacion)[^.]{0,60}bases|bases (que han de regir|por las que se rige|de la convocatoria)|convocatoria y bases[^.]{0,60}(cobertura|provision|plazas)/,
    excluir:
      /se han publicado las bases|referente a la convocatoria para proveer/,
  },
  {
    tipo: 'convocatoria',
    re: /por (la|el) que se convocan?|se convocan?[^.]{0,80}(plazas|pruebas selectivas|proceso selectivo)|referente a la convocatoria para proveer/,
    excluir: /instrucciones para|manual de|guia (de|para)|carta de servicios/,
  },
  {
    tipo: 'temario',
    re: /programas? de materias|temarios? (para|de) (la|el|las|los) (provision|ingreso|acceso|escalas)/,
    excluir:
      /^(nota informativa|acuerdo del? [óo]rgano|acuerdo de la comision)/,
  },
  {
    tipo: 'temario',
    re: /^\s*tema \d+\b/,
    extra: (_cab, doc) =>
      (String(doc.texto || '').match(/\btema \d+/gi) || []).length >= 8,
  },
  {
    tipo: 'temario',
    re: /anexo [iv]+\.? ?(-|:)? ?(temario|programa)/,
    extra: (_cab, doc) =>
      (String(doc.texto || '').match(/\btema \d+/gi) || []).length >= 5,
  },
  {
    tipo: 'oep_decreto',
    ventana: 300,
    re: /((real )?decreto|acuerdo|orden)[^.]{0,80}por (el|la) que se aprueba[^.]{0,40}(la )?oferta de empleo publico|se aprueba la oferta de empleo publico/,
    excluir:
      /(en cumplimiento de|de conformidad con|en desarrollo de|al amparo de|previsto en|dispuesto en|conforme a)[^.]{0,120}oferta de empleo publico/,
  },
];

/**
 * ¿Qué tipo de documento es? Puro: no toca red ni BD. Espejo EXACTO de
 * `clasificarTipoDocumento` en lib/convocatoria/tipoDocumento.cjs.
 */
export function clasificarTipoDocumento(
  doc: DocumentoParaClasificar = {},
): ClasificacionTipo {
  const cab = cabecera(doc.texto);
  const titulo = plano(doc.titulo);
  const url = plano(doc.url);

  if (!cab && !titulo)
    return { tipo: 'nota', confianza: null, motivo: 'sin texto ni título' };

  for (const r of REGLAS) {
    const ambito = r.ventana ? cab.slice(0, r.ventana) : cab;
    if (!r.re.test(ambito)) continue;
    if (r.excluir && r.excluir.test(ambito)) continue;
    if (r.extra && !r.extra(ambito, doc)) continue;
    const refuerzo = r.re.test(titulo) || r.re.test(url);
    return {
      tipo: r.tipo,
      confianza: refuerzo ? 'alta' : 'media',
      motivo: `cabecera casa ${r.tipo}${refuerzo ? ' + título/URL lo confirma' : ''}`,
    };
  }
  return {
    tipo: 'nota',
    confianza: null,
    motivo: 'ninguna señal en la cabecera',
  };
}
