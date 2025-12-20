/**
 * Script de diagnóstico para analizar por qué un usuario no ve todos los temas en modo aleatorio
 *
 * Uso:
 *   node scripts/diagnose-user-themes.js <email_del_usuario>
 *
 * Ejemplo:
 *   node scripts/diagnose-user-themes.js nila@example.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const THEMES = [
  { id: 1, name: "La Constitución Española de 1978" },
  { id: 2, name: "El Tribunal Constitucional. La Corona" },
  { id: 3, name: "Las Cortes Generales" },
  { id: 4, name: "El Poder Judicial" },
  { id: 5, name: "El Gobierno y la Administración" },
  { id: 6, name: "El Gobierno Abierto. Agenda 2030" },
  { id: 7, name: "Ley 19/2013 de Transparencia" },
  { id: 8, name: "La Administración General del Estado" },
  { id: 9, name: "La Organización Territorial del Estado" },
  { id: 10, name: "La Organización de la Unión Europea" },
  { id: 11, name: "Las Leyes del Procedimiento Administrativo Común" },
  { id: 12, name: "La Protección de Datos Personales" },
  { id: 13, name: "El Personal Funcionario de las Administraciones Públicas" },
  { id: 14, name: "Derechos y Deberes de los Funcionarios" },
  { id: 15, name: "El Presupuesto del Estado en España" },
  { id: 16, name: "Políticas de Igualdad y contra la Violencia de Género" }
];

async function diagnoseUser(emailQuery) {
  try {
    console.log(`\n🔍 Buscando usuario con email que contenga: "${emailQuery}"\n`);

    // 1. Buscar usuario por email
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .ilike('email', `%${emailQuery}%`)
      .limit(5);

    if (profileError) {
      console.error('❌ Error buscando usuario:', profileError.message);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('❌ No se encontraron usuarios con ese email');
      console.log('💡 Intenta con otro término de búsqueda');
      return;
    }

    if (profiles.length > 1) {
      console.log('⚠️  Se encontraron múltiples usuarios:');
      profiles.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.email} (${p.full_name || 'Sin nombre'})`);
      });
      console.log('\n⚠️  Por favor, especifica más el email');
      return;
    }

    const user = profiles[0];
    console.log(`✅ Usuario encontrado: ${user.email} (${user.full_name || 'Sin nombre'})`);
    console.log(`   ID: ${user.id}\n`);

    // 2. Obtener estadísticas por tema usando la MISMA query que usa aleatorio/page.js
    console.log('📊 Cargando estadísticas por tema...\n');

    const { data: responses, error: responsesError } = await supabase
      .from('test_questions')
      .select('tema_number, is_correct, created_at, question_id, tests!inner(user_id)')
      .eq('tests.user_id', user.id);

    if (responsesError) {
      console.error('❌ Error obteniendo respuestas:', responsesError.message);
      console.log('\n🐛 DEBUG INFO:');
      console.log('   Error code:', responsesError.code);
      console.log('   Error details:', responsesError.details);
      console.log('   Error hint:', responsesError.hint);
      return;
    }

    console.log(`✅ Total de respuestas encontradas: ${responses?.length || 0}\n`);

    if (!responses || responses.length === 0) {
      console.log('⚠️  El usuario no tiene ninguna respuesta registrada');
      console.log('💡 El usuario debe completar al menos un test para que aparezca en modo aleatorio');
      return;
    }

    // 3. Agrupar por tema (igual que aleatorio/page.js líneas 178-205)
    const themeStats = {};

    responses.forEach(response => {
      const theme = response.tema_number;
      if (!theme) {
        console.log('⚠️  Encontrada respuesta sin tema_number:', response.question_id);
        return;
      }

      if (!themeStats[theme]) {
        themeStats[theme] = {
          total: 0,
          correct: 0,
          lastStudy: null
        };
      }

      themeStats[theme].total++;
      if (response.is_correct) {
        themeStats[theme].correct++;
      }

      const studyDate = new Date(response.created_at);
      if (!themeStats[theme].lastStudy || studyDate > themeStats[theme].lastStudy) {
        themeStats[theme].lastStudy = studyDate;
      }
    });

    // 4. Calcular accuracy
    Object.keys(themeStats).forEach(theme => {
      const stats = themeStats[theme];
      stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    // 5. Determinar qué temas califican para modo aleatorio
    console.log('📋 ANÁLISIS DE TEMAS:\n');
    console.log('Requisitos para aparecer en modo aleatorio:');
    console.log('  • Mínimo 10 preguntas respondidas');
    console.log('  • Más del 10% de aciertos\n');
    console.log('='.repeat(80));

    let qualifiedCount = 0;
    let notQualifiedCount = 0;

    THEMES.forEach(theme => {
      const stats = themeStats[theme.id];
      const qualifies = stats && stats.total >= 10 && stats.accuracy > 10;

      if (stats && stats.total > 0) {
        const status = qualifies ? '✅ SÍ APARECE' : '❌ NO APARECE';
        const reason = !qualifies
          ? (stats.total < 10
              ? `(solo ${stats.total} preguntas, faltan ${10 - stats.total})`
              : `(accuracy ${stats.accuracy}% ≤ 10%)`)
          : '';

        console.log(`\nTema ${theme.id}: ${theme.name}`);
        console.log(`  Estado: ${status} ${reason}`);
        console.log(`  Preguntas respondidas: ${stats.total}`);
        console.log(`  Aciertos: ${stats.correct}/${stats.total} (${stats.accuracy}%)`);
        console.log(`  Última vez estudiado: ${stats.lastStudy ? new Date(stats.lastStudy).toLocaleDateString('es-ES') : 'Nunca'}`);

        if (qualifies) qualifiedCount++;
        else notQualifiedCount++;
      } else {
        console.log(`\nTema ${theme.id}: ${theme.name}`);
        console.log(`  Estado: ❌ NO APARECE (nunca estudiado)`);
        notQualifiedCount++;
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RESUMEN:`);
    console.log(`   ✅ Temas que SÍ aparecen en modo aleatorio: ${qualifiedCount}`);
    console.log(`   ❌ Temas que NO aparecen: ${notQualifiedCount}`);
    console.log(`   📝 Total de preguntas respondidas: ${responses.length}`);

    if (qualifiedCount === 0) {
      console.log('\n⚠️  DIAGNÓSTICO: El usuario NO verá ningún tema en modo aleatorio');
      console.log('💡 SOLUCIÓN: Debe estudiar temas individuales primero (mínimo 10 preguntas por tema con >10% aciertos)');
    } else if (notQualifiedCount > 0) {
      console.log(`\n✅ DIAGNÓSTICO: El comportamiento es CORRECTO`);
      console.log(`   El usuario ve ${qualifiedCount} temas porque son los únicos que ha estudiado suficientemente.`);
      console.log(`\n💡 Para ver más temas, debe:`);
      console.log(`   1. Ir a "Tests por tema"`);
      console.log(`   2. Seleccionar un tema nuevo`);
      console.log(`   3. Responder al menos 10 preguntas`);
      console.log(`   4. Conseguir más del 10% de aciertos`);
    } else {
      console.log('\n✅ DIAGNÓSTICO: El usuario ve TODOS los temas (ha estudiado todos)');
    }

    console.log('\n');

  } catch (error) {
    console.error('💥 Error inesperado:', error.message);
    console.error(error);
  }
}

// Ejecutar
const emailQuery = process.argv[2];

if (!emailQuery) {
  console.log('❌ Error: Debes proporcionar un email');
  console.log('\n📖 Uso:');
  console.log('   node scripts/diagnose-user-themes.js <email_del_usuario>');
  console.log('\nEjemplo:');
  console.log('   node scripts/diagnose-user-themes.js nila@example.com');
  console.log('   node scripts/diagnose-user-themes.js nila  (busca emails que contengan "nila")');
  process.exit(1);
}

diagnoseUser(emailQuery);
