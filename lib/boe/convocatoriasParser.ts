/**
 * Parser para extraer información de convocatorias del BOE
 * Detecta tipo, categoría, oposición, plazas, etc.
 */

// Importar función de conversión de texto español a número
import { spanishTextToNumber } from '../boe-extractor.js';

// ============================================
// TIPOS
// ============================================

export type TipoConvocatoria = 'convocatoria' | 'admitidos' | 'tribunal' | 'resultado' | 'correccion' | 'otro';
export type Categoria = 'A1' | 'A2' | 'B' | 'C1' | 'C2';
export type TipoAcceso = 'libre' | 'promocion_interna' | 'mixto' | 'discapacidad';

export interface DatosExtraidos {
  plazoInscripcionDias: number | null;
  titulacionRequerida: string | null;
  tieneTemario: boolean;
  fechaExamenMencionada: string | null;
  urlBases: string | null;
}

export interface PlazasExtraidas {
  total: number | null;
  libre: number | null;
  pi: number | null;
  discapacidad: number | null;
}

// ============================================
// DETECCIÓN DE TIPO
// ============================================

/**
 * Detecta el tipo de publicación basándose en el título
 */
export function detectarTipo(titulo: string): TipoConvocatoria {
  const t = titulo.toLowerCase();

  // Convocatoria de proceso selectivo
  if (
    (t.includes('convoca') || t.includes('convocan')) &&
    (t.includes('proceso selectivo') ||
     t.includes('oposici') ||
     t.includes('concurso-oposici') ||
     t.includes('concurso oposici') ||
     t.includes('pruebas selectivas') ||
     t.includes('plazas'))
  ) {
    return 'convocatoria';
  }

  // Lista de admitidos/excluidos
  if (
    t.includes('relación definitiva') ||
    t.includes('relacion definitiva') ||
    t.includes('lista definitiva') ||
    t.includes('admitidos y excluidos') ||
    t.includes('relación provisional') ||
    t.includes('relacion provisional') ||
    (t.includes('admitidos') && t.includes('excluidos'))
  ) {
    return 'admitidos';
  }

  // Tribunal calificador
  if (
    t.includes('tribunal calificador') ||
    t.includes('composición del tribunal') ||
    t.includes('composicion del tribunal') ||
    t.includes('nombramiento del tribunal') ||
    (t.includes('tribunal') && (t.includes('nombr') || t.includes('design')))
  ) {
    return 'tribunal';
  }

  // Resultados / Aprobados
  if (
    t.includes('aprobados') ||
    t.includes('relación de personas que han superado') ||
    t.includes('relacion de personas que han superado') ||
    t.includes('han superado el proceso') ||
    t.includes('resultado') && t.includes('proceso selectivo')
  ) {
    return 'resultado';
  }

  // Corrección de errores
  if (
    t.includes('corrección de errores') ||
    t.includes('correccion de errores')
  ) {
    return 'correccion';
  }

  return 'otro';
}

// ============================================
// DETECCIÓN DE CATEGORÍA
// ============================================

/**
 * Detecta la categoría/grupo (A1, A2, C1, C2) de la convocatoria
 */
export function detectarCategoria(titulo: string, epigrafe: string = ''): Categoria | null {
  const texto = `${titulo} ${epigrafe}`.toLowerCase();

  // C2 - Auxiliar
  if (
    texto.includes('subgrupo c2') ||
    texto.includes('grupo c2') ||
    texto.includes('c2)') ||
    texto.includes('cuerpo general auxiliar') ||
    (texto.includes('auxiliar') && texto.includes('administrativ'))
  ) {
    return 'C2';
  }

  // C1 - Administrativo
  if (
    texto.includes('subgrupo c1') ||
    texto.includes('grupo c1') ||
    texto.includes('c1)') ||
    (texto.includes('cuerpo general administrativo') && !texto.includes('auxiliar')) ||
    (texto.includes('administrativo') && texto.includes('estado') && !texto.includes('auxiliar'))
  ) {
    return 'C1';
  }

  // A2
  if (
    texto.includes('subgrupo a2') ||
    texto.includes('grupo a2') ||
    texto.includes('a2)')
  ) {
    return 'A2';
  }

  // A1
  if (
    texto.includes('subgrupo a1') ||
    texto.includes('grupo a1') ||
    texto.includes('a1)')
  ) {
    return 'A1';
  }

  // B
  if (
    texto.includes('grupo b)') ||
    texto.includes('subgrupo b)')
  ) {
    return 'B';
  }

  return null;
}

