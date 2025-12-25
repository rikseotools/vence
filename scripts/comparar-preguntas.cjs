// scripts/comparar-preguntas.cjs
// Compara preguntas scrapeadas con la BD - interactivo por tema

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PREGUNTAS_DIR = path.join(__dirname, '..', 'preguntas-para-subir');

// Normalizar texto
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calcular similitud entre dos textos (0-1)
function similarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  // Distancia de Levenshtein simplificada
  const costs = [];
  for (let i = 0; i <= str1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[str2.length] = lastValue;
  }

  return (longer.length - costs[str2.length]) / longer.length;
}

// Obtener primeras N palabras
function firstNWords(text, n = 8) {
  return text.split(' ').slice(0, n).join(' ');
}

// Comparar pregunta contra BD con multiples metodos
function findMatch(scrapedQ, dbTexts, dbMap, dbFullMap) {
  const normalizedQ = normalizeText(scrapedQ.question);
  const firstWords = firstNWords(normalizedQ);

  // Construir texto completo (pregunta + opciones)
  const fullText = [
    scrapedQ.question,
    ...scrapedQ.options.map(o => o.text)
  ].join(' ');
  const normalizedFull = normalizeText(fullText);

  // 1. Coincidencia exacta de pregunta + opciones
  if (dbFullMap.has(normalizedFull)) {
    return { type: 'exacta', confidence: 100, dbQuestion: dbFullMap.get(normalizedFull) };
  }

  // 2. Coincidencia exacta solo pregunta
  if (dbTexts.has(normalizedQ)) {
    return { type: 'pregunta', confidence: 95, dbQuestion: dbMap.get(normalizedQ) };
  }

  // 3. Primeras 8 palabras iguales
  for (const [dbNorm, dbOriginal] of dbMap) {
    if (firstNWords(dbNorm) === firstWords && firstWords.length > 20) {
      return { type: 'inicio', confidence: 85, dbQuestion: dbOriginal };
    }
  }

  // 4. Similitud > 80% en texto completo
  for (const [dbNorm, dbOriginal] of dbFullMap) {
    const sim = similarity(normalizedFull, dbNorm);
    if (sim > 0.80) {
      return { type: 'similar', confidence: Math.round(sim * 100), dbQuestion: dbOriginal };
    }
  }

  // 5. Similitud > 65% (posible duplicada)
  for (const [dbNorm, dbOriginal] of dbMap) {
    const sim = similarity(normalizedQ, dbNorm);
    if (sim > 0.65) {
      return { type: 'posible', confidence: Math.round(sim * 100), dbQuestion: dbOriginal };
    }
  }

  return null;
}

// Mapeo de carpetas a leyes virtuales
const TOPIC_TO_LAW = {
  'Tema 1.Informática_básica ': 'Informática Básica',
  'Tema_1__Informática_básica': 'Informática Básica',
  'Tema_2._Sistema_Operativo_Windows_11': 'Windows 10',
  'Tema_3._El_Explorador_de_Archivos': 'Explorador de Windows',
  'Tema_4._Procesadores_de_texto': 'Procesadores de texto',
  'Tema_5._Hojas_de_calculo': 'Hojas de cálculo. Excel',
  'Tema_6._Bases_de_datos': 'Base de datos: Access',
  'Tema_7._Correo_electronico': 'Correo electrónico',
  'Tema_8._La_Red_Internet': 'La Red Internet'
};

