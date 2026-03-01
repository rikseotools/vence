// lib/lawMappingUtils.ts - MAPEOS CENTRALIZADOS PARA TODAS LAS LEYES
// Tipado completo con TypeScript para mejor DX y seguridad de tipos
//
// 🔄 MIGRACIÓN A BD: Este archivo mantiene diccionarios como fallback
// mientras se migra a usar la columna `slug` de la tabla `laws`.
// Ver lib/api/laws/ para la versión basada en BD.

// ============================================
// TIPOS
// ============================================

/** Mapeo de slug a short_name de la BD */
type SlugToShortNameMapping = Record<string, string>

/** Mapeo de short_name a slug */
type ShortNameToSlugMapping = Record<string, string>

/** Variantes de nombres de leyes */
type LawVariantsMapping = Record<string, string[]>

/** Información de una ley */
export interface LawInfo {
  name: string
  description: string
}

/** Mapeo de short_name a información de la ley */
type LawInfoMapping = Record<string, LawInfo>

/** Patrón para generación dinámica de short_name */
interface SlugPattern {
  regex: RegExp
  transform: (match: RegExpMatchArray) => string
}

// ============================================
// CACHE DE BD (opcional - se puede poblar desde servidor)
// ============================================

/** Cache síncrono de mapeos desde BD - se puebla con setDbCache() */
let dbSlugToShortName: Map<string, string> | null = null
let dbShortNameToSlug: Map<string, string> | null = null

/**
 * Establece el cache de BD desde código servidor
 * Llamar desde Server Components después de cargar de lib/api/laws
 *
 * @example
 * // En un Server Component o API route:
 * import { getShortNameBySlug } from '@/lib/api/laws'
 * // ... cargar cache y pasarlo aquí
 */
export function setDbCache(
  slugToShortName: Map<string, string>,
  shortNameToSlug: Map<string, string>
): void {
  dbSlugToShortName = slugToShortName
  dbShortNameToSlug = shortNameToSlug
  console.log(`✅ [lawMappingUtils] Cache BD establecido: ${slugToShortName.size} leyes`)
}

/**
 * Invalida el cache de BD (llamar después de actualizar leyes)
 */
export function invalidateDbCache(): void {
  dbSlugToShortName = null
  dbShortNameToSlug = null
  console.log('🗑️ [lawMappingUtils] Cache BD invalidado')
}

/**
 * Verifica si el cache de BD está disponible
 */
export function isDbCacheLoaded(): boolean {
  return dbSlugToShortName !== null && dbShortNameToSlug !== null
}

// ============================================
// MAPEOS DE NORMALIZACIÓN
// ============================================

const NORMALIZATION_MAP: SlugToShortNameMapping = {
  'RCD': 'Reglamento del Congreso',
  'RS': 'Reglamento del Senado',
  'Reglamento Congreso': 'Reglamento del Congreso',
}

const VARIANTS_MAP: LawVariantsMapping = {
  'RCD': ['RCD', 'Reglamento del Congreso', 'Reglamento Congreso'],
  'Reglamento del Congreso': ['RCD', 'Reglamento del Congreso', 'Reglamento Congreso'],
  'RS': ['RS', 'Reglamento del Senado'],
  'Reglamento del Senado': ['RS', 'Reglamento del Senado'],
}

// ============================================
// MAPEO SLUG → SHORT_NAME (para URLs)
// ============================================