// ============================================
// DETECCIÓN DE OPOSICIÓN
// ============================================

/**
 * Detecta si la convocatoria corresponde a una oposición que cubrimos
 */
export function detectarOposicion(titulo: string, departamento: string = ''): string | null {
  const texto = `${titulo} ${departamento}`.toLowerCase();

  // Auxiliar Administrativo del Estado
  if (
    texto.includes('cuerpo general auxiliar') ||
    texto.includes('cuerpo auxiliar de la administracion') ||
    texto.includes('cuerpo auxiliar de la administración') ||
    (texto.includes('auxiliar') && texto.includes('administrativ') &&
     (texto.includes('estado') || texto.includes('administración general')))
  ) {
    return 'auxiliar-administrativo-estado';
  }

  // Administrativo del Estado
  if (
    texto.includes('cuerpo general administrativo') ||
    (texto.includes('administrativo') && texto.includes('estado') &&
     !texto.includes('auxiliar') && !texto.includes('superior'))
  ) {
    return 'administrativo-estado';
  }

  // Gestión Procesal
  if (
    texto.includes('gestión procesal') ||
    texto.includes('gestion procesal') ||
    texto.includes('cuerpo de gestión procesal')
  ) {
    return 'gestion-procesal';
  }

  return null;
}

// ============================================
// EXTRACCIÓN DE PLAZAS
// ============================================

/**
 * Extrae el número de plazas del título
 */
export function extraerPlazas(titulo: string): PlazasExtraidas {
  const t = titulo.toLowerCase();

  // Total de plazas (patrón más común: "X plazas")
  const totalMatch = t.match(/(\d+(?:\.\d+)?)\s*plazas?(?!\s+(?:de\s+)?libre)/i);
  let total: number | null = null;
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace('.', ''));
  }

  // Plazas de acceso libre
  const libreMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:plazas?\s+)?(?:de\s+)?(?:acceso\s+)?libre/i);
  let libre: number | null = null;
  if (libreMatch) {
    libre = parseInt(libreMatch[1].replace('.', ''));
  }

  // Plazas de promoción interna
  const piMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:plazas?\s+)?(?:de\s+)?promoci[oó]n\s+interna/i);
  let pi: number | null = null;
  if (piMatch) {
    pi = parseInt(piMatch[1].replace('.', ''));
  }

  // Plazas reservadas discapacidad
  const discMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:plazas?\s+)?(?:reservad[ao]s?\s+)?(?:para\s+)?(?:personas?\s+con\s+)?discapacidad/i);
  let discapacidad: number | null = null;
  if (discMatch) {
    discapacidad = parseInt(discMatch[1].replace('.', ''));
  }

  // Si no encontramos total pero sí libre y PI, sumar
  if (!total && (libre || pi)) {
    total = (libre || 0) + (pi || 0);
  }

  return {
    total,
    libre,
    pi,
    discapacidad
  };
}

// ============================================
// DETECCIÓN DE TIPO DE ACCESO
// ============================================

/**
 * Detecta el tipo de acceso de la convocatoria
 */
export function detectarAcceso(titulo: string): TipoAcceso | null {
  const t = titulo.toLowerCase();

  if (t.includes('acceso libre') && t.includes('promoción interna')) {
    return 'mixto';
  }

  if (t.includes('promoción interna') || t.includes('promocion interna')) {
    return 'promocion_interna';
  }

  if (t.includes('acceso libre') || t.includes('turno libre')) {
    return 'libre';
  }

  if (t.includes('discapacidad') || t.includes('diversidad funcional')) {
    return 'discapacidad';
  }

  return null;
}