// Mapeo de subtemas a títulos de artículos (para matching)
const SUBTEMA_TO_ARTICLE = {
  // Informática Básica (Tema 1) - Orden: Art.2=Intro, Art.3=Hardware, Art.4=Software, Art.5=Seguridad
  'introducción a la informática': 'Introducción a la informática',
  'el hardware': 'El hardware',
  'el software': 'El software',
  'nociones básicas de seguridad informática': 'Nociones básicas de seguridad',
  // Procesadores de texto
  'principales funciones y utilidades': 'Funcionalidades principales',
  'formatos de fuente, página y párrafo': 'Formatos de fuente',
  'imágenes, tablas, gráficos e iconos': 'Imágenes, tablas',
  'correspondencia': 'Combinación de correspondencia',
  'atajos de teclado': 'Atajos de teclado',
  'menús vista, referencias y revisar': 'Menú vista',
  // Hojas de cálculo
  'utilidades de las hojas de cálculo': 'Utilidades de las hojas',
  'formato de celdas y formato condicional': 'Formato de celdas',
  'análisis de datos y demás opciones': 'Análisis de datos',
  'fórmulas y funciones': 'Fórmulas y funciones',
  // Bases de datos
  'tablas, consultas y relaciones': 'Tablas, consultas',
  'informes, formularios, macros y vinculación': 'Informes, formularios',
  // Correo electrónico
  'conceptos y funcionamiento': 'Conceptos y funcionamiento',
  'el entorno de trabajo': 'El entorno de trabajo'
};

// Extraer subtema del campo topic
// Formato: "Subtema / Tema principal / Categoría"
function extractSubtema(topic) {
  if (!topic) return 'General';
  const parts = topic.split(' / ');
  // El subtema es la primera parte
  return parts[0].replace(/\.$/, '').trim() || 'General';
}

// Agrupar preguntas por subtema
function groupBySubtema(questions) {
  const groups = new Map();

  for (const q of questions) {
    const subtema = extractSubtema(q.topic);
    if (!groups.has(subtema)) {
      groups.set(subtema, []);
    }
    groups.get(subtema).push(q);
  }

  return groups;
}

// Buscar artículo que coincida con el subtema
async function findArticleForSubtema(subtema, lawId, supabase) {
  const normalizedSubtema = subtema.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Buscar en el mapeo primero
  for (const [key, value] of Object.entries(SUBTEMA_TO_ARTICLE)) {
    if (normalizedSubtema.includes(key) || key.includes(normalizedSubtema.substring(0, 15))) {
      // Buscar artículo con título similar
      const { data: articles } = await supabase
        .from('articles')
        .select('id, article_number, title')
        .eq('law_id', lawId)
        .ilike('title', `%${value}%`);

      if (articles?.length > 0) {
        return articles[0];
      }
    }
  }

  // Búsqueda directa por similitud en título
  const { data: allArticles } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', lawId);

  if (allArticles) {
    for (const art of allArticles) {
      const normalizedTitle = art.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Si el subtema o el título contienen palabras clave similares
      if (normalizedTitle.includes(normalizedSubtema.substring(0, 10)) ||
          normalizedSubtema.includes(normalizedTitle.substring(0, 10))) {
        return art;
      }
    }
  }

  return null;
}

// Convertir letra a numero (A=0, B=1, C=2, D=3)
function letterToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter?.toUpperCase()] ?? 0;
}

