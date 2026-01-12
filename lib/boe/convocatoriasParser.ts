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

  // 1. Corrección de errores (más específico, comprobar primero)
  if (
    t.includes('corrección de errores') ||
    t.includes('correccion de errores')
  ) {
    return 'correccion';
  }

  // 2. Resultados / Aprobados (antes de admitidos porque "superado" es más específico)
  if (
    t.includes('aprobados') ||
    t.includes('personas aprobadas') ||
    t.includes('han superado') ||
    t.includes('hayan superado') ||
    t.includes('que superaron') ||
    t.includes('relación de personas que han superado') ||
    t.includes('relacion de personas que han superado') ||
    (t.includes('publica') && t.includes('relación') && t.includes('aprobad'))
  ) {
    return 'resultado';
  }

  // 3. Lista de admitidos/excluidos
  if (
    t.includes('admitidos y excluidos') ||
    t.includes('admitidas y excluidas') ||
    t.includes('lista definitiva') ||
    t.includes('lista provisional') ||
    t.includes('relación definitiva de personas') ||
    t.includes('relacion definitiva de personas') ||
    t.includes('relación provisional de personas') ||
    t.includes('relacion provisional de personas') ||
    (t.includes('relación definitiva') && !t.includes('superado')) ||
    (t.includes('relacion definitiva') && !t.includes('superado')) ||
    (t.includes('admitidos') && t.includes('excluidos'))
  ) {
    return 'admitidos';
  }

  // 4. Tribunal calificador
  if (
    t.includes('tribunal calificador') ||
    t.includes('composición del tribunal') ||
    t.includes('composicion del tribunal') ||
    t.includes('nombramiento del tribunal') ||
    (t.includes('tribunal') && (t.includes('nombr') || t.includes('design')))
  ) {
    return 'tribunal';
  }

  // 5. Convocatoria de proceso selectivo (solo si usa "se convoca" activo, no "convocado")
  // Importante: "convocado" (pasado) indica referencia a un proceso ya convocado, no nueva convocatoria
  if (
    (t.includes('se convoca') || t.includes('se convocan') ||
     t.includes('por la que se convoca') || t.includes('por la que se convocan')) &&
    (t.includes('proceso selectivo') ||
     t.includes('oposici') ||
     t.includes('concurso-oposici') ||
     t.includes('concurso oposici') ||
     t.includes('pruebas selectivas') ||
     t.includes('plazas'))
  ) {
    return 'convocatoria';
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

/**
 * Detecta la categoría desde el contenido_texto
 * Busca patrones más específicos que en el título
 */
export function detectarCategoriaDeContenido(contenido: string): Categoria | null {
  if (!contenido) return null;

  const t = contenido.toLowerCase();

  // Patrones más específicos del contenido

  // C2 - Auxiliar (clase auxiliar, subgrupo C2)
  if (
    t.includes('subgrupo c2') ||
    t.includes('grupo c2') ||
    t.includes('clase auxiliar') ||
    (t.includes('subescala auxiliar') && !t.includes('técnic'))
  ) {
    return 'C2';
  }

  // C1 - Administrativo (clase administrativa, subgrupo C1)
  if (
    t.includes('subgrupo c1') ||
    t.includes('grupo c1') ||
    t.includes('clase administrativa') ||
    (t.includes('subescala administrativa') && !t.includes('auxiliar'))
  ) {
    return 'C1';
  }

  // A2 - Técnico medio (clase media, subgrupo A2)
  if (
    t.includes('subgrupo a2') ||
    t.includes('grupo a2') ||
    t.includes('clase media') ||
    t.includes('técnico medio') ||
    t.includes('tecnico medio')
  ) {
    return 'A2';
  }

  // A1 - Técnico superior (clase superior, subgrupo A1)
  if (
    t.includes('subgrupo a1') ||
    t.includes('grupo a1') ||
    t.includes('clase superior') ||
    t.includes('técnico superior') ||
    t.includes('tecnico superior')
  ) {
    return 'A1';
  }

  // B - Técnico (sin especificar)
  if (
    t.includes('grupo b)') ||
    t.includes('subgrupo b)') ||
    t.includes('grupo b ') ||
    (t.includes('técnico') && !t.includes('superior') && !t.includes('medio') && !t.includes('auxiliar'))
  ) {
    return 'B';
  }

  // Patrones por titulación requerida
  if (t.includes('graduado escolar') || t.includes('eso') || t.includes('educación secundaria obligatoria')) {
    return 'C2';
  }
  if (t.includes('bachiller') || t.includes('técnico superior')) {
    return 'C1';
  }
  if (t.includes('diplomatura') || t.includes('grado universitario')) {
    return 'A2';
  }
  if (t.includes('licenciatura') || t.includes('título de grado') || t.includes('ingeniería superior')) {
    return 'A1';
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

// Mapa de números en texto español
const NUMEROS_TEXTO: Record<string, number> = {
  'una': 1, 'uno': 1, 'un': 1,
  'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
  'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
  'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
  'veinte': 20, 'veintiuna': 21, 'veintiuno': 21, 'veintidós': 22, 'veintidos': 22,
  'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
  'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
  'setenta': 70, 'ochenta': 80, 'noventa': 90, 'cien': 100
};

/**
 * Convierte texto numérico español a número
 */
function textoANumero(texto: string): number | null {
  const t = texto.toLowerCase().trim();

  // Primero intentar como número directo
  const numDirecto = parseInt(t.replace(/\./g, ''));
  if (!isNaN(numDirecto)) return numDirecto;

  // Buscar en el mapa
  if (NUMEROS_TEXTO[t]) return NUMEROS_TEXTO[t];

  // Patrones compuestos: "treinta y cinco"
  const compuesto = t.match(/^(\w+)\s+y\s+(\w+)$/);
  if (compuesto) {
    const decenas = NUMEROS_TEXTO[compuesto[1]];
    const unidades = NUMEROS_TEXTO[compuesto[2]];
    if (decenas && unidades) return decenas + unidades;
  }

  return null;
}

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

/**
 * Extrae el número de plazas del contenido_texto (más completo que del título)
 * Busca patrones como "Dos plazas de...", "5 plazas de...", "la plaza de..."
 */
export function extraerPlazasDeContenido(contenido: string): PlazasExtraidas {
  if (!contenido) {
    return { total: null, libre: null, pi: null, discapacidad: null };
  }

  const t = contenido.toLowerCase();
  let totalPlazas = 0;
  let plazasLibre = 0;
  let plazasPI = 0;
  let plazasDiscapacidad = 0;

  // Patrón 1: "X plazas de..." con número
  const patronNumerico = /(\d+)\s+plazas?\s+(?:de|del|para|vacantes?|convocadas?)/gi;
  let match;
  while ((match = patronNumerico.exec(t)) !== null) {
    const num = parseInt(match[1]);
    totalPlazas += num;

    // Verificar contexto para tipo de acceso
    const contexto = t.substring(match.index, match.index + 200);
    if (contexto.includes('turno libre') || contexto.includes('acceso libre')) {
      plazasLibre += num;
    }
    if (contexto.includes('promoción interna') || contexto.includes('promocion interna')) {
      plazasPI += num;
    }
    if (contexto.includes('discapacidad') || contexto.includes('diversidad funcional')) {
      plazasDiscapacidad += num;
    }
  }

  // Patrón 2: "Una/Dos/Tres... plazas de..." con texto
  const patronTexto = /(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciséis|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuna|veintiuno|veintidós|veintidos|veintitrés|veintitres|veinticuatro|veinticinco|treinta|cuarenta|cincuenta)\s+plazas?\s+(?:de|del|para|vacantes?)/gi;

  while ((match = patronTexto.exec(t)) !== null) {
    const num = textoANumero(match[1]);
    if (num) {
      totalPlazas += num;

      // Verificar contexto
      const contexto = t.substring(match.index, match.index + 200);
      if (contexto.includes('turno libre') || contexto.includes('acceso libre')) {
        plazasLibre += num;
      }
      if (contexto.includes('promoción interna') || contexto.includes('promocion interna')) {
        plazasPI += num;
      }
    }
  }

  // Patrón 3: Total general "X plazas" al principio
  const patronTotal = /(?:^|\n)\s*(\d+)\s+plazas?\s*(?:\.|,|\n)/i;
  const matchTotal = t.match(patronTotal);
  if (matchTotal && totalPlazas === 0) {
    totalPlazas = parseInt(matchTotal[1]);
  }

  // Patrón 4: "la plaza de..." / "la plaza vacante" (singular = 1 plaza)
  // Solo si no hemos encontrado plazas aún
  if (totalPlazas === 0) {
    const patronSingular = /(?:la|esta|dicha|siguiente|presente)\s+plaza\s+(?:de|del|vacante|convocada|objeto)/gi;
    const matchesSingular = t.match(patronSingular);
    if (matchesSingular && matchesSingular.length > 0) {
      // Contar menciones únicas (evitar duplicados del mismo texto)
      totalPlazas = 1; // Singular = 1 plaza
    }
  }

  // Patrón 5: "provisión de la/una plaza" (singular = 1 plaza)
  if (totalPlazas === 0) {
    const patronProvision = /provisi[oó]n\s+(?:de\s+)?(?:la|una)\s+plaza/gi;
    if (patronProvision.test(t)) {
      totalPlazas = 1;
    }
  }

  // Patrón 6: "proveer la/una plaza" (singular = 1 plaza)
  if (totalPlazas === 0) {
    const patronProveer = /proveer\s+(?:la|una)\s+plaza/gi;
    if (patronProveer.test(t)) {
      totalPlazas = 1;
    }
  }

  // Patrón 7: "cubrir la/una plaza" (singular = 1 plaza)
  if (totalPlazas === 0) {
    const patronCubrir = /cubrir\s+(?:la|una)\s+plaza/gi;
    if (patronCubrir.test(t)) {
      totalPlazas = 1;
    }
  }

  // Patrón 8: "convocatoria de una plaza" (singular = 1 plaza)
  if (totalPlazas === 0) {
    const patronConvUna = /convocatoria\s+(?:de\s+)?una\s+plaza/gi;
    if (patronConvUna.test(t)) {
      totalPlazas = 1;
    }
  }

  return {
    total: totalPlazas > 0 ? totalPlazas : null,
    libre: plazasLibre > 0 ? plazasLibre : null,
    pi: plazasPI > 0 ? plazasPI : null,
    discapacidad: plazasDiscapacidad > 0 ? plazasDiscapacidad : null
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
  // Patrón 1: "plazo de X días hábiles/naturales"
  const match1 = texto.match(/plazo\s+(?:de\s+)?(\w+)\s+d[ií]as\s*(?:h[aá]biles|naturales)?/i);
  if (match1) {
    const numText = spanishTextToNumber(match1[1]);
    const num = numText ? parseInt(String(numText)) : parseInt(match1[1]);
    if (num && !isNaN(num)) return num;
  }

  // Patrón 2: "X días hábiles" (número)
  const match2 = texto.match(/(\d+)\s+d[ií]as\s*(?:h[aá]biles|naturales)/i);
  if (match2) {
    return parseInt(match2[1]);
  }

  // Patrón 3: "veinte/quince/treinta días" (texto común)
  const match3 = texto.match(/(veinte|veintiuno|veintidós|veintitrés|veinticuatro|veinticinco|quince|treinta|diez|cinco)\s+d[ií]as/i);
  if (match3) {
    const num = spanishTextToNumber(match3[1]);
    if (num) return parseInt(String(num));
  }

  // Patrón 4: "el plazo será de X días"
  const match4 = texto.match(/plazo\s+ser[aá]\s+(?:de\s+)?(\w+)\s+d[ií]as/i);
  if (match4) {
    const numText = spanishTextToNumber(match4[1]);
    const num = numText ? parseInt(String(numText)) : parseInt(match4[1]);
    if (num && !isNaN(num)) return num;
  }

  // Patrón 5: "presentación de solicitudes... X días"
  const match5 = texto.match(/presentaci[oó]n\s+de\s+(?:solicitudes?|instancias?).{0,50}(\d+)\s+d[ií]as/i);
  if (match5) {
    return parseInt(match5[1]);
  }

  // Patrón 6: "un mes" = 30 días (aproximado)
  if (texto.match(/plazo\s+(?:de\s+)?un\s+mes/i)) {
    return 30;
  }

  // Patrón 7: "X días naturales/hábiles a partir de"
  const match7 = texto.match(/(\d+)\s+d[ií]as\s*(?:h[aá]biles|naturales)?\s*(?:a\s+partir|desde|contados?)/i);
  if (match7) {
    return parseInt(match7[1]);
  }

  // Patrón 8: "plazo... finalizará... X días"
  const match8 = texto.match(/plazo.{0,30}finalizar[aá].{0,30}(\d+)\s+d[ií]as/i);
  if (match8) {
    return parseInt(match8[1]);
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
// DETECCIÓN DE ACCESO DESDE CONTENIDO
// ============================================

/**
 * Detecta el tipo de acceso desde el contenido_texto
 */
export function detectarAccesoDeContenido(contenido: string): TipoAcceso | null {
  if (!contenido) return null;

  const t = contenido.toLowerCase();

  // Contar menciones de cada tipo
  const mencionesLibre = (t.match(/turno libre|acceso libre/g) || []).length;
  const mencionesPI = (t.match(/promoci[oó]n interna/g) || []).length;
  const mencionesDisc = (t.match(/discapacidad|diversidad funcional/g) || []).length;

  // Determinar tipo
  if (mencionesLibre > 0 && mencionesPI > 0) {
    return 'mixto';
  }
  if (mencionesPI > 0 && mencionesLibre === 0) {
    return 'promocion_interna';
  }
  if (mencionesLibre > 0) {
    return 'libre';
  }
  if (mencionesDisc > 0) {
    return 'discapacidad';
  }

  return null;
}

// ============================================
// GENERACIÓN DE RESUMEN
// ============================================

/**
 * Genera un resumen estructurado de la convocatoria
 */
export function generarResumen(datos: {
  tipo: TipoConvocatoria | null;
  categoria: Categoria | null;
  numPlazas: number | null;
  numPlazasLibre: number | null;
  numPlazasPI: number | null;
  acceso: TipoAcceso | null;
  departamento: string | null;
  comunidadAutonoma: string | null;
  municipio: string | null;
  plazoInscripcion: number | null;
  titulacion: string | null;
}): string {
  const partes: string[] = [];

  // Tipo y plazas
  if (datos.tipo === 'convocatoria') {
    if (datos.numPlazas) {
      partes.push(`Convocatoria de ${datos.numPlazas} plazas`);
    } else {
      partes.push('Convocatoria de oposiciones');
    }
  } else if (datos.tipo === 'admitidos') {
    partes.push('Lista de admitidos y excluidos');
  } else if (datos.tipo === 'tribunal') {
    partes.push('Composición del tribunal calificador');
  } else if (datos.tipo === 'resultado') {
    partes.push('Resultados del proceso selectivo');
  }

  // Categoría
  if (datos.categoria) {
    const categoriaDesc: Record<string, string> = {
      'A1': 'Grupo A1 (Técnico Superior)',
      'A2': 'Grupo A2 (Técnico Medio)',
      'B': 'Grupo B',
      'C1': 'Grupo C1 (Administrativo)',
      'C2': 'Grupo C2 (Auxiliar)'
    };
    partes.push(categoriaDesc[datos.categoria] || `Grupo ${datos.categoria}`);
  }

  // Acceso
  if (datos.acceso) {
    if (datos.acceso === 'mixto') {
      const textoAcceso = [];
      if (datos.numPlazasLibre) textoAcceso.push(`${datos.numPlazasLibre} libre`);
      if (datos.numPlazasPI) textoAcceso.push(`${datos.numPlazasPI} promoción interna`);
      if (textoAcceso.length > 0) {
        partes.push(`Acceso: ${textoAcceso.join(', ')}`);
      } else {
        partes.push('Acceso libre y promoción interna');
      }
    } else if (datos.acceso === 'libre') {
      partes.push('Turno libre');
    } else if (datos.acceso === 'promocion_interna') {
      partes.push('Promoción interna');
    } else if (datos.acceso === 'discapacidad') {
      partes.push('Reserva discapacidad');
    }
  }

  // Ubicación
  if (datos.municipio) {
    partes.push(datos.municipio);
  } else if (datos.comunidadAutonoma) {
    partes.push(datos.comunidadAutonoma);
  } else if (datos.departamento) {
    // Limpiar nombre de departamento
    const deptoLimpio = datos.departamento
      .replace('MINISTERIO DE ', '')
      .replace('MINISTERIO PARA ', '')
      .replace('ADMINISTRACIÓN LOCAL', 'Administración Local');
    partes.push(deptoLimpio);
  }

  // Plazo
  if (datos.plazoInscripcion) {
    partes.push(`Plazo: ${datos.plazoInscripcion} días hábiles`);
  }

  // Titulación
  if (datos.titulacion) {
    partes.push(`Requisito: ${datos.titulacion}`);
  }

  return partes.join('. ') + '.';
}

// ============================================
// EXTRACCIÓN COMPLETA DESDE CONTENIDO
// ============================================

export interface DatosCompletosExtraidos {
  plazas: PlazasExtraidas;
  categoria: Categoria | null;
  acceso: TipoAcceso | null;
  plazoInscripcionDias: number | null;
  titulacionRequerida: string | null;
  tieneTemario: boolean;
  fechaExamen: string | null;
  resumen: string | null;
}

/**
 * Extrae todos los datos posibles del contenido_texto
 * Esta función combina todas las extracciones en una sola llamada
 */
export function extraerDatosCompletos(
  contenido: string,
  titulo: string,
  departamento: string,
  datosGeo: DatosGeograficos
): DatosCompletosExtraidos {
  // Extraer plazas (primero del contenido, fallback al título)
  let plazas = extraerPlazasDeContenido(contenido);
  if (!plazas.total) {
    plazas = extraerPlazas(titulo);
  }

  // Extraer categoría (primero del contenido, fallback al título)
  let categoria = detectarCategoriaDeContenido(contenido);
  if (!categoria) {
    categoria = detectarCategoria(titulo, '');
  }

  // Extraer acceso (primero del contenido, fallback al título)
  let acceso = detectarAccesoDeContenido(contenido);
  if (!acceso) {
    acceso = detectarAcceso(titulo);
  }

  // Extraer datos del texto
  const datosTexto = extraerDatosDelTexto(contenido);

  // Generar resumen
  const tipo = detectarTipo(titulo);
  const resumen = generarResumen({
    tipo,
    categoria,
    numPlazas: plazas.total,
    numPlazasLibre: plazas.libre,
    numPlazasPI: plazas.pi,
    acceso,
    departamento,
    comunidadAutonoma: datosGeo.comunidadAutonoma,
    municipio: datosGeo.municipio,
    plazoInscripcion: datosTexto.plazoInscripcionDias,
    titulacion: datosTexto.titulacionRequerida
  });

  return {
    plazas,
    categoria,
    acceso,
    plazoInscripcionDias: datosTexto.plazoInscripcionDias,
    titulacionRequerida: datosTexto.titulacionRequerida,
    tieneTemario: datosTexto.tieneTemario,
    fechaExamen: datosTexto.fechaExamenMencionada,
    resumen
  };
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
 * → "Se convoca el proceso selectivo..."
 */
export function limpiarTitulo(titulo: string): string {
  // Buscar "por la que se" y tomar desde ahí
  const porLaQueMatch = titulo.match(/por\s+la\s+que\s+se\s+(.+)/i);
  if (porLaQueMatch) {
    let limpio = 'Se ' + porLaQueMatch[1].trim();
    // Capitalizar primera letra
    limpio = limpio.charAt(0).toUpperCase() + limpio.slice(1);
    return limpio;
  }

  // Si no hay "por la que se", intentar otros patrones
  // "que tiene por objeto..." → "Tiene por objeto..."
  const quetieneMatch = titulo.match(/que\s+tiene\s+por\s+objeto\s+(.+)/i);
  if (quetieneMatch) {
    return 'Tiene por objeto ' + quetieneMatch[1].trim();
  }

  // Si no se puede limpiar, devolver original
  return titulo;
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

// ============================================
// CÁLCULO DE FECHAS LÍMITE
// ============================================

/**
 * Festivos nacionales de España (fechas fijas)
 * El plazo del BOE empieza a contar desde el día siguiente a la publicación
 */
const FESTIVOS_NACIONALES = [
  '01-01', // Año Nuevo
  '01-06', // Epifanía
  '05-01', // Día del Trabajador
  '08-15', // Asunción
  '10-12', // Fiesta Nacional
  '11-01', // Todos los Santos
  '12-06', // Constitución
  '12-08', // Inmaculada
  '12-25', // Navidad
];

/**
 * Verifica si una fecha es día hábil (no fin de semana ni festivo nacional)
 */
export function esDiaHabil(fecha: Date): boolean {
  const diaSemana = fecha.getDay();
  // 0 = domingo, 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }

  // Verificar festivos nacionales
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const fechaStr = `${mes}-${dia}`;

  return !FESTIVOS_NACIONALES.includes(fechaStr);
}

/**
 * Añade días hábiles a una fecha
 * @param fechaInicio Fecha de inicio (fecha de publicación BOE)
 * @param diasHabiles Número de días hábiles a añadir
 * @returns Fecha límite
 */
export function addDiasHabiles(fechaInicio: Date, diasHabiles: number): Date {
  const resultado = new Date(fechaInicio);
  let diasContados = 0;

  // El plazo empieza a contar desde el día siguiente
  resultado.setDate(resultado.getDate() + 1);

  while (diasContados < diasHabiles) {
    if (esDiaHabil(resultado)) {
      diasContados++;
    }
    if (diasContados < diasHabiles) {
      resultado.setDate(resultado.getDate() + 1);
    }
  }

  return resultado;
}

/**
 * Calcula la fecha límite de inscripción
 * @param boeFecha Fecha de publicación en BOE (YYYY-MM-DD)
 * @param plazoDiasHabiles Plazo en días hábiles
 * @returns Fecha límite en formato YYYY-MM-DD o null si no se puede calcular
 */
export function calcularFechaLimiteInscripcion(
  boeFecha: string,
  plazoDiasHabiles: number | null
): string | null {
  if (!plazoDiasHabiles || plazoDiasHabiles <= 0) {
    return null;
  }

  try {
    const fechaInicio = new Date(boeFecha);
    if (isNaN(fechaInicio.getTime())) {
      return null;
    }

    const fechaLimite = addDiasHabiles(fechaInicio, plazoDiasHabiles);

    // Formatear como YYYY-MM-DD
    const year = fechaLimite.getFullYear();
    const month = String(fechaLimite.getMonth() + 1).padStart(2, '0');
    const day = String(fechaLimite.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Verifica si la inscripción sigue abierta
 * @param boeFecha Fecha de publicación
 * @param plazoDiasHabiles Plazo en días hábiles
 * @returns true si la inscripción sigue abierta, false si ha cerrado, null si no se puede determinar
 */
export function inscripcionAbierta(
  boeFecha: string,
  plazoDiasHabiles: number | null
): boolean | null {
  const fechaLimite = calcularFechaLimiteInscripcion(boeFecha, plazoDiasHabiles);
  if (!fechaLimite) {
    return null; // No se puede determinar
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(fechaLimite);
  limite.setHours(23, 59, 59, 999);

  return hoy <= limite;
}
