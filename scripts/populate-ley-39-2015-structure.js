// scripts/populate-ley-39-2015-structure.js
// Poblar estructura de la Ley 39/2015 en la tabla law_sections

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ID de la Ley 39/2015 (ya verificado que existe)
const LEY_39_2015_ID = '218452f5-b9f6-48f0-a25b-26df9cb19644';

// Estructura completa de la Ley 39/2015 organizada por títulos y capítulos
const ley39Structure = [
  {
    section_type: 'titulo',
    section_number: 'Preliminar',
    title: 'Título Preliminar de la Ley 39/2015',
    description: 'Disposiciones generales del procedimiento administrativo común de las Administraciones Públicas',
    article_range_start: 1,
    article_range_end: 12,
    slug: 'titulo-preliminar',
    order_position: 1
  },
  {
    section_type: 'capitulo',
    section_number: 'I-I',
    title: 'Título I Ley 39/2015. Capítulo I. La capacidad de obrar y el concepto de interesado',
    description: 'Capacidad de obrar en el procedimiento administrativo y concepto de interesado',
    article_range_start: 13,
    article_range_end: 17,
    slug: 'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado',
    order_position: 2
  },
  {
    section_type: 'capitulo',
    section_number: 'I-II',
    title: 'Título I Ley 39/2015 - Capítulo II. Identificación y firma de los interesados en el procedimiento administrativo',
    description: 'Identificación y firma de interesados en el procedimiento administrativo',
    article_range_start: 18,
    article_range_end: 20,
    slug: 'titulo-i-capitulo-ii-identificacion-firma-interesados',
    order_position: 3
  },
  {
    section_type: 'capitulo',
    section_number: 'II-I',
    title: 'Título II Ley 39/2015 - Capítulo I. Normas generales de actuación',
    description: 'Normas generales de actuación administrativa',
    article_range_start: 21,
    article_range_end: 25,
    slug: 'titulo-ii-capitulo-i-normas-generales-actuacion',
    order_position: 4
  },
  {
    section_type: 'capitulo',
    section_number: 'II-II',
    title: 'Título II Ley 39/2015 - Capítulo II. Términos y plazos',
    description: 'Términos y plazos del procedimiento administrativo',
    article_range_start: 26,
    article_range_end: 33,
    slug: 'titulo-ii-capitulo-ii-terminos-plazos',
    order_position: 5
  },
  {
    section_type: 'capitulo',
    section_number: 'III-I',
    title: 'Título III Ley 39/2015 – Capítulo I. Requisitos de los actos administrativos',
    description: 'Requisitos de los actos administrativos',
    article_range_start: 34,
    article_range_end: 38,
    slug: 'titulo-iii-capitulo-i-requisitos-actos-administrativos',
    order_position: 6
  },
  {
    section_type: 'capitulo',
    section_number: 'III-II',
    title: 'Título III Ley 39/2015 – Capítulo II. Eficacia de los actos',
    description: 'Eficacia de los actos administrativos',
    article_range_start: 39,
    article_range_end: 44,
    slug: 'titulo-iii-capitulo-ii-eficacia-actos',
    order_position: 7
  },
  {
    section_type: 'capitulo',
    section_number: 'III-III',
    title: 'Título III Ley 39/2015 – Capítulo III. Nulidad y anulabilidad',
    description: 'Nulidad y anulabilidad de actos administrativos',
    article_range_start: 45,
    article_range_end: 52,
    slug: 'titulo-iii-capitulo-iii-nulidad-anulabilidad',
    order_position: 8
  },
  {
    section_type: 'capitulo',
    section_number: 'IV-I-II',
    title: 'Título IV Ley 39/2015 – Capítulo I Garantías del Procedimiento y Capítulo II Iniciación del Procedimiento',
    description: 'Garantías e iniciación del procedimiento',
    article_range_start: 53,
    article_range_end: 71,
    slug: 'titulo-iv-capitulos-i-ii-garantias-iniciacion',
    order_position: 9
  },
  {
    section_type: 'capitulo',
    section_number: 'IV-III-IV',
    title: 'Título IV Ley 39/2015 – Capítulo III Ordenación del Procedimiento y Capítulo IV Instrucción del Procedimiento',
    description: 'Ordenación e instrucción del procedimiento',
    article_range_start: 72,
    article_range_end: 89,
    slug: 'titulo-iv-capitulos-iii-iv-ordenacion-instruccion',
    order_position: 10
  },
  {
    section_type: 'capitulo',
    section_number: 'IV-V-VI-VII',
    title: 'Título IV Ley 39/2015 – Capítulo V finalización del procedimiento, Capítulo VI tramitación simplificada y Capítulo VII ejecución',
    description: 'Finalización, tramitación simplificada y ejecución',
    article_range_start: 90,
    article_range_end: 103,
    slug: 'titulo-iv-capitulos-v-vi-vii-finalizacion-simplificada-ejecucion',
    order_position: 11
  },
  {
    section_type: 'capitulo',
    section_number: 'V-I',
    title: 'Título V Ley 39/2015 – Capítulo I. Revisión de oficio',
    description: 'Revisión de oficio de actos administrativos',
    article_range_start: 104,
    article_range_end: 110,
    slug: 'titulo-v-capitulo-i-revision-oficio',
    order_position: 12
  },
  {
    section_type: 'capitulo',
    section_number: 'V-II',
    title: 'Título V Ley 39/2015 - Capítulo II Recursos administrativos',
    description: 'Recursos administrativos',
    article_range_start: 111,
    article_range_end: 126,
    slug: 'titulo-v-capitulo-ii-recursos-administrativos',
    order_position: 13
  },
  {
    section_type: 'titulo',
    section_number: 'VI',
    title: 'Título VI Ley 39/2015 – De la iniciativa legislativa y de la potestad para dictar reglamentos y otras disposiciones',
    description: 'Iniciativa legislativa y potestad reglamentaria',
    article_range_start: 127,
    article_range_end: 133,
    slug: 'titulo-vi-iniciativa-legislativa-potestad-reglamentaria',
    order_position: 14
  },
  {
    section_type: 'seccion',
    section_number: 'PLAZOS',
    title: 'Test de los plazos en la Ley 39/2015',
    description: 'Test específico sobre plazos administrativos en la Ley 39/2015',
    article_range_start: null, // Test especial, incluye todos los artículos relevantes
    article_range_end: null,
    slug: 'test-plazos',
    order_position: 15
  }
];