// Subir preguntas nuevas a la BD - agrupadas por subtema
async function subirPreguntas(preguntas, topicFolder, supabase, rl) {
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('\n🔍 ANALIZANDO PREGUNTAS POR SUBTEMA...');
  console.log('═'.repeat(50));

  // 1. Obtener ley virtual
  const lawName = TOPIC_TO_LAW[topicFolder];

  if (!lawName) {
    console.log(`❌ No hay mapeo para carpeta: ${topicFolder}`);
    console.log('   Carpetas disponibles:', Object.keys(TOPIC_TO_LAW));
    return;
  }

  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', lawName)
    .single();

  if (!law) {
    console.log(`❌ Ley virtual no encontrada: "${lawName}"`);
    return;
  }

  console.log(`📚 LEY: ${law.short_name}\n`);

  // 2. Obtener todos los artículos de esta ley
  const { data: allArticles } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .order('article_number');

  if (!allArticles || allArticles.length === 0) {
    console.log(`⚠️  No hay artículos en esta ley virtual`);
    console.log('   Debes crear artículos primero desde el panel admin');
    return;
  }

  // 3. Agrupar preguntas por subtema
  const grupos = groupBySubtema(preguntas);

  console.log(`📊 SUBTEMAS ENCONTRADOS (${grupos.size}):\n`);

  // 4. Para cada grupo, buscar el artículo correspondiente
  const subidaPlan = [];

  for (const [subtema, preguntasGrupo] of grupos) {
    const articulo = await findArticleForSubtema(subtema, law.id, supabase);

    if (articulo) {
      console.log(`   ✅ "${subtema}" (${preguntasGrupo.length})`);
      console.log(`      → Art. ${articulo.article_number}: ${articulo.title}`);
      subidaPlan.push({
        subtema,
        preguntas: preguntasGrupo,
        articulo,
        status: 'ready'
      });
    } else {
      console.log(`   ⚠️  "${subtema}" (${preguntasGrupo.length})`);
      console.log(`      → SIN ARTÍCULO CORRESPONDIENTE`);
      subidaPlan.push({
        subtema,
        preguntas: preguntasGrupo,
        articulo: null,
        status: 'no_match'
      });
    }
  }

  // 5. Resumen y opciones
  const listos = subidaPlan.filter(g => g.status === 'ready');
  const sinArticulo = subidaPlan.filter(g => g.status === 'no_match');
  const totalListos = listos.reduce((sum, g) => sum + g.preguntas.length, 0);
  const totalSinArticulo = sinArticulo.reduce((sum, g) => sum + g.preguntas.length, 0);

  console.log('\n' + '─'.repeat(50));
  console.log(`📋 RESUMEN:`);
  console.log(`   ✅ Listas para subir: ${totalListos} preguntas en ${listos.length} subtemas`);

  if (sinArticulo.length > 0) {
    console.log(`   ⚠️  Sin artículo: ${totalSinArticulo} preguntas en ${sinArticulo.length} subtemas`);
  }

  if (listos.length === 0) {
    console.log('\n❌ No hay preguntas listas para subir');
    console.log('   Crea los artículos necesarios primero');
    return;
  }

  // 6. Opciones de subida
  console.log('\n' + '─'.repeat(50));
  console.log('OPCIONES:');
  console.log('   1. Subir todas las que tienen artículo');
  console.log('   2. Seleccionar subtemas específicos');

  if (sinArticulo.length > 0) {
    console.log('   3. Asignar artículo manualmente a los sin artículo');
  }

  console.log('   0. Cancelar\n');

  const opcion = await ask('👉 Elige opción: ');

  if (opcion === '0') {
    console.log('\n⏹️  Subida cancelada');
    return;
  }

  if (opcion === '1') {
    // Subir todos los listos
    await ejecutarSubida(listos, supabase);
  } else if (opcion === '2') {
    // Seleccionar subtemas
    console.log('\n📋 SUBTEMAS DISPONIBLES:\n');
    listos.forEach((g, i) => {
      console.log(`   ${i + 1}. ${g.subtema} (${g.preguntas.length}) → Art. ${g.articulo.article_number}`);
    });
    console.log('\n   Escribe los números separados por coma (ej: 1,3,4)');

    const seleccion = await ask('👉 Selección: ');
    const indices = seleccion.split(',').map(n => parseInt(n.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < listos.length);

    if (indices.length === 0) {
      console.log('❌ Selección inválida');
      return;
    }

    const seleccionados = indices.map(i => listos[i]);
    await ejecutarSubida(seleccionados, supabase);
  } else if (opcion === '3' && sinArticulo.length > 0) {
    // Asignar artículo manualmente
    console.log('\n📄 ARTÍCULOS DISPONIBLES:\n');
    allArticles.forEach((a, i) => {
      console.log(`   ${i + 1}. Art. ${a.article_number}: ${a.title}`);
    });

    for (const grupo of sinArticulo) {
      console.log(`\n⚠️  Subtema: "${grupo.subtema}" (${grupo.preguntas.length} preguntas)`);
      const artChoice = await ask('   → Asignar a artículo (número, o 0 para omitir): ');

      const artIdx = parseInt(artChoice) - 1;
      if (!isNaN(artIdx) && artIdx >= 0 && artIdx < allArticles.length) {
        grupo.articulo = allArticles[artIdx];
        grupo.status = 'ready';
        console.log(`   ✅ Asignado a Art. ${grupo.articulo.article_number}`);
      } else {
        console.log(`   ⏭️  Omitido`);
      }
    }

    const nuevosListos = sinArticulo.filter(g => g.status === 'ready');
    if (nuevosListos.length > 0) {
      await ejecutarSubida(nuevosListos, supabase);
    }
  }
}

// Ejecutar la subida de preguntas
async function ejecutarSubida(grupos, supabase) {
  const totalPreguntas = grupos.reduce((sum, g) => sum + g.preguntas.length, 0);

  // Obtener conteo ANTES de subir
  console.log('\n📊 ESTADO ACTUAL DE LA BD:');
  const estadoAntes = new Map();
  for (const grupo of grupos) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('primary_article_id', grupo.articulo.id)
      .eq('is_active', true);

    estadoAntes.set(grupo.articulo.id, count || 0);
    console.log(`   Art. ${grupo.articulo.article_number}: ${count || 0} preguntas`);
  }

  console.log(`\n📤 SUBIENDO ${totalPreguntas} PREGUNTAS...`);
  console.log('─'.repeat(50));

  let totalInsertadas = 0;
  let totalDuplicadas = 0;
  let totalErrores = 0;
  let procesadas = 0;

  for (const grupo of grupos) {
    console.log(`\n📁 ${grupo.subtema} → Art. ${grupo.articulo.article_number} (${grupo.preguntas.length} preguntas)`);

    let insertadas = 0;
    let duplicadas = 0;
    let errores = 0;

    for (let i = 0; i < grupo.preguntas.length; i++) {
      const q = grupo.preguntas[i];
      procesadas++;

      // Mostrar progreso
      process.stdout.write(`\r   ⏳ ${i + 1}/${grupo.preguntas.length} (total: ${procesadas}/${totalPreguntas})`);

      const { error } = await supabase
        .from('questions')
        .insert({
          question_text: q.question,
          option_a: q.options[0]?.text || '',
          option_b: q.options[1]?.text || '',
          option_c: q.options[2]?.text || '',
          option_d: q.options[3]?.text || '',
          correct_option: letterToNumber(q.correctAnswer),
          explanation: q.explanation || 'Sin explicación disponible',
          primary_article_id: grupo.articulo.id,
          difficulty: 'medium',
          question_type: 'single',
          is_active: true,
          is_official_exam: false
        });

      if (error) {
        if (error.message.includes('content_hash') || error.message.includes('duplicate')) {
          duplicadas++;
        } else {
          errores++;
        }
      } else {
        insertadas++;
      }
    }

    console.log(`\r   ✅ ${insertadas} insertadas | ⚠️ ${duplicadas} duplicadas | ❌ ${errores} errores     `);

    totalInsertadas += insertadas;
    totalDuplicadas += duplicadas;
    totalErrores += errores;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 TOTAL: ${totalInsertadas} insertadas, ${totalDuplicadas} duplicadas, ${totalErrores} errores`);

  // Obtener conteo DESPUÉS de subir
  console.log('\n📊 VERIFICACIÓN BD (antes → después):');
  for (const grupo of grupos) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('primary_article_id', grupo.articulo.id)
      .eq('is_active', true);

    const antes = estadoAntes.get(grupo.articulo.id);
    const despues = count || 0;
    const diff = despues - antes;
    console.log(`   Art. ${grupo.articulo.article_number}: ${antes} → ${despues} (+${diff})`);
  }
}

// Leer temas disponibles
function getTopics() {
  const topics = [];
  const items = fs.readdirSync(PREGUNTAS_DIR);

  for (const item of items) {
    const fullPath = path.join(PREGUNTAS_DIR, item);
    if (fs.statSync(fullPath).isDirectory()) {
      // Contar preguntas
      let count = 0;
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(fullPath, file), 'utf-8'));
          count += data.questions?.length || 0;
        } catch (e) {}
      }
      if (count > 0) {
        topics.push({ name: item, count, files });
      }
    }
  }

  return topics.sort((a, b) => a.name.localeCompare(b.name));
}

// Leer preguntas de un tema
function getQuestionsFromTopic(topicName) {
  const questions = [];
  const topicPath = path.join(PREGUNTAS_DIR, topicName);
  const files = fs.readdirSync(topicPath).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(topicPath, file), 'utf-8'));
      if (data.questions) {
        for (const q of data.questions) {
          questions.push({ ...q, file });
        }
      }
    } catch (e) {}
  }

  return questions;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('');
  console.log('🔍 Comparador de Preguntas');
  console.log('═'.repeat(50));

  // Cargar BD
  console.log('\n📊 Cargando base de datos...');
  const { data: dbQuestions, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d')
    .eq('is_active', true);

  if (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    return;
  }

  const dbTexts = new Set();
  const dbMap = new Map(); // normalized -> original question
  const dbFullMap = new Map(); // normalized (pregunta+opciones) -> original

  for (const q of dbQuestions) {
    // Solo pregunta
    const normQuestion = normalizeText(q.question_text);
    dbTexts.add(normQuestion);
    dbMap.set(normQuestion, q.question_text);

    // Pregunta + opciones (mas preciso)
    const fullText = [
      q.question_text,
      q.option_a || '',
      q.option_b || '',
      q.option_c || '',
      q.option_d || ''
    ].join(' ');
    const normFull = normalizeText(fullText);
    dbFullMap.set(normFull, q.question_text);
  }
  console.log(`   ${dbQuestions.length} preguntas en BD\n`);

  // Loop principal
  while (true) {
    // Mostrar temas
    const topics = getTopics();

    console.log('─'.repeat(50));
    console.log('📁 TEMAS DISPONIBLES:\n');

    topics.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} (${t.count} preguntas)`);
    });

    console.log(`\n   0. Salir`);
    console.log('─'.repeat(50));

    const choice = await ask('\n👉 Selecciona tema (numero): ');

    if (choice === '0' || choice.toLowerCase() === 'salir') {
      break;
    }

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= topics.length) {
      console.log('❌ Opcion no valida\n');
      continue;
    }

    const topic = topics[idx];
    console.log(`\n📂 ${topic.name}`);
    console.log('═'.repeat(50));

    // Cargar preguntas y agrupar por subtema
    const allQuestions = getQuestionsFromTopic(topic.name);
    const subtemasMap = groupBySubtema(allQuestions);
    const subtemas = Array.from(subtemasMap.entries());

    // Mostrar subtemas disponibles
    console.log(`\n📁 SUBTEMAS (${subtemas.length}):\n`);
    subtemas.forEach(([nombre, pregs], i) => {
      console.log(`   ${i + 1}. ${nombre} (${pregs.length} preguntas)`);
    });
    console.log(`\n   A. Analizar TODOS los subtemas`);
    console.log(`   0. Volver`);

    const subChoice = await ask('\n👉 Selecciona subtema (numero o A): ');

    if (subChoice === '0') {
      console.log('\n');
      continue;
    }

    // Determinar qué preguntas analizar
    let questions;
    let subtemaSeleccionado;

    if (subChoice.toLowerCase() === 'a') {
      questions = allQuestions;
      subtemaSeleccionado = 'TODOS';
    } else {
      const subIdx = parseInt(subChoice) - 1;
      if (isNaN(subIdx) || subIdx < 0 || subIdx >= subtemas.length) {
        console.log('❌ Opcion no valida\n');
        continue;
      }
      subtemaSeleccionado = subtemas[subIdx][0];
      questions = subtemas[subIdx][1];
    }

    console.log(`\n📂 ${topic.name} → ${subtemaSeleccionado}`);
    console.log('═'.repeat(50));

    const nuevas = [];
    const duplicadas = [];  // exactas, inicio, similar (>85%)
    const posibles = [];    // 70-85% similitud

    const total = questions.length;
    console.log(`\n⏳ Comparando ${total} preguntas...`);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      // Mostrar progreso cada 25 preguntas
      if ((i + 1) % 25 === 0 || i === total - 1) {
        process.stdout.write(`\r   📊 ${i + 1}/${total} (${Math.round(((i + 1) / total) * 100)}%)`);
      }

      const match = findMatch(q, dbTexts, dbMap, dbFullMap);

      if (!match) {
        nuevas.push(q);
      } else if (match.type === 'posible') {
        posibles.push({ ...q, match });
      } else {
        duplicadas.push({ ...q, match });
      }
    }
    console.log(' ✓');

    // Mostrar resultados agrupados por subtema
    console.log(`\n✅ NUEVAS - No existen en BD (${nuevas.length}):`);
    if (nuevas.length === 0) {
      console.log('   (ninguna)');
    } else {
      // Agrupar nuevas por subtema
      const nuevasPorSubtema = groupBySubtema(nuevas);
      for (const [subtema, pregs] of nuevasPorSubtema) {
        console.log(`\n   📁 ${subtema} (${pregs.length}):`);
        pregs.slice(0, 3).forEach((q, i) => {
          console.log(`      ${i + 1}. ${q.question.substring(0, 55)}...`);
        });
        if (pregs.length > 3) console.log(`      ... y ${pregs.length - 3} más`);
      }
    }

    console.log(`\n❌ DUPLICADAS - Ya existen (${duplicadas.length}):`);
    if (duplicadas.length === 0) {
      console.log('   (ninguna)');
    } else {
      // Agrupar por subtema
      const dupsPorSubtema = groupBySubtema(duplicadas);
      for (const [subtema, pregs] of dupsPorSubtema) {
        const exactas = pregs.filter(p => p.match.confidence >= 95).length;
        const similares = pregs.length - exactas;
        console.log(`   📁 ${subtema}: ${exactas} exactas, ${similares} similares`);
      }
    }

    console.log(`\n⚠️  POSIBLES DUPLICADAS - Revisar (${posibles.length}):`);
    if (posibles.length === 0) {
      console.log('   (ninguna)');
    } else {
      posibles.slice(0, 5).forEach((q, i) => {
        console.log(`   ${i + 1}. [${q.match.confidence}%] ${q.question.substring(0, 50)}...`);
        console.log(`      → BD: ${q.match.dbQuestion.substring(0, 50)}...`);
      });
      if (posibles.length > 5) console.log(`   ... y ${posibles.length - 5} más`);
    }

    // Resumen
    const pct = Math.round((nuevas.length / questions.length) * 100);
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 RESUMEN: ${nuevas.length} nuevas, ${duplicadas.length} duplicadas, ${posibles.length} revisar`);
    console.log(`   ${pct}% son preguntas nuevas`);

    // Opcion de subir
    if (nuevas.length > 0) {
      // Mostrar preview de destino y preparar grupos para subida directa
      const lawName = TOPIC_TO_LAW[topic.name];
      let gruposParaSubir = [];

      if (lawName) {
        const { data: law } = await supabase
          .from('laws')
          .select('id, short_name')
          .eq('short_name', lawName)
          .single();

        if (law) {
          console.log(`\n📍 DESTINO: ${law.short_name} (${law.id.substring(0, 8)}...)`);

          // Preparar grupos para subida directa
          const nuevasPorSubtema = groupBySubtema(nuevas);
          for (const [subtema, pregs] of nuevasPorSubtema) {
            const articulo = await findArticleForSubtema(subtema, law.id, supabase);
            if (articulo) {
              console.log(`   📁 ${subtema} (${pregs.length}) → Art. ${articulo.article_number}: ${articulo.title}`);
              gruposParaSubir.push({ subtema, preguntas: pregs, articulo });
            } else {
              console.log(`   ⚠️  ${subtema} (${pregs.length}) → SIN ARTÍCULO (no se subirán)`);
            }
          }
        }
      } else {
        console.log(`\n⚠️  No hay mapeo de ley para: ${topic.name}`);
      }

      if (gruposParaSubir.length > 0) {
        const subir = await ask('\n¿Subir las nuevas a la BD? (s/n): ');
        if (subir.toLowerCase() === 's') {
          // Subida directa sin menú adicional
          await ejecutarSubida(gruposParaSubir, supabase);
        }
      } else {
        console.log('\n❌ No hay preguntas listas para subir (falta mapeo de artículos)');
      }
    } else {
      await ask('\n[Enter para continuar]');
    }
    console.log('\n');
  }

  rl.close();
  console.log('\n👋 Hasta luego!');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
