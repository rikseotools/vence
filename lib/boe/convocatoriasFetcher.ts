/**
 * Fetcher para obtener convocatorias del BOE
 * Usa la API de datos abiertos del BOE: https://www.boe.es/datosabiertos/api/
 */

export interface ConvocatoriaBOE {
  boeId: string;
  titulo: string;
  departamentoCodigo: string;
  departamentoNombre: string;
  epigrafe: string;
  urlPdf: string | null;
  urlHtml: string | null;
  urlXml: string | null;
  fechaPublicacion: string; // YYYYMMDD
}

export interface ConvocatoriaXMLData {
  fechaDisposicion: string | null;
  rango: string | null;
  paginaInicial: number | null;
  paginaFinal: number | null;
  contenidoTexto: string;
  // Referencias a publicaciones anteriores del BOE (para vincular publicaciones relacionadas)
  referenciasAnteriores: string[];
}

interface BOESumarioResponse {
  status: {
    code: string;
    text: string;
  };
  data: {
    sumario: {
      metadatos: {
        publicacion: string;
        fecha_publicacion: string;
      };
      diario: Array<{
        numero: string;
        seccion: Array<{
          codigo: string;
          nombre: string;
          departamento?: Array<{
            codigo: string;
            nombre: string;
            epigrafe: Array<{
              nombre: string;
              item: BOEItem | BOEItem[];
            }>;
          }>;
        }>;
      }>;
    };
  };
}

interface BOEItem {
  identificador: string;
  control: string;
  titulo: string;
  url_pdf?: {
    texto: string;
    szBytes?: string;
    pagina_inicial?: string;
    pagina_final?: string;
  } | string;
  url_html?: string;
  url_xml?: string;
}

/**
 * Obtiene el sumario del BOE de una fecha específica
 * @param fecha - Fecha en formato YYYYMMDD
 * @returns Array de convocatorias de la sección 2B (Oposiciones y concursos)
 */
export async function fetchBoeSumario(fecha: string): Promise<ConvocatoriaBOE[]> {
  const url = `https://www.boe.es/datosabiertos/api/boe/sumario/${fecha}`;

  console.log(`📥 Descargando sumario BOE: ${fecha}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Vence/1.0 (https://www.vence.es)'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching BOE sumario: ${response.status} ${response.statusText}`);
  }

  const data: BOESumarioResponse = await response.json();

  if (data.status.code !== '200') {
    throw new Error(`BOE API error: ${data.status.text}`);
  }

  // Buscar sección 2B (Oposiciones y concursos)
  const diario = data.data.sumario.diario[0];
  if (!diario) {
    console.log('⚠️ No hay diario en el sumario');
    return [];
  }

  const seccion2B = diario.seccion.find(s => s.codigo === '2B');
  if (!seccion2B || !seccion2B.departamento) {
    console.log('⚠️ No hay sección 2B (Oposiciones y concursos) en este día');
    return [];
  }

  // Extraer todas las convocatorias
  const convocatorias: ConvocatoriaBOE[] = [];

  for (const depto of seccion2B.departamento) {
    for (const epigrafe of depto.epigrafe) {
      // item puede ser un objeto o un array de objetos
      const items = Array.isArray(epigrafe.item) ? epigrafe.item : [epigrafe.item];

      for (const item of items) {
        if (!item) continue;

        convocatorias.push({
          boeId: item.identificador,
          titulo: item.titulo,
          departamentoCodigo: depto.codigo,
          departamentoNombre: depto.nombre,
          epigrafe: epigrafe.nombre,
          urlPdf: typeof item.url_pdf === 'object' ? item.url_pdf?.texto : item.url_pdf || null,
          urlHtml: item.url_html || null,
          urlXml: item.url_xml || null,
          fechaPublicacion: fecha,
        });
      }
    }
  }

  console.log(`📄 Encontradas ${convocatorias.length} publicaciones en sección 2B`);
  return convocatorias;
}

/**
 * Descarga y parsea el XML completo de una convocatoria
 * @param boeId - Identificador BOE, ej: "BOE-A-2026-577"
 * @returns Datos extraídos del XML
 */