async function populateLey39Structure() {
  console.log('🏗️ Poblando estructura de la Ley 39/2015...');
  
  try {
    // Verificar que la tabla law_sections existe
    const { data: testTable, error: tableError } = await supabase
      .from('law_sections')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Error: La tabla law_sections no existe o no es accesible');
      console.log('📝 Por favor ejecuta primero: scripts/create-law-sections-table.sql');
      console.log('🔧 Error técnico:', tableError.message);
      return;
    }
    
    console.log('✅ Tabla law_sections encontrada');
    
    // Verificar si ya existe estructura para la Ley 39/2015
    const { data: existing, error: existingError } = await supabase
      .from('law_sections')
      .select('id')
      .eq('law_id', LEY_39_2015_ID);
    
    if (existingError) {
      console.log('❌ Error verificando datos existentes:', existingError.message);
      return;
    }
    
    if (existing && existing.length > 0) {
      console.log(`⚠️ Ya existen ${existing.length} secciones para la Ley 39/2015`);
      console.log('🗑️ ¿Deseas limpiar y recrear? Cambia FORCE_RECREATE a true');
      
      const FORCE_RECREATE = false; // Cambiar a true para forzar recreación
      
      if (!FORCE_RECREATE) {
        return;
      }
      
      // Limpiar datos existentes
      const { error: deleteError } = await supabase
        .from('law_sections')
        .delete()
        .eq('law_id', LEY_39_2015_ID);
      
      if (deleteError) {
        console.log('❌ Error limpiando datos existentes:', deleteError.message);
        return;
      }
      
      console.log('🗑️ Datos existentes eliminados');
    }
    
    // Insertar nueva estructura
    console.log(`📝 Insertando ${ley39Structure.length} secciones...`);
    
    const sectionsToInsert = ley39Structure.map(section => ({
      law_id: LEY_39_2015_ID,
      ...section
    }));
    
    const { data: insertedSections, error: insertError } = await supabase
      .from('law_sections')
      .insert(sectionsToInsert)
      .select('id, title, slug, order_position');
    
    if (insertError) {
      console.log('❌ Error insertando secciones:', insertError.message);
      console.log('🔧 Detalle del error:', insertError);
      return;
    }
    
    console.log('✅ Estructura de Ley 39/2015 insertada exitosamente');
    console.log(`📊 ${insertedSections.length} secciones creadas:`);
    
    insertedSections
      .sort((a, b) => a.order_position - b.order_position)
      .forEach((section, index) => {
        console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${section.title}`);
        console.log(`      📁 /${section.slug}`);
      });
    
    console.log('\\n🎯 Próximos pasos:');
    console.log('1. ✅ Verificar que las URLs de las páginas coincidan con los slugs');
    console.log('2. ✅ Actualizar páginas para cargar datos desde law_sections');
    console.log('3. ✅ Probar que todos los tests funcionen correctamente');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
    console.log('🔧 Stack trace:', error.stack);
  }
}

// Función auxiliar para verificar estructura creada
async function verifyStructure() {
  console.log('🔍 Verificando estructura creada...');
  
  const { data: sections, error } = await supabase
    .from('law_sections')
    .select('*')
    .eq('law_id', LEY_39_2015_ID)
    .order('order_position');
  
  if (error) {
    console.log('❌ Error verificando:', error.message);
    return;
  }
  
  console.log(`📋 Estructura verificada: ${sections.length} secciones`);
  sections.forEach(section => {
    const articles = section.article_range_start && section.article_range_end 
      ? `Arts. ${section.article_range_start}-${section.article_range_end}`
      : 'Artículos especiales';
    console.log(`  📑 ${section.title} (${articles})`);
  });
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'verify') {
    verifyStructure();
  } else {
    populateLey39Structure();
  }
}

export { populateLey39Structure, verifyStructure };