// ============================================
// EXTRACCIÓN DE DATOS DEL TEXTO COMPLETO
// ============================================

/**
 * Extrae datos adicionales del texto completo de la convocatoria
 */
export function extraerDatosDelTexto(texto: string): DatosExtraidos {
  if (!texto) {
    return {
      plazoInscripcionDias: null,
      titulacionRequerida: null,
      tieneTemario: false,
      fechaExamenMencionada: null,
      urlBases: null
    };
  }

  const t = texto.toLowerCase();

  return {
    plazoInscripcionDias: extraerPlazo(t),
    titulacionRequerida: extraerTitulacion(t),
    tieneTemario: t.includes('programa') || t.includes('temario'),
    fechaExamenMencionada: extraerFechaExamen(t),
    urlBases: extraerUrlBases(texto)
  };
}

/**
 * Extrae el plazo de inscripción en días
 */
function extraerPlazo(texto: string): number | null {
  // Patrón: "plazo de X días hábiles/naturales"
  const match = texto.match(/plazo\s+de\s+(\w+)\s+d[ií]as\s+(?:h[aá]biles|naturales)?/i);
  if (match) {
    const num = spanishTextToNumber(match[1]);
    if (num) return parseInt(num);
  }

  // Patrón: "X días hábiles"
  const match2 = texto.match(/(\d+)\s+d[ií]as\s+h[aá]biles/i);
  if (match2) {
    return parseInt(match2[1]);
  }

  // Patrón: "veinte días"
  const match3 = texto.match(/(veinte|quince|treinta|diez)\s+d[ií]as/i);
  if (match3) {
    const num = spanishTextToNumber(match3[1]);
    if (num) return parseInt(num);
  }

  return null;
}

/**
 * Extrae la titulación requerida
 */
function extraerTitulacion(texto: string): string | null {
  // Bachiller
  if (texto.includes('título de bachiller') || texto.includes('bachillerato')) {
    return 'Bachiller o equivalente';
  }

  // ESO / Graduado Escolar
  if (texto.includes('graduado en educación secundaria') ||
      texto.includes('graduado escolar') ||
      texto.includes('título de eso')) {
    return 'Graduado ESO o equivalente';
  }

  // Grado universitario
  if (texto.includes('título de grado') || texto.includes('licenciatura')) {
    return 'Grado universitario';
  }

  // Técnico Superior
  if (texto.includes('técnico superior') || texto.includes('ciclo formativo de grado superior')) {
    return 'Técnico Superior (FP)';
  }

  return null;
}

/**
 * Extrae mención de fecha de examen
 */
function extraerFechaExamen(texto: string): string | null {
  // Buscar patrones de fecha
  const match = texto.match(/(?:primer\s+ejercicio|examen|prueba).*?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  if (match) {
    const meses: { [key: string]: string } = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };
    const dia = match[1].padStart(2, '0');
    const mes = meses[match[2].toLowerCase()];
    const año = match[3];
    return `${año}-${mes}-${dia}`;
  }

  return null;
}

/**
 * Extrae URLs de bases específicas
 */
function extraerUrlBases(texto: string): string | null {
  // Buscar URLs
  const urlMatch = texto.match(/https?:\/\/[^\s<>"]+(?:bases|convocatoria)[^\s<>"]*/i);
  if (urlMatch) {
    return urlMatch[0];
  }

  return null;
}

// ============================================
// CÁLCULO DE RELEVANCIA
// ============================================

/**
 * Calcula una puntuación de relevancia para ordenar convocatorias
 * @returns Puntuación 0-100
 */
