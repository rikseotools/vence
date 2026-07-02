/**
 * Adapter del Buscador del Punto de Acceso General (administracion.gob.es).
 *
 * Es un AGREGADOR NACIONAL de convocatorias de empleo público (Estado +
 * autonómico + LOCAL) con filtro nativo de grupo (C1/C2) y de "Plazo Abierto".
 * Cierra el punto ciego de `detect-boletines` (que solo lee BOCYL + BOE): la
 * inmensa mayoría de convocatorias autonómicas y TODAS las locales se publican
 * en boletines que no escaneamos, pero el PAG las reúne todas.
 *
 * API (reverse-engineering 25/06/2026):
 *   POST .../buscadorEmpleoAvanzado.htm  (form-urlencoded, HTML server-rendered)
 *   idGrupo: 4=C1 5=C2 6=AP (Agrupaciones Profesionales) | idPlazo: 1=abierto 3=últimas72h 2=cerrado
 *   tipoVista=Avanzado (hidden) | busquedaRealizada=true
 *   GOTCHA: enviar campos de fecha (fechaPublicacion*) o tipoVista=0 vacíos
 *           provoca HTTP 400 → mandar SOLO selects con valor.
 *   Paginación: numPaginaActual + paginador=true; meta en numPaginasTotales.
 *
 * Cada resultado es un <li class="ppg-table__list--type02"> que lleva un input
 * hidden `jsonDetalle` TOTALMENTE estructurado (usa # en vez de comillas) →
 * NO hace falta LLM para parsear.
 */

export const PAG_ADV_URL =
  'https://administracion.gob.es/pagFront/empleoBecas/empleo/buscadorEmpleoAvanzado.htm';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const GRUPOS: Record<string, string> = { '4': 'C1', '5': 'C2', '6': 'AP' };

const CCAA: Record<string, string> = {
  '00': 'Nacional', '01': 'Andalucía', '02': 'Aragón', '03': 'Asturias',
  '04': 'Baleares', '05': 'Canarias', '06': 'Cantabria', '07': 'Castilla y León',
  '08': 'Castilla-La Mancha', '09': 'Cataluña', '10': 'C. Valenciana',
  '11': 'Extremadura', '12': 'Galicia', '13': 'Madrid', '14': 'Murcia',
  '15': 'Navarra', '16': 'País Vasco', '17': 'La Rioja', '18': 'Ceuta', '19': 'Melilla',
};

const ADMIN: Record<string, string> = {
  '1': 'Estatal', '2': 'Autonómica', '3': 'Local', '4': 'Universidad', '5': 'Otra',
};

/** Convocatoria C1/C2 extraída del PAG. */
export interface PagConvocatoria {
  /** idConvocatoria del PAG — estable, sirve de dedupe key. */
  id: string;
  cuerpo: string;
  /** 'C1' | 'C2' */
  grupo: string;
  organismo: string;
  /** Estatal / Autonómica / Local / Universidad */
  admin: string;
  ccaa: string;
  plazas: number | null;
  /** YYYY-MM-DD si se pudo parsear, si no el texto crudo. */
  plazoHasta: string | null;
  titulacion: string;
}

export interface PagPage {
  status: number;
  items: PagConvocatoria[];
  totalPaginas: number;
  total: number | null;
}

