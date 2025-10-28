// scripts/extract-law-structure.js - Extraer estructura oficial de leyes desde BOE
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extrae estructura de títulos desde contenido HTML del BOE
 */
function extractStructureFromBOE(htmlContent, lawShortName) {
  console.log(`🔍 Extrayendo estructura de ${lawShortName}...`);
  
  // Patrones específicos para cada ley
  const patterns = {
    'Ley 39/2015': {
      titlePattern: /<h[1-6][^>]*>.*?TÍTULO\s+([IVXLC]+(?:\s*BIS)?)\s*\.?\s*([^<]+)<\/h[1-6]>/gi,
      articlePattern: /Artículo\s+(\d+(?:\s*[a-z])?)\./gi
    },
    'Ley 40/2015': {
      titlePattern: /<h[1-6][^>]*>.*?TÍTULO\s+([IVXLC]+(?:\s*BIS)?)\s*\.?\s*([^<]+)<\/h[1-6]>/gi,
      articlePattern: /Artículo\s+(\d+(?:\s*[a-z])?)\./gi
    },
    'CE': {
      titlePattern: /<h[1-6][^>]*>.*?TÍTULO\s+([IVXLC]+)\s*\.?\s*([^<]+)<\/h[1-6]>/gi,
      articlePattern: /Artículo\s+(\d+(?:\s*[a-z])?)\./gi
    }
  };

  const pattern = patterns[lawShortName];
  if (!pattern) {
    throw new Error(`No hay patrón definido para ${lawShortName}`);
  }

  // Extraer títulos
  const titles = [];
  let match;
  
  while ((match = pattern.titlePattern.exec(htmlContent)) !== null) {
    const romanNumber = match[1].trim();
    const titleText = match[2].trim();
    
    titles.push({
      section_number: romanNumber,
      title: `Título ${romanNumber}. ${titleText}`,
      raw_title: titleText
    });
  }

  // Extraer todos los artículos
  const articles = [];
  pattern.articlePattern.lastIndex = 0; // Reset regex
  
  while ((match = pattern.articlePattern.exec(htmlContent)) !== null) {
    const articleNum = parseInt(match[1].replace(/[a-z\s]/g, ''));
    if (!isNaN(articleNum)) {
      articles.push(articleNum);
    }
  }

  // Asignar rangos de artículos a cada título
  const structuredTitles = titles.map((title, index) => {
    // Para determinar rango, necesitamos analizar el contenido entre títulos
    const nextTitle = titles[index + 1];
    
    // Por ahora retornamos estructura básica - esto requiere análisis más detallado del HTML
    return {
      ...title,
      article_range_start: null, // Se calculará manualmente por ley
      article_range_end: null,
      description: title.raw_title,
      slug: generateSlug(title.title)
    };
  });

  return {
    titles: structuredTitles,
    totalArticles: articles.length,
    articles: articles.sort((a, b) => a - b)
  };
}

/**
 * Genera slug para URL amigable
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Obtiene contenido desde BOE y calcula hash
 */
