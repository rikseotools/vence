// scripts/populate-constitucion-structure.js
// Poblar law_sections con la estructura de la Constitución Española

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const constitucionSections = [
  {
    section_type: 'titulo',
    section_number: 'Preliminar',
    title: 'PREÁMBULO Y TÍTULO PRELIMINAR',
    description: 'Preámbulo y Título Preliminar de la Constitución Española. Fundamentos del Estado español',
    slug: 'preambulo-y-titulo-preliminar',
    article_range_start: 1,
    article_range_end: 9,
    order_position: 1
  },
  {
    section_type: 'titulo',
    section_number: 'I',
    title: 'Título I. De los Derechos y deberes fundamentales',
    description: 'Derechos fundamentales, libertades públicas, principios rectores y garantías constitucionales',
    slug: 'titulo-i-derechos-y-deberes-fundamentales',
    article_range_start: 10,
    article_range_end: 55,
    order_position: 2
  },
  {
    section_type: 'titulo',
    section_number: 'II',
    title: 'Título II. De la Corona',
    description: 'La Corona española: funciones del Rey, sucesión, regencia y tutela del Rey menor',
    slug: 'titulo-ii-de-la-corona',
    article_range_start: 56,
    article_range_end: 65,
    order_position: 3
  },
  {
    section_type: 'titulo',
    section_number: 'III',
    title: 'Título III. De las Cortes Generales',
    description: 'Las Cortes Generales: Congreso, Senado, funcionamiento y elaboración de leyes',
    slug: 'titulo-iii-de-las-cortes-generales',
    article_range_start: 66,
    article_range_end: 96,
    order_position: 4
  },
  {
    section_type: 'titulo',
    section_number: 'IV',
    title: 'Título IV. Del Gobierno y de la Administración',
    description: 'El Gobierno y la Administración: composición, funciones y responsabilidad',
    slug: 'titulo-iv-del-gobierno-y-la-administracion',
    article_range_start: 97,
    article_range_end: 107,
    order_position: 5
  },
  {
    section_type: 'titulo',
    section_number: 'V',
    title: 'Título V. Relaciones entre el Gobierno y las Cortes Generales',
    description: 'Relaciones entre el Gobierno y las Cortes: control parlamentario y responsabilidad',
    slug: 'titulo-v-relaciones-gobierno-cortes',
    article_range_start: 108,
    article_range_end: 116,
    order_position: 6
  },
  {
    section_type: 'titulo',
    section_number: 'VI',
    title: 'Título VI. Del Poder Judicial',
    description: 'El Poder Judicial: principios, organización, Consejo General del Poder Judicial',
    slug: 'titulo-vi-del-poder-judicial',
    article_range_start: 117,
    article_range_end: 127,
    order_position: 7
  },
  {
    section_type: 'titulo',
    section_number: 'VII',
    title: 'Título VII. Economía y hacienda',
    description: 'Economía y Hacienda: presupuestos, tributación y patrimonio del Estado',
    slug: 'titulo-vii-economia-y-hacienda',
    article_range_start: 128,
    article_range_end: 136,
    order_position: 8
  },
  {
    section_type: 'titulo',
    section_number: 'VIII',
    title: 'Título VIII. Organización territorial del Estado',
    description: 'Organización territorial: principios generales, Administración local y Comunidades Autónomas',
    slug: 'titulo-viii-organizacion-territorial',
    article_range_start: 137,
    article_range_end: 158,
    order_position: 9
  },
  {
    section_type: 'titulo',
    section_number: 'IX',
    title: 'Título IX. Del Tribunal Constitucional',
    description: 'El Tribunal Constitucional: composición, competencias y funcionamiento',
    slug: 'titulo-ix-del-tribunal-constitucional',
    article_range_start: 159,
    article_range_end: 165,
    order_position: 10
  },
  {
    section_type: 'titulo',
    section_number: 'X',
    title: 'Título X. De la reforma constitucional',
    description: 'Reforma de la Constitución: procedimientos ordinario y agravado',
    slug: 'titulo-x-de-la-reforma-constitucional',
    article_range_start: 166,
    article_range_end: 169,
    order_position: 11
  }
];

async function populateConstitucionStructure() {
  console.log('🏛️ Poblando estructura de la Constitución Española en law_sections...');
  
  try {
    // 1. Obtener ID de la Constitución Española
    const { data: lawData, error: lawError } = await supabase
      .from('laws')
      .select('id, name')
      .eq('short_name', 'CE')
      .single();

    if (lawError) {
      console.error('❌ Error encontrando Constitución Española:', lawError.message);
      return;
    }

    if (!lawData) {
      console.error('❌ No se encontró la ley "CE" en la tabla laws');
      console.log('💡 Asegúrate de que existe en la tabla laws con short_name="CE"');
      return;
    }

    console.log(`✅ Encontrada ley: ${lawData.name} (ID: ${lawData.id})`);

    // 2. Limpiar secciones existentes de la Constitución
    const { error: deleteError } = await supabase
      .from('law_sections')
      .delete()
      .eq('law_id', lawData.id);

    if (deleteError) {
      console.error('❌ Error limpiando secciones existentes:', deleteError.message);
      return;
    }

    console.log('🧹 Secciones existentes limpiadas');

    // 3. Insertar nuevas secciones
    const sectionsToInsert = constitucionSections.map(section => ({
      ...section,
      law_id: lawData.id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedSections, error: insertError } = await supabase
      .from('law_sections')
      .insert(sectionsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error insertando secciones:', insertError.message);
      return;
    }

    console.log(`✅ ${insertedSections.length} secciones de la Constitución insertadas:`);
    
    insertedSections.forEach((section, index) => {
      console.log(`${index + 1}. ${section.title}`);
      console.log(`   📍 Artículos ${section.article_range_start}-${section.article_range_end}`);
      console.log(`   🔗 Slug: ${section.slug}`);
    });

    console.log('\n🎉 Estructura de la Constitución Española poblada correctamente');
    console.log('📝 Próximo paso: Convertir páginas a SSR');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  populateConstitucionStructure();
}

export { populateConstitucionStructure };