const SLUG_TO_SHORT_NAME: SlugToShortNameMapping = {
  // Leyes principales
  'ley-19-2013': 'Ley 19/2013',
  'ley-40-2015': 'Ley 40/2015',
  'lrjsp': 'Ley 40/2015',
  'ley-39-2015': 'Ley 39/2015',
  'lpac': 'Ley 39/2015',
  'lajg': 'LAJG',
  'ley-1-1996-asistencia-juridica-gratuita': 'LAJG',
  'ley-50-1997': 'Ley 50/1997',
  'ley-7-1985': 'Ley 7/1985',
  'ley-2-2014': 'Ley 2/2014',
  'ley-25-2014': 'Ley 25/2014',
  'ley-38-2015': 'Ley 38/2015',

  // Constitución y tratados
  'ce': 'CE',
  'CE': 'CE',
  'constitucion-espanola': 'CE',
  'constitución-española': 'CE',
  'constitución-espanola': 'CE',
  'constituci-n-espa-ola': 'CE',  // Encoding roto (backward compat)
  'tue': 'TUE',
  'tfue': 'TFUE',

  // Códigos
  'codigo-civil': 'Código Civil',
  'código-civil': 'Código Civil',
  'c-digo-civil': 'Código Civil',  // Encoding roto (backward compat)
  'codigo-penal': 'Código Penal',
  'código-penal': 'Código Penal',
  'c-digo-penal': 'Código Penal',  // Encoding roto (backward compat)

  // Laborales
  'estatuto-trabajadores': 'Estatuto de los Trabajadores',
  'estatuto-de-los-trabajadores': 'Estatuto de los Trabajadores',

  // Real Decretos específicos
  'rd-364-1995': 'RD 364/1995',
  'rd-365-1995': 'RD 365/1995',
  'rd-366-2007': 'RD 366/2007',
  'rd-375-2003': 'RD 375/2003',
  'rd-462-2002': 'RD 462/2002',
  'rd-829-2023': 'RD 829/2023',
  'rd-861-1986': 'RD 861/1986',
  'rd-951-2005': 'RD 951/2005',
  'rd-208-1996': 'RD 208/1996',
  'rd-210-2024': 'RD 210/2024',
  'rd-2271-2004': 'RD 2271/2004',
  'rdl-5-2015': 'RDL 5/2015',
  'trebep': 'RDL 5/2015',

  // Leyes adicionales
  'ley-10-2010': 'Ley 10/2010',
  'ley-39-2006': 'Ley 39/2006',
  'dependencia': 'Ley 39/2006',

  // Gobierno Abierto y Agenda 2030
  'gobierno-abierto': 'Gobierno Abierto',
  'agenda-2030': 'Agenda 2030',
  'orden-hfp-134-2018': 'Orden HFP/134/2018',
  'orden-apu-1461-2002': 'Orden APU/1461/2002',
  'orden-pcm-7-2021': 'Orden PCM/7/2021',
  'orden-pcm-1382-2021': 'Orden PCM/1382/2021',
  'orden-dsa-819-2020': 'Orden DSA/819/2020',
  'orden-hfp-266-2023': 'Orden HFP/266/2023',
  'orden-pre-1576-2002': 'Orden PRE/1576/2002',
  'orden-hap-1949-2014': 'Orden HAP/1949/2014',
  'iv-convenio-age': 'IV Convenio AGE',
  'iv-plan-gobierno-abierto': 'IV Plan de Gobierno Abierto',
  'iii-plan-gobierno-abierto': 'III Plan Gobierno Abierto',
  'i-plan-gobierno-abierto': 'I Plan Gobierno Abierto',
  'plan-transparencia-judicial': 'Plan Transparencia Judicial',
  'v-plan-gobierno-abierto': 'V Plan Gobierno Abierto 2025-2029',
  'v-plan-gobierno-abierto-2025-2029': 'V Plan Gobierno Abierto 2025-2029',
  'ley-4-2023': 'Ley 4/2023',
  'ley-47-2003': 'Ley 47/2003',
  'lo-2-2012': 'LO 2/2012',
  'lo-2-1980': 'LO 2/1980',

  // Leyes Orgánicas
  'lo-2-1979': 'LOTC',
  'lotc': 'LOTC',
  'ley-organica-tribunal-constitucional': 'LOTC',
  'lo-6-1984': 'LO 6/1984',
  'habeas-corpus': 'LO 6/1984',
  'lo-6-1985': 'LO 6/1985',
  'lopj': 'LO 6/1985',
  'ley-organica-poder-judicial': 'LO 6/1985',
  'poder-judicial': 'LO 6/1985',
  'lo-2-1986': 'LOFCS',
  'lofcs': 'LOFCS',
  'lo-3-2018': 'LO 3/2018',
  'lopd': 'LO 3/2018',
  'lopdgdd': 'LO 3/2018',
  'ley-proteccion-datos': 'LO 3/2018',
  'lo-3-2020': 'LOMLOE',
  'lomloe': 'LOMLOE',
  'lo-1-1979': 'LOGP',
  'logp': 'LOGP',
  'lo-5-1985': 'LO 5/1985',
  'loreg': 'LO 5/1985',
  'lo-5-1995': 'LO 5/1995',
  'tribunal-jurado': 'LO 5/1995',
  'lo-4-2000': 'LO 4/2000',
  'loex': 'LO 4/2000',
  'lo-10-1995': 'CP',
  'cp': 'CP',
  'lo-3-1981': 'LO 3/1981',
  'defensor-pueblo': 'LO 3/1981',

  // RGPD
  'reglamento-ue-2016-679': 'Reglamento UE 2016/679',
  'rgpd': 'Reglamento UE 2016/679',

  // Otras leyes
  'ley-50-1981': 'Ley 50/1981',
  'ministerio-fiscal': 'Ley 50/1981',
  'estatuto-ministerio-fiscal': 'Ley 50/1981',
  'eomf': 'Ley 50/1981',
  'ley-5-2014': 'LSP',
  'lsp': 'LSP',
  'seguridad-privada': 'LSP',
  'ebep': 'RDL 5/2015',
  'ley-9-2017': 'Ley 9/2017',
  'lcsp': 'Ley 9/2017',
  'codigo-comercio': 'CCom',
  'ccom': 'CCom',

  // Protocolos y reglamentos europeos
  'protocolo-1': 'Protocolo nº 1',
  'protocolo-2': 'Protocolo nº 2',
  'estatuto-tjue': 'Estatuto TJUE',
  'protocolo-sedes-ue': 'Protocolo Sedes UE',

  // Reglamentos internos instituciones UE
  'ri-consejo': 'RI Consejo',
  'ri-comision': 'RI Comisión',
  'ri-comisi-n': 'RI Comisión',  // Encoding roto (backward compat)
  'rp-tjue': 'RP TJUE',
  'reglamento-ce-1049-2001': 'Reglamento (CE) nº 1049/2001',
  'reglamento-ue-2018-1046': 'Reglamento (UE, Euratom) 2018/1046',

  // Reglamentos parlamentarios
  'rcd': 'Reglamento del Congreso',
  'RCD': 'Reglamento del Congreso',
  'rs': 'Reglamento del Senado',
  'RS': 'Reglamento del Senado',
  'reglamento-congreso': 'Reglamento del Congreso',
  'reglamento-senado': 'Reglamento del Senado',

  // Alias
  'transparencia': 'Ley 19/2013',
  'transparencia-buen-gobierno': 'Ley 19/2013',
  'procedimiento-administrativo': 'Ley 39/2015',
  'regimen-juridico': 'Ley 40/2015',
  'regimen-local': 'Ley 7/1985',
  'LSP': 'LSP',

  // Alias desde /leyes-de-oposiciones
  'ley-poder-judicial': 'LO 6/1985',
  'ley-fuerzas-cuerpos-seguridad': 'LOFCS',
  'ley-enjuiciamiento-criminal': 'LECrim',
  'proteccion-seguridad-ciudadana': 'LO 4/2015',
  'trafico-seguridad-vial': 'Ley Tráfico',
  'ley-organica-1-2004': 'LO 1/2004',
  'ley-organica-3-2007': 'LO 3/2007',
  'ley-organica-3-2018': 'LO 3/2018',
  'igualdad-trans-lgtbi': 'Ley 4/2023',
  'proteccion-civil': 'LSNPC',

  // C1 Administrativo Estado - Leyes Orgánicas
  'lo-3-1980': 'LO 3/1980',
  'consejo-de-estado': 'LO 3/1980',
  'lo-11-1985': 'LO 11/1985',
  'lols': 'LO 11/1985',
  'libertad-sindical': 'LO 11/1985',
  'lo-6-2002': 'LO 6/2002',
  'partidos-politicos': 'LO 6/2002',
  'lo-8-1980': 'LO 8/1980',
  'lofca': 'LO 8/1980',

  // C1 - Leyes ordinarias
  'ley-7-1988': 'Ley 7/1988',
  'funcionamiento-tribunal-cuentas': 'Ley 7/1988',
  'ley-1-2000': 'Ley 1/2000',
  'lec': 'Ley 1/2000',
  'enjuiciamiento-civil': 'Ley 1/2000',
  'ley-17-2009': 'Ley 17/2009',
  'ley-33-2003': 'Ley 33/2003',
  'lpap': 'Ley 33/2003',
  'patrimonio-aapp': 'Ley 33/2003',
  'ley-34-2002': 'Ley 34/2002',
  'lssi': 'Ley 34/2002',
  'ley-11-2007': 'Ley 11/2007',
  'lae': 'Ley 11/2007',
  'ley-6-1997': 'Ley 6/1997',
  'lofage': 'Ley 6/1997',

  // C1 - Reales Decretos
  'rd-887-2006': 'RD 887/2006',
  'reglamento-subvenciones': 'RD 887/2006',
  'rd-429-1993': 'RD 429/1993',
  'rd-1398-1993': 'RD 1398/1993',
  'rd-1671-2009': 'RD 1671/2009',
  'rd-4-2010': 'RD 4/2010',
  'eni': 'RD 4/2010',
  'rd-3-2010': 'RD 3/2010',
  'ens': 'RD 3/2010',

  // C1 - RDL
  'rdl-2-2004': 'RDL 2/2004',
  'trlrhl': 'RDL 2/2004',
  'haciendas-locales': 'RDL 2/2004',
  'rdl-1-2020': 'RDL 1/2020',
  'ley-concursal': 'RDL 1/2020',
  'rdl-3-2011': 'RDL 3/2011',
  'trlcsp': 'RDL 3/2011',
  'rdl-1-2000': 'RDL 1/2000',
  'rdl-3-2000': 'RDL 3/2000',
  'rdl-6-2019': 'RDL 6/2019',
  'rdl-13-2010': 'RDL 13/2010',

  // Más leyes C1
  'ley-30-1992': 'Ley 30/1992',
  'lrjpac': 'Ley 30/1992',
  'lap': 'LAP',
  'lo-4-2015': 'LO 4/2015',
  'seguridad-ciudadana': 'LO 4/2015',
  'ley-7-2007': 'Ley 7/2007',
  'ebep-original': 'Ley 7/2007',
  'ley-39-1988': 'Ley 39/1988',
  'ley-22-2003': 'Ley 22/2003',
  'ley-29-2011': 'Ley 29/2011',
  'ley-70-1978': 'Ley 70/1978',
  'ley-15-2015': 'Ley 15/2015',
  'jurisdiccion-contencioso-administrativa': 'Ley 29/1998',
  'jurisdiccion-voluntaria': 'Ley 15/2015',
  'extranjeria': 'LO 4/2000',
  'ley-37-2007': 'Ley 37/2007',
  'risp': 'Ley 37/2007',
  'ley-38-1988': 'Ley 38/1988',
  'lo-2-2006': 'LO 2/2006',
  'loe': 'LO 2/2006',
  'lo-9-1983': 'LO 9/1983',
  'derecho-reunion': 'LO 9/1983',
  'lo-5-1992': 'LO 5/1992',
  'lortad': 'LO 5/1992',
  'ley-51-2003': 'Ley 51/2003',
  'liondau': 'Ley 51/2003',
  'ley-8-1994': 'Ley 8/1994',
  'ces': 'Ley 8/1994',
  'lo-11-1995': 'LO 11/1995',
  'ley-6-2023': 'Ley 6/2023',
  'ley-3-2015': 'Ley 3/2015',
  'alto-cargo': 'Ley 3/2015',
  'lo-1-2025': 'LO 1/2025',
  'eficiencia-justicia': 'LO 1/2025',
  'ley-13-2010': 'Ley 13/2010',

  // RD adicionales
  'rd-725-1989': 'RD 725/1989',
  'rd-221-1987': 'RD 221/1987',
  'rd-349-2001': 'RD 349/2001',
  'rd-1084-1990': 'RD 1084/1990',
  'rd-456-1986': 'RD 456/1986',
  'rd-1410-1995': 'RD 1410/1995',
  'rd-776-2011': 'RD 776/2011',
  'rd-640-1987': 'RD 640/1987',
  'rd-127-2015': 'RD 127/2015',
  'rd-118-2001': 'RD 118/2001',
  'rd-2225-1993': 'RD 2225/1993',
  'rd-577-1997': 'RD 577/1997',
  'rd-1567-1985': 'RD 1567/1985',
  'rd-1230-2023': 'RD 1230/2023',
  'rd-1009-2023': 'RD 1009/2023',
  'rd-209-2024': 'RD 209/2024',
  'rd-501-2024': 'RD 501/2024',
  'rd-246-2024': 'RD 246/2024',
  'rd-1118-2024': 'RD 1118/2024',
  'rd-1184-2024': 'RD 1184/2024',
  'rd-2169-1984': 'RD 2169/1984',
  'rd-2720-1998': 'RD 2720/1998',
  'contratos-duracion-determinada': 'RD 2720/1998',

  // RDL adicionales
  'ss-fuerzas-armadas': 'RDL 1/2000',
  'ss-administracion-justicia': 'RDL 3/2000',

  // Leyes antiguas
  'ley-10-1965': 'Ley 10/1965',

  // Temas técnicos/informática
  'procesadores-de-texto': 'Procesadores de texto',
  'procesadores-texto': 'Procesadores de texto',
  'informatica-basica': 'Informática Básica',
  'informática-básica': 'Informática Básica',
  'explorador-de-windows': 'Explorador de Windows',
  'windows-10': 'Windows 10',
  'portal-de-internet': 'Portal de Internet',
  'hojas-de-calculo-excel': 'Hojas de cálculo. Excel',
  'hojas-de-calculo': 'Hojas de cálculo. Excel',
  'excel': 'Hojas de cálculo. Excel',
  'la-red-internet': 'La Red Internet',
  'red-internet': 'La Red Internet',
  'internet': 'La Red Internet',
  'base-de-datos-access': 'Base de datos: Access',
  'bases-de-datos-access': 'Base de datos: Access',
  'correo-electronico': 'Correo electrónico',
  'correo-electrónico': 'Correo electrónico',

  // Mapeos directos para notificaciones
  'I Plan Gobierno Abierto': 'I Plan Gobierno Abierto',
  'Ley 50/1997': 'Ley 50/1997',
  'Ley 19/2013': 'Ley 19/2013',
  'Agenda 2030': 'Agenda 2030',

  // Abreviaturas UPPERCASE (minúsculas y mayúsculas)
  'lccsns': 'LCCSNS',
  'LCCSNS': 'LCCSNS',
  'lea': 'LEA',
  'LEA': 'LEA',
  'lgs': 'LGS',
  'LGS': 'LGS',
  'lgt': 'LGT',
  'LGT': 'LGT',
  'lh': 'LH',
  'LH': 'LH',
  'lirpf': 'LIRPF',
  'LIRPF': 'LIRPF',
  'lis': 'LIS',
  'LIS': 'LIS',
  'lisos': 'LISOS',
  'LISOS': 'LISOS',
  'liva': 'LIVA',
  'LIVA': 'LIVA',
  'lm': 'LM',
  'LM': 'LM',
  'ln': 'LN',
  'LN': 'LN',
  'lops': 'LOPS',
  'LOPS': 'LOPS',
  'lp': 'LP',
  'LP': 'LP',
  'lpi': 'LPI',
  'LPI': 'LPI',
  'lprl': 'LPRL',
  'LPRL': 'LPRL',
  'lrc': 'LRC',
  'LRC': 'LRC',
  'lrjs': 'LRJS',
  'LRJS': 'LRJS',
  'lrsal': 'LRSAL',
  'LRSAL': 'LRSAL',
  'lrsc': 'LRSC',
  'LRSC': 'LRSC',
  'lsc': 'LSC',
  'LSC': 'LSC',
  'lsnpc': 'LSNPC',
  'LSNPC': 'LSNPC',
  'lsp2010': 'LSP2010',
  'LSP2010': 'LSP2010',
  'odm': 'ODM',
  'ODM': 'ODM',
  'rdaj': 'RDAJ',
  'RDAJ': 'RDAJ',
  'rdtp': 'RDTP',
  'RDTP': 'RDTP',
  'rex': 'REx',
  'REx': 'REx',
  'REX': 'REx',
  'rgc': 'RGC',
  'RGC': 'RGC',
  'rggit': 'RGGIT',
  'RGGIT': 'RGGIT',
  'rh': 'RH',
  'RH': 'RH',
  'rn': 'RN',
  'RN': 'RN',
  'rp': 'RP',
  'RP': 'RP',
  'rsp': 'RSP',
  'RSP': 'RSP',
  'trlgdcu': 'TRLGDCU',
  'TRLGDCU': 'TRLGDCU',
  'trls': 'TRLS',
  'TRLS': 'TRLS',
  'trrl': 'TRRL',
  'TRRL': 'TRRL',

  // Caracteres especiales
  'administracion-electronica-csl': 'Administración electrónica y servicios al ciudadano (CSL)',
  'administracion-electronica-y-servicios-al-ciudadano-csl': 'Administración electrónica y servicios al ciudadano (CSL)',
  'administraci-n-electr-nica-y-servicios-al-ciudadano-csl': 'Administración electrónica y servicios al ciudadano (CSL)',
  'correo-electr-nico': 'Correo electrónico',
  'ebep-andalucia': 'EBEP-Andalucía',
  'ebep-andaluc-a': 'EBEP-Andalucía',

  // Leyes añadidas desde BD (2026-02-15)
  'access': 'Base de datos: Access',
  'ley-funcion-publica-andalucia-ley-5-2023': 'Ley Función Pública Andalucía (Ley 5/2023)',
  'ley-funci-n-p-blica-andaluc-a-ley-5-2023': 'Ley Función Pública Andalucía (Ley 5/2023)',  // Encoding roto (backward compat)
  'rd-796-2005': 'RD 796/2005',
  'carta-derechos-ciudadanos-justicia': 'Carta Derechos Ciudadanos Justicia',
  'reglamento-ingreso-justicia-rd-1451-2005': 'Reglamento Ingreso Justicia (RD 1451/2005)',
  'reglamento-servicios-postales-rd-1829-1999': 'Reglamento Servicios Postales (RD 1829/1999)',
  'reglamento-secretarios-judiciales-rd-1608-2005': 'Reglamento Secretarios Judiciales (RD 1608/2005)',
  'instruccion-2-2003-cgpj': 'Instrucción 2/2003 CGPJ',
  'instrucci-n-2-2003-cgpj': 'Instrucción 2/2003 CGPJ',  // Encoding roto (backward compat)
  'reglamento-3-1995': 'Reglamento 3/1995',
  'reglamento-3-1995-jueces-paz': 'Reglamento 3/1995',

  'inform-tica-b-sica': 'Informática Básica',
  'hojas-de-c-lculo-excel': 'Hojas de cálculo. Excel',
  'ley-tr-fico': 'Ley Tráfico',
  'ley-trafico': 'Ley Tráfico',

  // Planes de Gobierno
  'ii-plan-gobierno-abierto': 'II Plan Gobierno Abierto',

  // Estrategias y Agendas
  'eds-2030': 'EDS 2030',
  'estrategia-2022-2030': 'Estrategia 2022-2030',

  // Reglamentos parlamentarios
  'reglamento-del-congreso': 'Reglamento del Congreso',
  'reglamento-del-senado': 'Reglamento del Senado',
  'reglamento-consejo-ue': 'Reglamento Consejo UE',
  'reglamento-consejo-europeo': 'Reglamento Consejo UE',  // Alias
  'reglamento-comision-ue': 'Reglamento Comisión UE',
  'reglamento-comisi-n-ue': 'Reglamento Comisión UE',  // Encoding roto
  'reglamento-pe-9': 'Reglamento PE 9ª',

  // Protocolos
  'protocolo-n-6': 'Protocolo nº 6',
  'protocolo-6': 'Protocolo nº 6',
  'protocolo-no-6': 'Protocolo nº 6',

  // Órdenes ministeriales (otras)
  'orden-01-02-1996': 'Orden 01/02/1996',
  'orden-30-07-1992': 'Orden 30/07/1992',

  // Resoluciones
  'resolucion-sefp-7-mayo-2024': 'Resolución SEFP 7 mayo 2024 (Intervalos niveles)',
  'resolucion-sefp-7-mayo-2024-intervalos-niveles': 'Resolución SEFP 7 mayo 2024 (Intervalos niveles)',
  'resoluci-n-sefp-7-mayo-2024-intervalos-niveles': 'Resolución SEFP 7 mayo 2024 (Intervalos niveles)',  // Encoding roto
  'res-20-01-2014-dgp': 'Res. 20/01/2014 DGP',
  'resolucion-20-01-2014-dgp': 'Res. 20/01/2014 DGP',
  'resolucion-7-05-2014-interinos-age': 'Resolución 7/05/2014 (Interinos AGE)',
  'resoluci-n-7-05-2014-interinos-age': 'Resolución 7/05/2014 (Interinos AGE)',  // Encoding roto

  // Leyes faltantes
  'ley-10-2014': 'Ley 10/2014',
  'ley-11-2015': 'Ley 11/2015',
  'ley-12-2003': 'Ley 12/2003',
  'ley-15-2022': 'Ley 15/2022',
  'ley-16-1985': 'Ley 16/1985',
  'ley-2-2015': 'Ley 2/2015',
  'ley-29-1998': 'Ley 29/1998',
  'ley-30-1984': 'Ley 30/1984',
  'ley-31-1990': 'Ley 31/1990',
  'ley-31-2022': 'Ley 31/2022',
  'ley-38-2003': 'Ley 38/2003',
  'ley-44-2015': 'Ley 44/2015',
  'ley-53-1984': 'Ley 53/1984',
  'ley-8-2021': 'Ley 8/2021',

  // LO faltantes
  'lo-1-2004': 'LO 1/2004',
  'lo-2-1982': 'LO 2/1982',
  'lo-3-1984': 'LO 3/1984',
  'lo-3-2007': 'LO 3/2007',
  'lo-4-1981': 'LO 4/1981',
  'lo-4-2001': 'LO 4/2001',

  // RD faltantes
  'rd-14-sep-1882': 'LECrim',
  'rd-1405-1986': 'RD 1405/1986',
  'rd-1708-2011': 'RD 1708/2011',
  'rd-1720-2007': 'RD 1720/2007',
  'rd-203-2021': 'RD 203/2021',
  'rd-2073-1999': 'RD 2073/1999',
  'rd-33-1986': 'RD 33/1986',
  'rd-830-2023': 'RD 830/2023',

  // RDL faltantes
  'rdl-1-2013': 'RDL 1/2013',
  'rdl-2-2015': 'RDL 2/2015',
  'rdl-4-2000': 'RDL 4/2000',
  'rdl-6-2023': 'RDL 6/2023',
  'rdl-670-1987': 'RDL 670/1987',
  'rdl-8-2015': 'RDL 8/2015',

  // Otros
  'explorador-windows-11': 'Explorador Windows 11',
  'windows-11': 'Windows 11',
}