async function fetchBOEContent(boeUrl) {
  console.log(`📥 Descargando contenido de: ${boeUrl}`);
  
  try {
    const response = await fetch(boeUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    return { content, hash };
  } catch (error) {
    console.error(`❌ Error descargando ${boeUrl}:`, error.message);
    throw error;
  }
}

/**
 * Estructura manual correcta para Ley 39/2015 (verificada con BOE oficial)
 * Fuente: https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565
 * Verificado: 28/10/2025 - ESTRUCTURA FINAL BASADA EN BOE
 * 
 * RANGOS VERIFICADOS:
 * - Título Preliminar: 1-2
 * - Título I: 3-12 (incluye capítulos I y II)
 * - Título II: 13-33 (incluye capítulos I y II) 
 * - Título III: 34-52 (incluye capítulos I, II y III)
 * - Título IV: 53-105 (procedimiento administrativo común)
 * - Título V: 106-126 (revisión de actos)
 * - Título VI: 127-133 (iniciativa legislativa)
 */
function getLey39Structure() {
  return [
    {
      section_type: 'titulo',
      section_number: 'Preliminar',
      title: 'Título Preliminar. Disposiciones generales',
      description: 'Objeto, ámbito de aplicación y principios generales',
      article_range_start: 1,
      article_range_end: 2,
      slug: 'titulo-preliminar-disposiciones-generales',
      order_position: 1
    },
    {
      section_type: 'titulo',
      section_number: 'I',
      title: 'Título I. De los interesados en el procedimiento',
      description: 'Capacidad de obrar, identificación y representación',
      article_range_start: 3,
      article_range_end: 12,
      slug: 'titulo-i-interesados-procedimiento',
      order_position: 2
    },
    {
      section_type: 'titulo',
      section_number: 'II',
      title: 'Título II. De la actividad de las Administraciones Públicas',
      description: 'Normas generales de actuación, términos y plazos',
      article_range_start: 13,
      article_range_end: 33,
      slug: 'titulo-ii-actividad-administraciones-publicas',
      order_position: 3
    },
    {
      section_type: 'titulo',
      section_number: 'III',
      title: 'Título III. De los actos administrativos',
      description: 'Requisitos, eficacia, nulidad y anulabilidad',
      article_range_start: 34,
      article_range_end: 52,
      slug: 'titulo-iii-actos-administrativos',
      order_position: 4
    },
    {
      section_type: 'titulo',
      section_number: 'IV',
      title: 'Título IV. Del procedimiento administrativo común',
      description: 'Garantías, fases e instrucción del procedimiento',
      article_range_start: 53,
      article_range_end: 105,
      slug: 'titulo-iv-procedimiento-administrativo-comun',
      order_position: 5
    },
    {
      section_type: 'titulo',
      section_number: 'V',
      title: 'Título V. De la revisión de los actos en vía administrativa',
      description: 'Revisión de oficio y recursos administrativos',
      article_range_start: 106,
      article_range_end: 126,
      slug: 'titulo-v-revision-actos-via-administrativa',
      order_position: 6
    },
    {
      section_type: 'titulo',
      section_number: 'VI',
      title: 'Título VI. De la iniciativa legislativa y potestad reglamentaria',
      description: 'Iniciativa legislativa y potestad normativa',
      article_range_start: 127,
      article_range_end: 133,
      slug: 'titulo-vi-iniciativa-legislativa-potestad-reglamentaria',
      order_position: 7
    }
  ];
}

/**
 * Inserta estructura en base de datos
 */
async function insertLawStructure(lawId, structure) {
  console.log(`💾 Insertando estructura en base de datos...`);
  
  // Primero eliminar estructura existente
  const { error: deleteError } = await supabase
    .from('law_sections')
    .delete()
    .eq('law_id', lawId);
  
  if (deleteError) {
    throw new Error(`Error eliminando estructura existente: ${deleteError.message}`);
  }
  
  // Insertar nueva estructura
  const sectionsToInsert = structure.map(section => ({
    law_id: lawId,
    ...section,
    is_active: true
  }));
  
  const { data, error } = await supabase
    .from('law_sections')
    .insert(sectionsToInsert)
    .select();
  
  if (error) {
    throw new Error(`Error insertando estructura: ${error.message}`);
  }
  
  console.log(`✅ Insertadas ${data.length} secciones correctamente`);
  return data;
}

/**
 * Actualiza hash de contenido en tabla laws
 */
async function updateContentHash(lawId, contentHash) {
  const { error } = await supabase
    .from('laws')
    .update({ 
      content_hash: contentHash,
      last_checked: new Date().toISOString()
    })
    .eq('id', lawId);
  
  if (error) {
    throw new Error(`Error actualizando hash: ${error.message}`);
  }
}

/**
 * Procesa una ley específica
 */
async function processLaw(lawShortName) {
  console.log(`\n🏛️ === PROCESANDO ${lawShortName} ===`);
  
  try {
    // Obtener datos de la ley
    const { data: law, error } = await supabase
      .from('laws')
      .select('id, boe_url, content_hash, last_checked')
      .eq('short_name', lawShortName)
      .single();
    
    if (error || !law) {
      throw new Error(`Ley ${lawShortName} no encontrada en base de datos`);
    }
    
    if (!law.boe_url) {
      throw new Error(`Ley ${lawShortName} no tiene BOE URL configurada`);
    }
    
    // Descargar contenido del BOE
    const { content, hash } = await fetchBOEContent(law.boe_url);
    
    // Verificar si ha cambiado
    if (law.content_hash === hash) {
      console.log(`⚠️ Contenido no ha cambiado desde última verificación`);
      return;
    }
    
    // Para Ley 39/2015, usar estructura manual verificada
    let structure;
    if (lawShortName === 'Ley 39/2015') {
      console.log(`📋 Usando estructura manual verificada para ${lawShortName}`);
      structure = getLey39Structure();
    } else {
      // Para otras leyes, intentar extraer automáticamente
      console.log(`🤖 Extrayendo estructura automáticamente...`);
      const extracted = extractStructureFromBOE(content, lawShortName);
      structure = extracted.titles;
      
      console.log(`ℹ️ NOTA: Estructura automática requiere revisión manual`);
      console.log(`ℹ️ Total artículos encontrados: ${extracted.totalArticles}`);
      console.log(`ℹ️ Títulos encontrados: ${structure.length}`);
    }
    
    // Insertar estructura
    await insertLawStructure(law.id, structure);
    
    // Actualizar hash
    await updateContentHash(law.id, hash);
    
    console.log(`✅ ${lawShortName} procesada correctamente`);
    
  } catch (error) {
    console.error(`❌ Error procesando ${lawShortName}:`, error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  const lawToProcess = process.argv[2];
  
  if (!lawToProcess) {
    console.log(`
🏛️ EXTRACTOR DE ESTRUCTURA DE LEYES DESDE BOE

Uso:
  node scripts/extract-law-structure.js [ley]

Ejemplos:
  node scripts/extract-law-structure.js "Ley 39/2015"
  node scripts/extract-law-structure.js "Ley 40/2015"
  node scripts/extract-law-structure.js "CE"

Leyes disponibles con BOE URL:
`);
    
    // Mostrar leyes disponibles
    const { data: laws } = await supabase
      .from('laws')
      .select('short_name, boe_url, last_checked')
      .not('boe_url', 'is', null)
      .order('short_name');
    
    laws?.forEach(law => {
      const verified = law.last_checked ? 
        new Date(law.last_checked).toLocaleDateString('es-ES') : 
        'Nunca';
      console.log(`  📚 ${law.short_name} - Verificado: ${verified}`);
    });
    
    return;
  }
  
  try {
    await processLaw(lawToProcess);
    console.log(`\n🎉 Proceso completado exitosamente`);
  } catch (error) {
    console.error(`\n💥 Error en el proceso:`, error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processLaw, extractStructureFromBOE, getLey39Structure };