export function calcularRelevancia(datos: {
  tipo: TipoConvocatoria | null;
  categoria: Categoria | null;
  oposicionRelacionada: string | null;
  numPlazas: number | null;
  departamentoNombre?: string;
}): number {
  let score = 0;

  // Tipo de publicación (más importante)
  switch (datos.tipo) {
    case 'convocatoria':
      score += 50;
      break;
    case 'resultado':
      score += 40;
      break;
    case 'admitidos':
      score += 30;
      break;
    case 'tribunal':
      score += 20;
      break;
    case 'correccion':
      score += 15;
      break;
    default:
      score += 5;
  }

  // Es de una oposición que cubrimos
  if (datos.oposicionRelacionada) {
    score += 30;
  }

  // Tiene número de plazas definido
  if (datos.numPlazas && datos.numPlazas > 0) {
    score += 10;
    // Más plazas = más relevante (máx 10 puntos extra)
    score += Math.min(10, Math.floor(datos.numPlazas / 100));
  }

  // Categoría C1/C2 (nuestro público principal)
  if (datos.categoria === 'C2' || datos.categoria === 'C1') {
    score += 10;
  }

  // Departamentos prioritarios
  const deptoPrioritario = datos.departamentoNombre?.toLowerCase() || '';
  if (
    deptoPrioritario.includes('hacienda') ||
    deptoPrioritario.includes('función pública') ||
    deptoPrioritario.includes('justicia')
  ) {
    score += 5;
  }

  return Math.min(100, score);
}

// ============================================
// LIMPIEZA DE TÍTULO
// ============================================

/**
 * Limpia el título eliminando el prefijo típico
 * "Resolución de X de enero de 2026, de la Subsecretaría, por la que se..."
 * → "por la que se..."
 */
export function limpiarTitulo(titulo: string): string {
  // Eliminar prefijo de resolución
  let limpio = titulo
    .replace(/^Resoluci[oó]n\s+de\s+\d+\s+de\s+\w+\s+de\s+\d{4},?\s*/i, '')
    .replace(/^de\s+la\s+[\w\s]+,?\s*/i, '')
    .replace(/^por\s+la\s+que\s+se\s+/i, '')
    .trim();

  // Capitalizar primera letra
  if (limpio.length > 0) {
    limpio = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  }

  return limpio || titulo;
}

// ============================================
// DETECCIÓN GEOGRÁFICA
// ============================================

export type Ambito = 'estatal' | 'autonomico' | 'local';

export interface DatosGeograficos {
  ambito: Ambito | null;
  comunidadAutonoma: string | null;
  provincia: string | null;
  municipio: string | null;
}