// ============================================
// MAPEO SHORT_NAME → SLUG (inverso, para generar URLs)
// ============================================

const SHORT_NAME_TO_SLUG: ShortNameToSlugMapping = {
  // Principales
  'Gobierno Abierto': 'gobierno-abierto',
  'Agenda 2030': 'agenda-2030',
  'Orden HFP/134/2018': 'orden-hfp-134-2018',
  'Orden APU/1461/2002': 'orden-apu-1461-2002',
  'Orden PCM/7/2021': 'orden-pcm-7-2021',
  'Orden PCM/1382/2021': 'orden-pcm-1382-2021',
  'Orden DSA/819/2020': 'orden-dsa-819-2020',
  'Orden HFP/266/2023': 'orden-hfp-266-2023',
  'Orden PRE/1576/2002': 'orden-pre-1576-2002',
  'Orden HAP/1949/2014': 'orden-hap-1949-2014',
  'Ley 4/2023': 'ley-4-2023',
  'Protocolo nº 1': 'protocolo-1',
  'Protocolo nº 2': 'protocolo-2',
  'Reglamento (CE) nº 1049/2001': 'reglamento-ce-1049-2001',
  'Reglamento (UE, Euratom) 2018/1046': 'reglamento-ue-2018-1046',
  'LPAC': 'ley-39-2015',
  'LRJSP': 'ley-40-2015',
  'Ley 39/2015': 'ley-39-2015',
  'CE': 'constitucion-espanola',
  'TUE': 'tue',
  'TFUE': 'tfue',
  'Código Civil': 'codigo-civil',
  'Código Penal': 'codigo-penal',
  'Estatuto de los Trabajadores': 'estatuto-trabajadores',

  // Real Decretos
  'RD 364/1995': 'rd-364-1995',
  'RD 365/1995': 'rd-365-1995',
  'RD 366/2007': 'rd-366-2007',
  'RD 375/2003': 'rd-375-2003',
  'RD 462/2002': 'rd-462-2002',
  'RD 829/2023': 'rd-829-2023',
  'RD 861/1986': 'rd-861-1986',
  'RD 951/2005': 'rd-951-2005',
  'RD 208/1996': 'rd-208-1996',
  'RD 210/2024': 'rd-210-2024',
  'RD 2271/2004': 'rd-2271-2004',
  'Ley 10/2010': 'ley-10-2010',
  'Ley 39/2006': 'ley-39-2006',

  // Abreviaturas → número oficial (SEO)
  'LOTC': 'lo-2-1979',
  'LOPJ': 'lo-6-1985',
  'LOFCS': 'lo-2-1986',
  'LOPD': 'lo-3-2018',
  'LOMLOE': 'lo-3-2020',
  'LOGP': 'lo-1-1979',
  'LOREG': 'lo-5-1985',
  'LOEx': 'lo-4-2000',
  'LOPDGDD': 'lo-3-2018',
  'TREBEP': 'rdl-5-2015',
  'EBEP': 'rdl-5-2015',
  'LSP': 'ley-5-2014',
  'CP': 'lo-10-1995',
  'LAP': 'lap',
  'Ley 30/1992': 'ley-30-1992',
  'LECrim': 'rd-14-sep-1882',
  'LEC': 'ley-1-2000',
  'LCSP': 'ley-9-2017',
  'TRLGSS': 'rdl-8-2015',
  'CCom': 'codigo-comercio',

  // LO formato oficial
  'LO 6/1984': 'lo-6-1984',
  'LO 6/1985': 'lo-6-1985',
  'LO 3/1981': 'lo-3-1981',
  'LO 2/1979': 'lo-2-1979',
  'LO 2/1986': 'lo-2-1986',
  'LO 1/1979': 'lo-1-1979',
  'LO 3/2018': 'lo-3-2018',
  'LO 3/2020': 'lo-3-2020',
  'LO 5/1985': 'lo-5-1985',
  'LO 5/1995': 'lo-5-1995',
  'LO 4/2000': 'lo-4-2000',
  'LO 10/1995': 'lo-10-1995',
  'LO 3/2007': 'lo-3-2007',
  'Ley 50/1981': 'ley-50-1981',

  // Otras leyes específicas
  'I Plan Gobierno Abierto': 'i-plan-gobierno-abierto',
  'IV Convenio AGE': 'iv-convenio-age',
  'IV Plan de Gobierno Abierto': 'iv-plan-gobierno-abierto',
  'III Plan de Gobierno Abierto': 'iii-plan-gobierno-abierto',
  'Plan Transparencia Judicial': 'plan-transparencia-judicial',
  'Ley 47/2003': 'ley-47-2003',
  'Reglamento UE 2016/679': 'reglamento-ue-2016-679',

  // C1 Administrativo Estado
  'LO 3/1980': 'lo-3-1980',
  'LO 11/1985': 'lo-11-1985',
  'LO 6/2002': 'lo-6-2002',
  'LO 8/1980': 'lo-8-1980',
  'Ley 7/1988': 'ley-7-1988',
  'Ley 1/2000': 'ley-1-2000',
  'Ley 17/2009': 'ley-17-2009',
  'Ley 33/2003': 'ley-33-2003',
  'Ley 34/2002': 'ley-34-2002',
  'Ley 11/2007': 'ley-11-2007',
  'Ley 6/1997': 'ley-6-1997',
  'RD 887/2006': 'rd-887-2006',
  'RD 429/1993': 'rd-429-1993',
  'RD 1398/1993': 'rd-1398-1993',
  'RD 1671/2009': 'rd-1671-2009',
  'RD 4/2010': 'rd-4-2010',
  'RD 3/2010': 'rd-3-2010',
  'RDL 2/2004': 'rdl-2-2004',
  'RDL 1/2020': 'rdl-1-2020',

  // Abreviaturas UPPERCASE → slug lowercase
  'LCCSNS': 'lccsns',
  'LEA': 'lea',
  'LGS': 'lgs',
  'LGT': 'lgt',
  'LH': 'lh',
  'LIRPF': 'lirpf',
  'LIS': 'lis',
  'LISOS': 'lisos',
  'LIVA': 'liva',
  'LM': 'lm',
  'LN': 'ln',
  'LOPS': 'lops',
  'LP': 'lp',
  'LPI': 'lpi',
  'LPRL': 'lprl',
  'LRC': 'lrc',
  'LRJS': 'lrjs',
  'LRSAL': 'lrsal',
  'LRSC': 'lrsc',
  'LSC': 'lsc',
  'LSNPC': 'lsnpc',
  'LSP2010': 'lsp2010',
  'ODM': 'odm',
  'RDAJ': 'rdaj',
  'RDTP': 'rdtp',
  'REx': 'rex',
  'RGC': 'rgc',
  'RGGIT': 'rggit',
  'RH': 'rh',
  'RN': 'rn',
  'RP': 'rp',
  'RSP': 'rsp',
  'TRLGDCU': 'trlgdcu',
  'TRLS': 'trls',
  'TRRL': 'trrl',

  // Caracteres especiales → slug limpio
  'Administración electrónica y servicios al ciudadano (CSL)': 'administracion-electronica-csl',
  'Correo electrónico': 'correo-electronico',
  'EBEP-Andalucía': 'ebep-andalucia',
  'Informática Básica': 'informatica-basica',
  'Hojas de cálculo. Excel': 'hojas-de-calculo-excel',
  'Ley Tráfico': 'ley-trafico',

  // Planes de Gobierno
  'II Plan Gobierno Abierto': 'ii-plan-gobierno-abierto',
  'III Plan Gobierno Abierto': 'iii-plan-gobierno-abierto',
  'IV Plan Gobierno Abierto': 'iv-plan-gobierno-abierto',
  'V Plan Gobierno Abierto 2025-2029': 'v-plan-gobierno-abierto-2025-2029',

  // Estrategias y Agendas
  'EDS 2030': 'eds-2030',
  'Estrategia 2022-2030': 'estrategia-2022-2030',

  // Instrucciones CGPJ
  'Instrucción 2/2003 CGPJ': 'instruccion-2-2003-cgpj',

  // Leyes autonómicas
  'Ley Función Pública Andalucía (Ley 5/2023)': 'ley-funcion-publica-andalucia-ley-5-2023',

  // Reglamentos parlamentarios
  'Reglamento 3/1995': 'reglamento-3-1995-jueces-paz',
  'Reglamento del Congreso': 'reglamento-del-congreso',
  'Reglamento del Senado': 'reglamento-del-senado',
  'Reglamento Consejo UE': 'reglamento-consejo-ue',
  'Reglamento Comisión UE': 'reglamento-comision-ue',
  'Reglamento PE 9ª': 'reglamento-pe-9',

  // Protocolos
  'Protocolo nº 6': 'protocolo-6',
  'Estatuto TJUE': 'estatuto-tjue',
  'Protocolo Sedes UE': 'protocolo-sedes-ue',

  // Reglamentos internos instituciones UE
  'RI Consejo': 'ri-consejo',
  'RI Comisión': 'ri-comision',
  'RP TJUE': 'rp-tjue',

  // Órdenes ministeriales (otras)
  'Orden 01/02/1996': 'orden-01-02-1996',
  'Orden 30/07/1992': 'orden-30-07-1992',

  // Resoluciones
  'Resolución SEFP 7 mayo 2024 (Intervalos niveles)': 'resolucion-sefp-7-mayo-2024-intervalos-niveles',
  'Res. 20/01/2014 DGP': 'res-20-01-2014-dgp',
  'Resolución 7/05/2014 (Interinos AGE)': 'resolucion-7-05-2014-interinos-age',
  'LAJG': 'lajg',

  // Leyes faltantes
  'Ley 10/2014': 'ley-10-2014',
  'Ley 11/2015': 'ley-11-2015',
  'Ley 12/2003': 'ley-12-2003',
  'Ley 15/2022': 'ley-15-2022',
  'Ley 16/1985': 'ley-16-1985',
  'Ley 2/2015': 'ley-2-2015',
  'Ley 29/1998': 'ley-29-1998',
  'Ley 30/1984': 'ley-30-1984',
  'Ley 31/1990': 'ley-31-1990',
  'Ley 31/2022': 'ley-31-2022',
  'Ley 38/2003': 'ley-38-2003',
  'Ley 44/2015': 'ley-44-2015',
  'Ley 53/1984': 'ley-53-1984',
  'Ley 8/2021': 'ley-8-2021',

  // LO faltantes
  'LO 1/2004': 'lo-1-2004',
  'LO 2/1982': 'lo-2-1982',
  'LO 3/1984': 'lo-3-1984',
  'LO 4/1981': 'lo-4-1981',
  'LO 4/2001': 'lo-4-2001',

  // RD faltantes
  'RD 1405/1986': 'rd-1405-1986',
  'RD 1708/2011': 'rd-1708-2011',
  'RD 1720/2007': 'rd-1720-2007',
  'RD 203/2021': 'rd-203-2021',
  'RD 2073/1999': 'rd-2073-1999',
  'RD 33/1986': 'rd-33-1986',
  'RD 830/2023': 'rd-830-2023',

  // RDL faltantes
  'RDL 1/2013': 'rdl-1-2013',
  'RDL 2/2015': 'rdl-2-2015',
  'RDL 4/2000': 'rdl-4-2000',
  'RDL 6/2023': 'rdl-6-2023',
  'RDL 670/1987': 'rdl-670-1987',
  'RDL 8/2015': 'rdl-8-2015',

  // Otros
  'Explorador Windows 11': 'explorador-windows-11',
  'Windows 11': 'windows-11',
}

