import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 VERIFICACIÓN EXHAUSTIVA DE CORRESPONDENCIA PREGUNTAS-ARTÍCULOS EN REGLAMENTOS\n');
  console.log('=' .repeat(80));

  // Primero obtener los IDs de RCD y RS
  const { data: leyes } = await supabase
    .from('laws')
    .select('id, short_name')
    .in('short_name', ['Reglamento del Congreso', 'RCD', 'Reglamento Congreso', 'Reglamento del Senado', 'RS']);

  console.log('📚 Leyes de reglamentos encontradas:');
  leyes?.forEach(l => console.log(`  - [${l.id}] ${l.short_name}`));

  // Para cada ley, analizar TODAS las preguntas activas
  for (const ley of leyes || []) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📖 ANÁLISIS COMPLETO DE: ${ley.short_name} (ID: ${ley.id})`);
    console.log('='.repeat(80));

    // Obtener TODAS las preguntas de esta ley con sus artículos
    const { data: preguntas, error } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        primary_article_id,
        articles!inner(
          id,
          article_number,
          title,
          content,
          law_id
        )
      `)
      .eq('articles.law_id', ley.id)
      .eq('is_active', true);

    if (error) {
      console.log(`❌ Error obteniendo preguntas: ${error.message}`);
      continue;
    }

    if (!preguntas || preguntas.length === 0) {
      console.log('⚠️ No hay preguntas activas para esta ley');
      continue;
    }

    console.log(`\n✅ Total de preguntas activas: ${preguntas.length}\n`);

    // Agrupar preguntas por artículo
    const preguntasPorArticulo = {};
    preguntas.forEach(p => {
      const artNum = p.articles.article_number;
      if (!preguntasPorArticulo[artNum]) {
        preguntasPorArticulo[artNum] = [];
      }
      preguntasPorArticulo[artNum].push(p);
    });

    // Listar todos los artículos que tienen preguntas
    const articulosConPreguntas = Object.keys(preguntasPorArticulo).sort((a, b) => {
      const numA = parseInt(a) || 999;
      const numB = parseInt(b) || 999;
      return numA - numB;
    });

    console.log('📑 ARTÍCULOS QUE TIENEN PREGUNTAS:');
    console.log('-'.repeat(40));
    articulosConPreguntas.forEach(art => {
      const count = preguntasPorArticulo[art].length;
      console.log(`  Artículo ${art}: ${count} pregunta${count > 1 ? 's' : ''}`);
    });

    // Verificar específicamente los artículos que topic_scope dice que deberían estar
    console.log('\n\n🎯 VERIFICACIÓN DE ARTÍCULOS MAPEADOS EN topic_scope:');
    console.log('-'.repeat(40));

    const articulosMapeados = ley.short_name.includes('Congreso')
      ? ['133', '134', '135']  // RCD
      : ['148', '149', '150', '151'];  // RS

    console.log(`Artículos que topic_scope mapea para ${ley.short_name}: ${articulosMapeados.join(', ')}\n`);

    for (const artNum of articulosMapeados) {
      if (preguntasPorArticulo[artNum]) {
        console.log(`✅ Artículo ${artNum}: SÍ tiene ${preguntasPorArticulo[artNum].length} pregunta(s)`);
        // Mostrar un ejemplo
        const ejemplo = preguntasPorArticulo[artNum][0];
        console.log(`   Ejemplo de pregunta: "${ejemplo.question_text.substring(0, 100)}..."`);
      } else {
        console.log(`❌ Artículo ${artNum}: NO tiene preguntas activas`);
      }
    }

    // Mostrar ejemplos detallados de las primeras 3 preguntas para verificar correspondencia
    console.log('\n\n📝 ANÁLISIS DETALLADO DE CORRESPONDENCIA (primeras 3 preguntas):');
    console.log('-'.repeat(60));

    const ejemplos = preguntas.slice(0, 3);
    for (let i = 0; i < ejemplos.length; i++) {
      const p = ejemplos[i];
      console.log(`\n${i + 1}. PREGUNTA ID ${p.id} - Artículo ${p.articles.article_number}`);
      console.log('   ' + '='.repeat(50));

      // Pregunta
      console.log(`\n   📌 PREGUNTA:\n   "${p.question_text}"`);

      // Respuesta correcta
      const respuestaCorrecta = p[`option_${p.correct_option.toLowerCase()}`];
      console.log(`\n   ✅ RESPUESTA CORRECTA (${p.correct_option}):\n   "${respuestaCorrecta}"`);

      // Contenido del artículo (primeros 300 caracteres)
      if (p.articles.content) {
        console.log(`\n   📄 CONTENIDO DEL ARTÍCULO ${p.articles.article_number}:`);
        console.log(`   "${p.articles.content.substring(0, 300)}..."`);

        // Verificar si la respuesta está en el contenido del artículo
        const contenidoNorm = p.articles.content.toLowerCase();
        const respuestaNorm = respuestaCorrecta.toLowerCase();

        // Buscar palabras clave de la respuesta en el artículo
        const palabrasClave = respuestaNorm
          .split(' ')
          .filter(p => p.length > 4)  // palabras de más de 4 letras
          .slice(0, 5);  // primeras 5 palabras clave

        const coincidencias = palabrasClave.filter(palabra =>
          contenidoNorm.includes(palabra)
        );

        console.log(`\n   🔍 ANÁLISIS DE CORRESPONDENCIA:`);
        console.log(`      - Palabras clave de la respuesta: ${palabrasClave.join(', ')}`);
        console.log(`      - Coincidencias encontradas: ${coincidencias.join(', ') || 'NINGUNA'}`);
        console.log(`      - Correspondencia: ${coincidencias.length > 0 ? '✅ SÍ' : '⚠️ DUDOSA'}`);
      }

      // Explicación
      if (p.explanation) {
        console.log(`\n   💡 EXPLICACIÓN:\n   "${p.explanation.substring(0, 200)}..."`);
      }
    }
  }

  // Análisis final: artículos con más preguntas
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESUMEN FINAL: ARTÍCULOS CON MÁS PREGUNTAS EN REGLAMENTOS');
  console.log('='.repeat(80));

  for (const ley of leyes || []) {
    const { data: topArticulos } = await supabase
      .from('questions')
      .select(`
        articles!inner(article_number, law_id)
      `)
      .eq('articles.law_id', ley.id)
      .eq('is_active', true);

    if (topArticulos && topArticulos.length > 0) {
      const conteo = {};
      topArticulos.forEach(q => {
        const art = q.articles.article_number;
        conteo[art] = (conteo[art] || 0) + 1;
      });

      const sorted = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log(`\n${ley.short_name} - TOP 10 artículos con más preguntas:`);
      sorted.forEach(([art, count], i) => {
        console.log(`  ${i + 1}. Artículo ${art}: ${count} preguntas`);
      });
    }
  }

  console.log('\n\n🔍 CONCLUSIONES:');
  console.log('=' .repeat(60));
  console.log('1. Los artículos mapeados en topic_scope (133-135 para RCD, 148-151 para RS)');
  console.log('   necesitan verificación individual para confirmar si tienen preguntas.');
  console.log('2. Hay otros artículos con muchas preguntas que podrían estar mejor mapeados.');
  console.log('3. La correspondencia pregunta-artículo debe verificarse caso por caso.');
})();