// Mapa de provincias a comunidades autónomas
const PROVINCIA_A_CCAA: Record<string, string> = {
  // Andalucía
  'almería': 'Andalucía', 'almeria': 'Andalucía',
  'cádiz': 'Andalucía', 'cadiz': 'Andalucía',
  'córdoba': 'Andalucía', 'cordoba': 'Andalucía',
  'granada': 'Andalucía',
  'huelva': 'Andalucía',
  'jaén': 'Andalucía', 'jaen': 'Andalucía',
  'málaga': 'Andalucía', 'malaga': 'Andalucía',
  'sevilla': 'Andalucía',
  // Aragón
  'huesca': 'Aragón',
  'teruel': 'Aragón',
  'zaragoza': 'Aragón',
  // Asturias
  'asturias': 'Asturias', 'oviedo': 'Asturias',
  // Baleares
  'baleares': 'Islas Baleares', 'illes balears': 'Islas Baleares', 'mallorca': 'Islas Baleares',
  'menorca': 'Islas Baleares', 'ibiza': 'Islas Baleares', 'eivissa': 'Islas Baleares',
  // Canarias
  'las palmas': 'Canarias', 'gran canaria': 'Canarias',
  'santa cruz de tenerife': 'Canarias', 'tenerife': 'Canarias',
  // Cantabria
  'cantabria': 'Cantabria', 'santander': 'Cantabria',
  // Castilla-La Mancha
  'albacete': 'Castilla-La Mancha',
  'ciudad real': 'Castilla-La Mancha',
  'cuenca': 'Castilla-La Mancha',
  'guadalajara': 'Castilla-La Mancha',
  'toledo': 'Castilla-La Mancha',
  // Castilla y León
  'ávila': 'Castilla y León', 'avila': 'Castilla y León',
  'burgos': 'Castilla y León',
  'león': 'Castilla y León', 'leon': 'Castilla y León',
  'palencia': 'Castilla y León',
  'salamanca': 'Castilla y León',
  'segovia': 'Castilla y León',
  'soria': 'Castilla y León',
  'valladolid': 'Castilla y León',
  'zamora': 'Castilla y León',
  // Cataluña
  'barcelona': 'Cataluña',
  'girona': 'Cataluña', 'gerona': 'Cataluña',
  'lleida': 'Cataluña', 'lérida': 'Cataluña', 'lerida': 'Cataluña',
  'tarragona': 'Cataluña',
  // Comunidad Valenciana
  'alicante': 'Comunidad Valenciana', 'alacant': 'Comunidad Valenciana',
  'castellón': 'Comunidad Valenciana', 'castellon': 'Comunidad Valenciana', 'castelló': 'Comunidad Valenciana',
  'valencia': 'Comunidad Valenciana', 'valència': 'Comunidad Valenciana',
  // Extremadura
  'badajoz': 'Extremadura',
  'cáceres': 'Extremadura', 'caceres': 'Extremadura',
  // Galicia
  'a coruña': 'Galicia', 'la coruña': 'Galicia', 'coruña': 'Galicia',
  'lugo': 'Galicia',
  'ourense': 'Galicia', 'orense': 'Galicia',
  'pontevedra': 'Galicia',
  // La Rioja
  'la rioja': 'La Rioja', 'logroño': 'La Rioja',
  // Madrid
  'madrid': 'Madrid',
  // Murcia
  'murcia': 'Murcia',
  // Navarra
  'navarra': 'Navarra', 'pamplona': 'Navarra',
  // País Vasco
  'álava': 'País Vasco', 'alava': 'País Vasco', 'araba': 'País Vasco', 'vitoria': 'País Vasco',
  'guipúzcoa': 'País Vasco', 'guipuzcoa': 'País Vasco', 'gipuzkoa': 'País Vasco', 'san sebastián': 'País Vasco',
  'vizcaya': 'País Vasco', 'bizkaia': 'País Vasco', 'bilbao': 'País Vasco',
  // Ceuta y Melilla
  'ceuta': 'Ceuta',
  'melilla': 'Melilla',
};

// Patrones para detectar CCAA directamente en el texto
const CCAA_PATTERNS: Record<string, string> = {
  'andaluc': 'Andalucía',
  'aragón': 'Aragón', 'aragon': 'Aragón',
  'asturias': 'Asturias', 'principado de asturias': 'Asturias',
  'baleares': 'Islas Baleares', 'illes balears': 'Islas Baleares',
  'canarias': 'Canarias',
  'cantabria': 'Cantabria',
  'castilla-la mancha': 'Castilla-La Mancha', 'castilla la mancha': 'Castilla-La Mancha',
  'castilla y león': 'Castilla y León', 'castilla y leon': 'Castilla y León',
  'cataluña': 'Cataluña', 'catalunya': 'Cataluña',
  'comunidad valenciana': 'Comunidad Valenciana', 'comunitat valenciana': 'Comunidad Valenciana',
  'extremadura': 'Extremadura',
  'galicia': 'Galicia',
  'la rioja': 'La Rioja',
  'comunidad de madrid': 'Madrid',
  'región de murcia': 'Murcia', 'region de murcia': 'Murcia',
  'navarra': 'Navarra', 'comunidad foral de navarra': 'Navarra',
  'país vasco': 'País Vasco', 'pais vasco': 'País Vasco', 'euskadi': 'País Vasco',
};

/**
 * Detecta el ámbito territorial de la convocatoria
 */