// ============================================
// INFORMACIÓN DE LEYES
// ============================================

const LAW_INFO: LawInfoMapping = {
  'CE': { name: 'Constitución Española', description: 'La ley fundamental del Estado' },
  'LRJSP': { name: 'Ley 40/2015 del Régimen Jurídico del Sector Público', description: 'Organización del sector público' },
  'Ley 40/2015': { name: 'Ley 40/2015 del Régimen Jurídico del Sector Público', description: 'Organización del sector público' },
  'Ley 39/2015': { name: 'Ley 39/2015 del Procedimiento Administrativo Común', description: 'Procedimiento administrativo común' },
  'Ley 19/2013': { name: 'Ley 19/2013 de Transparencia', description: 'Transparencia y buen gobierno' },
  'Código Civil': { name: 'Código Civil', description: 'Derecho privado español' },
  'Código Penal': { name: 'Código Penal', description: 'Delitos y penas' },
  'Ley 7/1985': { name: 'Ley 7/1985 Reguladora de las Bases del Régimen Local', description: 'Régimen local' },
  'Ley 50/1997': { name: 'Ley 50/1997 del Gobierno', description: 'Organización y funcionamiento del Gobierno' },
  'Estatuto de los Trabajadores': { name: 'Estatuto de los Trabajadores', description: 'Derechos laborales' },
  'TUE': { name: 'Tratado de la Unión Europea', description: 'Tratado fundacional UE' },
  'TFUE': { name: 'Tratado de Funcionamiento de la Unión Europea', description: 'Funcionamiento UE' },
  'LOTC': { name: 'Ley Orgánica del Tribunal Constitucional', description: 'Organización y funcionamiento del Tribunal Constitucional' },
  'Reglamento UE 2016/679': { name: 'Reglamento General de Protección de Datos (RGPD)', description: 'Protección de datos personales en la UE' },
  'LO 6/1985': { name: 'Ley Orgánica 6/1985 del Poder Judicial', description: 'Organización y funcionamiento de Juzgados y Tribunales' },
  'LO 3/1981': { name: 'Ley Orgánica 3/1981 del Defensor del Pueblo', description: 'Estatuto del Defensor del Pueblo' },
  'Ley 50/1981': { name: 'Ley 50/1981 del Estatuto Orgánico del Ministerio Fiscal', description: 'Estatuto del Ministerio Fiscal' },
  'RDL 5/2015': { name: 'Real Decreto Legislativo 5/2015 - TREBEP', description: 'Texto refundido del Estatuto Básico del Empleado Público' },
  'LO 3/2018': { name: 'Ley Orgánica 3/2018 de Protección de Datos', description: 'Protección de Datos Personales y garantía de los derechos digitales' },
  'Ley 9/2017': { name: 'Ley 9/2017 de Contratos del Sector Público', description: 'Contratación del sector público' },
  'LO 5/1995': { name: 'Ley Orgánica 5/1995 del Tribunal del Jurado', description: 'Regulación del Tribunal del Jurado' },
  'LO 6/1984': { name: 'Ley Orgánica 6/1984 reguladora del Habeas Corpus', description: 'Procedimiento de Habeas Corpus' },
  'V Plan Gobierno Abierto 2025-2029': { name: 'V Plan de Gobierno Abierto 2025-2029', description: 'Quinto Plan de Acción de Gobierno Abierto de España' },
  'Resolución SEFP 7 mayo 2024 (Intervalos niveles)': { name: 'Resolución SEFP 7 mayo 2024', description: 'Intervalos de niveles de puestos de trabajo' },
  'Res. 20/01/2014 DGP': { name: 'Resolución 20/01/2014 DGP', description: 'Indemnizaciones por razón del servicio' },

  // Protocolos UE
  'Estatuto TJUE': { name: 'Estatuto del Tribunal de Justicia de la Unión Europea', description: 'Protocolo nº 3 anexo al TUE y TFUE' },
  'Protocolo Sedes UE': { name: 'Protocolo sobre la fijación de las sedes', description: 'Protocolo nº 6 anexo al TUE y TFUE' },

  // Reglamentos internos UE
  'RI Consejo': { name: 'Reglamento Interno del Consejo', description: 'Funcionamiento y procedimientos del Consejo de la UE' },
  'RI Comisión': { name: 'Reglamento Interno de la Comisión', description: 'Funcionamiento y reuniones de la Comisión Europea' },
  'RP TJUE': { name: 'Reglamento de Procedimiento del Tribunal de Justicia', description: 'Procedimientos judiciales del TJUE' },
}