function decode(s: string): string {
  return s
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// jsonDetalle usa # como delimitador: #campo#:#valor#
function jdField(json: string, key: string): string {
  const m = json.match(new RegExp(`#${key}#:#?([^#,}]*)#?`));
  return m ? m[1].trim() : '';
}

/** PURA: parsea el HTML de resultados del PAG a convocatorias estructuradas. */
export function parsePagItems(html: string): PagConvocatoria[] {
  const out: PagConvocatoria[] = [];
  const blocks = html.split('<li class="ppg-table__list--type02').slice(1);
  for (const raw of blocks) {
    const block = raw.slice(0, 6000);
    const field = (label: string): string => {
      const m = block.match(
        new RegExp(`${label}\\s*</h4>\\s*<p[^>]*>([\\s\\S]*?)</p>`, 'i'),
      );
      return m ? decode(m[1]) : '';
    };
    const h3 = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const titulo = h3 ? decode(h3[1]) : '';
    const refM = titulo.match(/Ref\.?\s*(\d+)/i);
    const jd = (block.match(/name="jsonDetalle"\s+value="([^"]*)"/) || [])[1] || '';
    const plazoTxt = field('Plazo de presentaci[oó]n:');
    const fechaM = plazoTxt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const plazasRaw = field('Convocadas:') || jdField(jd, 'sDesde');
    const plazasNum = parseInt(plazasRaw, 10);

    out.push({
      id: jdField(jd, 'idConvocatoria') || (refM ? refM[1] : ''),
      cuerpo:
        jdField(jd, 'desDenominacionCuerpo') ||
        titulo.replace(/Ref\.?\s*\d+\s*\|?\s*/i, ''),
      grupo: GRUPOS[jdField(jd, 'idsGrupo')] || jdField(jd, 'idsGrupo'),
      organismo: field('[oÓ]rgano convocante:'),
      admin: ADMIN[jdField(jd, 'idsAdmiconvocante')] || '?',
      ccaa: CCAA[jdField(jd, 'idsCcaa')] || jdField(jd, 'idsCcaa'),
      plazas: Number.isFinite(plazasNum) ? plazasNum : null,
      plazoHasta: fechaM ? `${fechaM[3]}-${fechaM[2]}-${fechaM[1]}` : plazoTxt || null,
      titulacion: field('Titulaci[oó]n:'),
    });
  }
  return out;
}

/** PURA: lee la meta de paginación del HTML. */
export function parsePagMeta(html: string): { totalPaginas: number; total: number | null } {
  const m = html.match(
    /#numPaginasTotales#:(\d+),#numRegistrosMostrar#:\d+,#elementoInicialPaginacion#:\d+,#elementoFinalPaginacion#:\d+,#numRegistrosTotales#:(\d+)/,
  );
  return {
    totalPaginas: m ? parseInt(m[1], 10) : 1,
    total: m ? parseInt(m[2], 10) : null,
  };
}

function buildForm(grupo: number, plazo: number, pagina: number): string {
  // Set completo de campos válidos. Los de fecha/numéricos van con '0'/'' SOLO
  // donde el bean lo tolera; fechaPublicacion* y tipoVista=0 vacíos → HTTP 400.
  const params: Record<string, string> = {
    tipoVista: 'Avanzado',
    busquedaRealizada: 'true',
    denominacion: '',
    referencia: '',
    idGeografica: '0',
    idAmbCAutonoma: '0',
    idAmbProvincia: '0',
    idConvocante: '0',
    tipoPlazaPublicacion: '0',
    idVia: '2',
    idSeleccion: '0',
    idGrupo: String(grupo),
    idPlazo: String(plazo),
  };
  if (pagina > 1) {
    params.numPaginaActual = String(pagina);
    params.paginador = 'true';
  }
  return new URLSearchParams(params).toString();
}

/** Hace UNA petición POST al PAG y devuelve la página parseada. */
export async function fetchPagPage(
  grupo: number,
  plazo: number,
  pagina: number,
  timeoutMs = 20_000,
): Promise<PagPage> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(PAG_ADV_URL, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: PAG_ADV_URL,
      },
      body: buildForm(grupo, plazo, pagina),
      signal: controller.signal,
    });
    if (res.status !== 200) {
      return { status: res.status, items: [], totalPaginas: 0, total: 0 };
    }
    const html = await res.text();
    const meta = parsePagMeta(html);
    return { status: 200, items: parsePagItems(html), ...meta };
  } finally {
    clearTimeout(t);
  }
}

/** Lee TODAS las páginas de un grupo+plazo (paginando). */
export async function fetchPagGrupo(grupo: number, plazo: number): Promise<PagConvocatoria[]> {
  const first = await fetchPagPage(grupo, plazo, 1);
  if (first.status !== 200) {
    throw new Error(`PAG grupo ${grupo} plazo ${plazo}: HTTP ${first.status}`);
  }
  let all = [...first.items];
  for (let p = 2; p <= first.totalPaginas; p++) {
    const pg = await fetchPagPage(grupo, plazo, p);
    all = all.concat(pg.items);
  }
  return all;
}

// Guardarraíl §1 del manual de importación: SOLO turno/ingreso libre. Descarta
// promoción interna, estabilización y consolidación (procesos que no modelamos).
const NOT_LIBRE_RE =
  /(promoci[oó]n interna|estabilizaci[oó]n|consolidaci[oó]n|personal laboral)/i;

/** ¿Es una convocatoria de ingreso libre C1/C2 que nos interesa? */
export function isRelevantPagConvocatoria(c: PagConvocatoria): boolean {
  if (!c.id) return false;
  if (!['C1', 'C2'].includes(c.grupo)) return false;
  const hay = `${c.cuerpo} ${c.titulacion} ${c.organismo}`;
  return !NOT_LIBRE_RE.test(hay);
}