export function detectarAmbito(departamentoNombre: string, titulo: string): Ambito | null {
  const depto = departamentoNombre.toLowerCase();
  const t = titulo.toLowerCase();

  // Local: Ayuntamientos, Diputaciones, Administración Local
  if (
    depto.includes('administración local') ||
    depto.includes('administracion local') ||
    t.includes('ayuntamiento') ||
    t.includes('diputación provincial') ||
    t.includes('diputacion provincial') ||
    t.includes('cabildo') ||
    t.includes('consell insular') ||
    t.includes('mancomunidad')
  ) {
    return 'local';
  }

  // Autonómico: Universidades, Consejerías
  if (
    depto.includes('universidad') ||
    t.includes('consejería') ||
    t.includes('consejeria') ||
    t.includes('junta de') ||
    t.includes('gobierno de') ||
    t.includes('generalitat') ||
    t.includes('xunta')
  ) {
    return 'autonomico';
  }

  // Estatal: Ministerios y AGE
  if (
    depto.includes('ministerio') ||
    depto.includes('consejo') ||
    depto.includes('tribunal') ||
    t.includes('administración general del estado') ||
    t.includes('administracion general del estado')
  ) {
    return 'estatal';
  }

  return null;
}

/**
 * Extrae la provincia del título
 * Detecta patrones como "Ayuntamiento de X (Provincia)"
 */
export function extraerProvincia(titulo: string): string | null {
  // Patrón: cualquier cosa entre paréntesis al final que sea una provincia
  const matchParentesis = titulo.match(/\(([^)]+)\)\s*(?:,|$|referente|que)/i);
  if (matchParentesis) {
    const contenido = matchParentesis[1].toLowerCase().trim();
    // Manejar doble nombre (Valencia/València)
    const partes = contenido.split('/');
    for (const parte of partes) {
      const p = parte.trim();
      if (PROVINCIA_A_CCAA[p]) {
        // Capitalizar primera letra
        return p.charAt(0).toUpperCase() + p.slice(1);
      }
    }
  }

  // Patrón: "Diputación Provincial de X"
  const matchDiputacion = titulo.match(/diputaci[oó]n\s+provincial\s+de\s+(\w+)/i);
  if (matchDiputacion) {
    const prov = matchDiputacion[1].toLowerCase();
    if (PROVINCIA_A_CCAA[prov]) {
      return prov.charAt(0).toUpperCase() + prov.slice(1);
    }
  }

  return null;
}

/**
 * Extrae el municipio del título
 */
export function extraerMunicipio(titulo: string): string | null {
  // Patrón: "Ayuntamiento de X"
  const matchAyto = titulo.match(/ayuntamiento\s+de\s+([^(,]+)/i);
  if (matchAyto) {
    return matchAyto[1].trim();
  }

  return null;
}

/**
 * Detecta la comunidad autónoma
 */
export function detectarComunidadAutonoma(titulo: string, departamento: string, provincia: string | null): string | null {
  const texto = `${titulo} ${departamento}`.toLowerCase();

  // Primero: Si tenemos provincia, mapear a CCAA
  if (provincia) {
    const provLower = provincia.toLowerCase();
    if (PROVINCIA_A_CCAA[provLower]) {
      return PROVINCIA_A_CCAA[provLower];
    }
  }

  // Segundo: Buscar mención directa de CCAA
  for (const [pattern, ccaa] of Object.entries(CCAA_PATTERNS)) {
    if (texto.includes(pattern)) {
      return ccaa;
    }
  }

  // Tercero: Buscar universidades (suelen tener nombre de CCAA o provincia)
  const matchUni = texto.match(/universidad\s+de\s+(\w+)/i);
  if (matchUni) {
    const uniName = matchUni[1].toLowerCase();
    if (PROVINCIA_A_CCAA[uniName]) {
      return PROVINCIA_A_CCAA[uniName];
    }
    for (const [pattern, ccaa] of Object.entries(CCAA_PATTERNS)) {
      if (uniName.includes(pattern)) {
        return ccaa;
      }
    }
  }

  return null;
}

/**
 * Extrae todos los datos geográficos de una convocatoria
 */
export function extraerDatosGeograficos(titulo: string, departamento: string): DatosGeograficos {
  const ambito = detectarAmbito(departamento, titulo);
  const municipio = extraerMunicipio(titulo);
  const provincia = extraerProvincia(titulo);
  const comunidadAutonoma = detectarComunidadAutonoma(titulo, departamento, provincia);

  return {
    ambito,
    comunidadAutonoma,
    provincia,
    municipio
  };
}
