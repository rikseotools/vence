/**
 * Módulo BOE - Funciones para interactuar con el Boletín Oficial del Estado
 */

// Fetcher - Obtener datos del BOE
export {
  fetchBoeSumario,
  fetchConvocatoriaXML,
  checkBoeAvailable,
  generarRangoFechas,
  type ConvocatoriaBOE,
  type ConvocatoriaXMLData
} from './convocatoriasFetcher';

// Parser - Extraer información de convocatorias
export {
  detectarTipo,
  detectarCategoria,
  detectarOposicion,
  extraerPlazas,
  detectarAcceso,
  extraerDatosDelTexto,
  calcularRelevancia,
  limpiarTitulo,
  // Funciones geográficas
  detectarAmbito,
  extraerProvincia,
  extraerMunicipio,
  detectarComunidadAutonoma,
  extraerDatosGeograficos,
  // Tipos
  type TipoConvocatoria,
  type Categoria,
  type TipoAcceso,
  type DatosExtraidos,
  type PlazasExtraidas,
  type Ambito,
  type DatosGeograficos
} from './convocatoriasParser';