export async function fetchConvocatoriaXML(boeId: string): Promise<ConvocatoriaXMLData> {
  const url = `https://www.boe.es/diario_boe/xml.php?id=${boeId}`;

  console.log(`📥 Descargando XML: ${boeId}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Vence/1.0 (https://www.vence.es)'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching XML ${boeId}: ${response.status}`);
  }

  const xml = await response.text();

  // Extraer campos del XML
  const fechaDisposicion = extractXmlField(xml, 'fecha_disposicion');
  const rango = extractXmlField(xml, 'rango');
  const paginaInicial = extractXmlField(xml, 'pagina_inicial');
  const paginaFinal = extractXmlField(xml, 'pagina_final');

  // Extraer todo el contenido de <texto>
  const contenidoTexto = extractXmlContent(xml, 'texto');

  // Extraer referencias a publicaciones anteriores del BOE
  const referenciasAnteriores = extractBoeReferences(xml);

  return {
    fechaDisposicion: fechaDisposicion ? formatBOEDate(fechaDisposicion) : null,
    rango,
    paginaInicial: paginaInicial ? parseInt(paginaInicial) : null,
    paginaFinal: paginaFinal ? parseInt(paginaFinal) : null,
    contenidoTexto,
    referenciasAnteriores,
  };
}

/**
 * Extrae un campo simple del XML
 */
function extractXmlField(xml: string, fieldName: string): string | null {
  const regex = new RegExp(`<${fieldName}[^>]*>([^<]*)</${fieldName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extrae el contenido completo de una etiqueta XML (incluyendo HTML interno)
 */
function extractXmlContent(xml: string, tagName: string): string {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;

  const startIndex = xml.indexOf(startTag);
  const endIndex = xml.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1) {
    return '';
  }

  const content = xml.substring(startIndex + startTag.length, endIndex);

  // Limpiar HTML básico y decodificar entidades
  return cleanHtmlContent(content);
}

/**
 * Limpia el contenido HTML extrayendo solo el texto
 */
function cleanHtmlContent(html: string): string {
  return html
    // Decodificar entidades HTML comunes
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // Eliminar etiquetas HTML pero mantener saltos de línea en párrafos
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

/**
 * Formatea fecha BOE (YYYYMMDD) a formato ISO (YYYY-MM-DD)
 */
function formatBOEDate(fecha: string): string {
  if (fecha.length !== 8) return fecha;
  return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
}

/**
 * Extrae referencias a publicaciones anteriores del XML del BOE
 * Busca en la sección <analisis><referencias><anteriores>
 * Ejemplo: <anterior referencia="BOE-A-2023-26357" orden="4100">...</anterior>
 */
function extractBoeReferences(xml: string): string[] {
  const references: string[] = [];

  // Patrón para encontrar referencias anteriores
  // Formato: <anterior referencia="BOE-A-2023-26357" ...>
  const anteriorPattern = /<anterior[^>]*referencia="([^"]+)"[^>]*>/gi;
  let match;

  while ((match = anteriorPattern.exec(xml)) !== null) {
    const ref = match[1];
    if (ref && ref.startsWith('BOE-') && !references.includes(ref)) {
      references.push(ref);
    }
  }

  return references;
}

/**
 * Verifica si el BOE está disponible para una fecha
 * @param fecha - Fecha en formato YYYYMMDD
 * @returns true si hay sumario disponible
 */
export async function checkBoeAvailable(fecha: string): Promise<boolean> {
  try {
    const url = `https://www.boe.es/datosabiertos/api/boe/sumario/${fecha}`;
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'Accept': 'application/json' }
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Genera un array de fechas entre dos fechas (inclusive)
 * @param desde - Fecha inicio YYYY-MM-DD
 * @param hasta - Fecha fin YYYY-MM-DD
 * @returns Array de fechas en formato YYYYMMDD
 */
export function generarRangoFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  const fechaInicio = new Date(desde);
  const fechaFin = new Date(hasta);

  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    // Solo días laborables (Lunes a Viernes)
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      fechas.push(`${year}${month}${day}`);
    }
  }

  return fechas;
}
