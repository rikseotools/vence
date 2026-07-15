const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Mapeo de directorios a leyes virtuales y tags
const DIR_TO_LAW = {
  'Tema_1._Informática_básica': { lawName: 'Informática Básica', tag: 'T601' },
  'Tema_4._Procesadores_de_texto': { lawName: 'Procesadores de texto', tag: 'T604' },
  'Tema_5._Hojas_de_cálculo': { lawName: 'Hojas de cálculo. Excel', tag: 'T605' },
  'Tema_6._Bases_de_datos': { lawName: 'Base de datos: Access', tag: 'T606' }
};

// Mapeo de subtema a número de artículo por ley
const SUBTEMA_TO_ARTICLE = {
  'Informática Básica': {
    'conceptos fundamentales de informática': '1',
    'introducción a la informática': '2',
    'el hardware': '3',
    'el software': '4',
    'nociones básicas de seguridad informática': '5'
  },
  'Procesadores de texto': {
    'funcionalidades principales de word y writer': '1',
    'funcionalidades principales': '1',
    'principales funciones y utilidades': '1',
    'formatos de fuente, página y párrafo': '2',
    'formato de fuente, párrafo y página': '2',
    'formatos': '2',
    'imágenes, tablas, gráficos e iconos': '3',
    'tablas, gráficos e imágenes': '3',
    'tablas': '3',
    'combinación de correspondencia en word 365': '4',
    'combinación de correspondencia': '4',
    'atajos de teclado en word 365': '5',
    'atajos de teclado': '5',
    'menú vista, referencias y revisar': '6',
    'menú vista': '6',
    'vista y referencias': '6'
  },
  'Hojas de cálculo. Excel': {
    'utilidades de las hojas de cálculo': '1',
    'utilidades': '1',
    'principales funciones y utilidades': '1',
    'formato de celdas y formato condicional': '2',
    'formato de celdas': '2',
    'formatos': '2',
    'análisis de datos y demás opciones': '3',
    'análisis de datos': '3',
    'fórmulas y funciones': '4',
    'funciones': '4',
    'atajos de teclado': '5'
  },
  'Base de datos: Access': {
    'principales funciones y utilidades': '1',
    'funciones y utilidades': '1',
    'tablas, consultas y relaciones': '2',
    'tablas y consultas': '2',
    'tablas': '2',
    'informes, formularios, macros y vinculación': '3',
    'informes y formularios': '3',
    'formularios': '3',
    'atajos de teclado': '4'
  }
};

function findArticleNumber(subtema, lawName) {
  const mapping = SUBTEMA_TO_ARTICLE[lawName];
  if (!mapping) return '1'; // Default to article 1

  const subtemaLower = subtema.toLowerCase().trim();

  // Buscar coincidencia exacta
  if (mapping[subtemaLower]) return mapping[subtemaLower];

  // Buscar coincidencia parcial
  for (const [key, value] of Object.entries(mapping)) {
    if (subtemaLower.includes(key) || key.includes(subtemaLower)) {
      return value;
    }
  }

  return '1'; // Default
}

(async () => {
  console.log('=== Importando preguntas de Informática ===\n');

  const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

  // Obtener todas las leyes de informática
  const lawCache = {};
  for (const [dirName, config] of Object.entries(DIR_TO_LAW)) {
    const { data: law } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('short_name', config.lawName)
      .single();

    if (law) {
      lawCache[config.lawName] = law.id;
      console.log(`✓ Ley encontrada: ${config.lawName} (${law.id})`);
    } else {
      console.log(`✗ Ley NO encontrada: ${config.lawName}`);
    }
  }

  console.log('');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const [dirName, config] of Object.entries(DIR_TO_LAW)) {
    const dirPath = path.join(BASE_PATH, dirName);

    if (!fs.existsSync(dirPath)) {
      console.log(`\n⚠️  Directorio no existe: ${dirName}`);
      continue;
    }

    console.log(`\n📁 Procesando: ${dirName}`);
    console.log(`   Ley: ${config.lawName}, Tag: ${config.tag}`);

    const lawId = lawCache[config.lawName];
    if (!lawId) {
      console.log('   ❌ Ley no encontrada, saltando...');
      continue;
    }

    // Obtener artículos de esta ley
    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', lawId)
      .eq('is_active', true);

    const articleCache = {};
    articles?.forEach(a => articleCache[a.article_number] = a.id);
    console.log(`   Artículos disponibles: ${articles?.length || 0}`);

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let dirImported = 0;
    let dirSkipped = 0;
    let dirErrors = 0;

    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);
      const subtema = data.subtema || file.replace(/_/g, ' ').replace('.json', '');

      const articleNumber = findArticleNumber(subtema, config.lawName);
      const articleId = articleCache[articleNumber];

      if (!articleId) {
        console.log(`   ⚠️  Art.${articleNumber} no existe para subtema "${subtema}"`);
        dirErrors += (data.questions || []).length;
        continue;
      }

      for (const q of data.questions || []) {
        // Verificar si ya existe
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);

        if (count > 0) {
          dirSkipped++;
          continue;
        }

        // Insertar
        const { error } = await supabase.from('questions').insert({
          question_text: q.question,
          option_a: q.options.find(o => o.letter === 'A')?.text || '',
          option_b: q.options.find(o => o.letter === 'B')?.text || '',
          option_c: q.options.find(o => o.letter === 'C')?.text || '',
          option_d: q.options.find(o => o.letter === 'D')?.text || '',
          correct_option: LETTER_TO_INDEX[q.correctAnswer],
          explanation: q.explanation || '',
          primary_article_id: articleId,
          difficulty: 'medium',
          is_active: true,
          is_official_exam: false,
          tags: [subtema.trim(), config.tag, 'Bloque VI']
        });

        if (error) {
          dirErrors++;
        } else {
          dirImported++;
        }
      }
    }

    console.log(`   ✅ Importadas: ${dirImported}`);
    console.log(`   ⏭️  Omitidas: ${dirSkipped}`);
    console.log(`   ❌ Errores: ${dirErrors}`);

    totalImported += dirImported;
    totalSkipped += dirSkipped;
    totalErrors += dirErrors;
  }

  console.log('\n==========================================');
  console.log('📊 RESUMEN TOTAL');
  console.log('==========================================');
  console.log(`✅ Importadas: ${totalImported}`);
  console.log(`⏭️  Omitidas (ya existían): ${totalSkipped}`);
  console.log(`❌ Errores: ${totalErrors}`);

  // Contar total por tag
  for (const config of Object.values(DIR_TO_LAW)) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [config.tag])
      .eq('is_active', true);
    console.log(`📈 Total ${config.tag}: ${count}`);
  }
})();