// ============================================
// PATRONES PARA GENERACIÓN DINÁMICA
// ============================================

const SLUG_PATTERNS: SlugPattern[] = [
  { regex: /^lo-(\d+)-(\d+)$/, transform: (m) => `LO ${m[1]}/${m[2]}` },
  { regex: /^ley-(\d+)-(\d+)$/, transform: (m) => `Ley ${m[1]}/${m[2]}` },
  { regex: /^rdl-(\d+)-(\d+)$/, transform: (m) => `RDL ${m[1]}/${m[2]}` },
  { regex: /^rd-(\d+)-(\d+)$/, transform: (m) => `RD ${m[1]}/${m[2]}` },
  { regex: /^decreto-(\d+)-(\d+)$/, transform: (m) => `Decreto ${m[1]}/${m[2]}` },
  { regex: /^orden-([a-z]+)-(\d+)-(\d+)$/, transform: (m) => `Orden ${m[1].toUpperCase()}/${m[2]}/${m[3]}` },
  { regex: /^reglamento-ue-(\d+)-(\d+)$/, transform: (m) => `Reglamento UE ${m[1]}/${m[2]}` },
  {
    regex: /^(i{1,3}v?|v|vi{1,3})-plan-(.+)$/,
    transform: (m) => `${m[1].toUpperCase()} Plan de ${m[2].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
  },
]

// ============================================
// FUNCIONES EXPORTADAS
// ============================================

/**
 * Normaliza el nombre de una ley a su forma canónica en BD
 */
export function normalizeLawShortName(shortName: string): string {
  return NORMALIZATION_MAP[shortName] ?? shortName
}

/**
 * Obtiene todas las variantes de un nombre de ley
 */
export function getLawNameVariants(shortName: string): string[] {
  return VARIANTS_MAP[shortName] ?? [shortName]
}

/**
 * Genera short_name desde slug dinámicamente (fallback)
 */
function generateShortNameFromSlug(slug: string): string | null {
  if (!slug) return null

  try {
    for (const pattern of SLUG_PATTERNS) {
      const match = slug.match(pattern.regex)
      if (match) {
        return pattern.transform(match)
      }
    }

    // Fallback: convertir básicamente
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  } catch {
    return null
  }
}

/**
 * Mapea un slug de URL al short_name de la BD
 * Devuelve null si el slug no está en el mapeo conocido (para evitar soft 404)
 *
 * Orden de búsqueda:
 * 1. Cache de BD (si está cargado) - fuente de verdad
 * 2. Diccionario estático (fallback)
 * 3. Patrones inteligentes (generación automática)
 */
export function mapLawSlugToShortName(lawSlug: string): string | null {
  // 🔧 Decodificar URL-encoded slugs (ej: correo-electr%C3%B3nico → correo-electrónico)
  let decodedSlug = lawSlug
  try {
    decodedSlug = decodeURIComponent(lawSlug)
  } catch {
    // Si falla la decodificación, usar el original
  }

  // 1. Primero intentar cache de BD (fuente de verdad)
  if (dbSlugToShortName) {
    const dbResult = dbSlugToShortName.get(decodedSlug) || dbSlugToShortName.get(lawSlug)
    if (dbResult) {
      return dbResult
    }
  }

  // 2. Fallback a diccionario estático
  const result = SLUG_TO_SHORT_NAME[decodedSlug] || SLUG_TO_SHORT_NAME[lawSlug]
  if (result) {
    return result
  }

  // 🚀 FALLBACK INTELIGENTE: Generar short_name para patrones conocidos
  // Esto permite que tests funcionen aunque no estén en el mapping explícito

  // Patrón: orden-xxx-xxx-xxx → Orden XXX/XXX/XXX
  const ordenMatch = lawSlug.match(/^orden-([a-z]+)-(\d+)-(\d+)$/i)
  if (ordenMatch) {
    const [, prefix, number, year] = ordenMatch
    const generated = `Orden ${prefix.toUpperCase()}/${number}/${year}`
    console.log(`🔧 [lawMappingUtils] Generado automáticamente: ${lawSlug} → ${generated}`)
    return generated
  }

  // Patrón: ley-XX-YYYY → Ley XX/YYYY
  const leyMatch = lawSlug.match(/^ley-(\d+)-(\d+)$/)
  if (leyMatch) {
    const [, number, year] = leyMatch
    const generated = `Ley ${number}/${year}`
    console.log(`🔧 [lawMappingUtils] Generado automáticamente: ${lawSlug} → ${generated}`)
    return generated
  }

  // Patrón: rd-XXX-YYYY → RD XXX/YYYY
  const rdMatch = lawSlug.match(/^rd-(\d+)-(\d+)$/)
  if (rdMatch) {
    const [, number, year] = rdMatch
    const generated = `RD ${number}/${year}`
    console.log(`🔧 [lawMappingUtils] Generado automáticamente: ${lawSlug} → ${generated}`)
    return generated
  }

  // Patrón: lo-X-YYYY → LO X/YYYY
  const loMatch = lawSlug.match(/^lo-(\d+)-(\d+)$/)
  if (loMatch) {
    const [, number, year] = loMatch
    const generated = `LO ${number}/${year}`
    console.log(`🔧 [lawMappingUtils] Generado automáticamente: ${lawSlug} → ${generated}`)
    return generated
  }

  // Patrón: rdl-X-YYYY → RDL X/YYYY
  const rdlMatch = lawSlug.match(/^rdl-(\d+)-(\d+)$/)
  if (rdlMatch) {
    const [, number, year] = rdlMatch
    const generated = `RDL ${number}/${year}`
    console.log(`🔧 [lawMappingUtils] Generado automáticamente: ${lawSlug} → ${generated}`)
    return generated
  }

  // No se pudo generar - devolver null para que las páginas devuelvan 404
  return null
}

/**
 * Genera un slug de URL desde el short_name
 *
 * Orden de búsqueda:
 * 1. Cache de BD (si está cargado) - fuente de verdad
 * 2. Diccionario estático (fallback)
 * 3. Generación automática
 */
export function generateLawSlug(shortName: string): string {
  if (!shortName) return 'unknown'

  // 1. Primero intentar cache de BD
  if (dbShortNameToSlug) {
    const dbResult = dbShortNameToSlug.get(shortName)
    if (dbResult) {
      return dbResult
    }
  }

  // 2. Fallback a diccionario estático
  if (SHORT_NAME_TO_SLUG[shortName]) {
    return SHORT_NAME_TO_SLUG[shortName]
  }

  // 3. Generación automática (con transliteración de acentos)
  return shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Obtiene el slug canónico para SEO
 */
export function getCanonicalSlug(shortName: string): string {
  // generateLawSlug ya verifica cache BD, diccionario y genera automático
  return generateLawSlug(shortName)
}

/**
 * Obtiene información completa de una ley
 */
export function getLawInfo(lawSlug: string): LawInfo | null {
  const lawShortName = mapLawSlugToShortName(lawSlug)

  // Si el slug no es válido, devolver null
  if (!lawShortName) {
    return null
  }

  return LAW_INFO[lawShortName] ?? {
    name: lawShortName,
    description: `Test de ${lawShortName}`,
  }
}

/**
 * Valida que un slug es válido
 */
export function isValidLawSlug(lawSlug: string): boolean {
  const shortName = mapLawSlugToShortName(lawSlug)
  return shortName !== null
}

/**
 * Verifica si la URL es canónica
 */
export function isCanonicalUrl(lawSlug: string, shortName: string): boolean {
  const canonicalSlug = getCanonicalSlug(shortName)
  return lawSlug === canonicalSlug
}

/**
 * Devuelve todos los slugs registrados en SLUG_TO_SHORT_NAME.
 * Útil para generateStaticParams en páginas de leyes.
 */
export function getAllLawSlugs(): string[] {
  return Object.keys(SLUG_TO_SHORT_NAME)
}

/**
 * Devuelve todos los slugs del diccionario estático + los de la tabla `laws` en BD.
 * Uso exclusivo en generateStaticParams (build time).
 * Si la BD no está disponible, devuelve solo los estáticos (fallback seguro).
 */
export async function getAllLawSlugsWithDB(): Promise<string[]> {
  const staticSlugs = getAllLawSlugs()

  try {
    const { getSupabaseClient } = await import('./supabase')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('laws')
      .select('slug')
      .eq('is_active', true)
      .not('slug', 'is', null)

    if (error || !data) {
      console.warn('⚠️ [generateStaticParams] No se pudo consultar BD, usando solo slugs estáticos')
      return staticSlugs
    }

    const dbSlugs = data.map((row: { slug: string }) => row.slug).filter(Boolean)
    const merged = new Set([...staticSlugs, ...dbSlugs])
    return Array.from(merged)
  } catch {
    console.warn('⚠️ [generateStaticParams] Error consultando BD, usando solo slugs estáticos')
    return staticSlugs
  }
}
