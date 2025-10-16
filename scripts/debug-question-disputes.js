import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugQuestionDisputes() {
  try {
    console.log('🔍 DEBUGGING SISTEMA DE IMPUGNACIONES\n');
    
    // 1. Verificar constraint de tabla
    console.log('1. ✅ VERIFICANDO CONSTRAINTS EN question_disputes...');
    const { data: constraints, error: constraintError } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT 
            conname as constraint_name,
            pg_get_constraintdef(c.oid) as constraint_definition
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'question_disputes' 
          AND n.nspname = 'public'
          AND contype = 'u'
        `
      });

    if (constraintError) {
      console.log('⚠️ No se pudo ejecutar RPC, probando directo...');
      
      // Método alternativo
      const { data: tableInfo, error: tableError } = await supabase
        .from('question_disputes')
        .select('*')
        .limit(1);
        
      if (tableError) {
        console.error('❌ Error accediendo a question_disputes:', tableError);
        return;
      }
      console.log('✅ Tabla question_disputes existe y es accesible');
    } else {
      console.log('✅ Constraints encontrados:');
      constraints?.forEach(c => {
        console.log(`   - ${c.constraint_name}: ${c.constraint_definition}`);
      });
    }

    // 2. Buscar impugnaciones duplicadas existentes
    console.log('\n2. 🔎 BUSCANDO IMPUGNACIONES DUPLICADAS...');
    const { data: duplicates, error: dupError } = await supabase
      .from('question_disputes')
      .select('question_id, user_id, status, created_at, resolved_at')
      .order('question_id, user_id, created_at');

    if (dupError) {
      console.error('❌ Error buscando duplicados:', dupError);
      return;
    }

    // Analizar duplicados
    const userQuestionCombos = {};
    const actualDuplicates = [];

    duplicates?.forEach(dispute => {
      const key = `${dispute.user_id}-${dispute.question_id}`;
      if (userQuestionCombos[key]) {
        userQuestionCombos[key].push(dispute);
        actualDuplicates.push({
          key,
          disputes: userQuestionCombos[key]
        });
      } else {
        userQuestionCombos[key] = [dispute];
      }
    });

    if (actualDuplicates.length > 0) {
      console.log(`❌ ENCONTRADOS ${actualDuplicates.length} casos con múltiples impugnaciones:`);
      actualDuplicates.forEach(dup => {
        console.log(`\n   🔴 User-Question: ${dup.key}`);
        dup.disputes.forEach((d, i) => {
          console.log(`      ${i + 1}. Estado: ${d.status}, Creada: ${d.created_at}, Resuelta: ${d.resolved_at || 'N/A'}`);
        });
      });
    } else {
      console.log('✅ No se encontraron impugnaciones duplicadas');
    }

    // 3. Verificar estados de impugnaciones resueltas
    console.log('\n3. 📊 ESTADÍSTICAS DE IMPUGNACIONES...');
    const { data: stats, error: statsError } = await supabase
      .from('question_disputes')
      .select('status, created_at')
      .order('created_at desc');

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError);
      return;
    }

    const statusCount = {};
    stats?.forEach(s => {
      statusCount[s.status] = (statusCount[s.status] || 0) + 1;
    });

    console.log('   Estados de impugnaciones:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`      - ${status}: ${count} impugnaciones`);
    });

    // 4. Verificar impugnaciones recientes con errores
    console.log('\n4. 🕐 IMPUGNACIONES RECIENTES (últimas 10)...');
    const { data: recent, error: recentError } = await supabase
      .from('question_disputes')
      .select('id, question_id, user_id, status, dispute_type, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('❌ Error obteniendo recientes:', recentError);
      return;
    }

    recent?.forEach((r, i) => {
      console.log(`   ${i + 1}. ID: ${r.id.substring(0, 8)}... | Estado: ${r.status} | Tipo: ${r.dispute_type} | Creada: ${r.created_at.substring(0, 16)}`);
    });

    // 5. Probar inserción de prueba para ver error exacto
    console.log('\n5. 🧪 PRUEBA DE INSERCIÓN (será cancelada)...');
    try {
      // Intentar insertar una impugnación duplicada de prueba
      const testUserId = '12345678-1234-1234-1234-123456789012'; // ID ficticio
      const testQuestionId = '87654321-4321-4321-4321-210987654321'; // ID ficticio

      // Primero insertar una
      const { data: first, error: firstError } = await supabase
        .from('question_disputes')
        .insert({
          question_id: testQuestionId,
          user_id: testUserId,
          dispute_type: 'test',
          description: 'Test de duplicado',
          status: 'pending'
        })
        .select();

      if (firstError) {
        console.log('   ⚠️ Error en primera inserción (normal):', firstError.message);
      } else {
        console.log('   ✅ Primera inserción exitosa, intentando duplicado...');
        
        // Intentar insertar el duplicado
        const { data: second, error: secondError } = await supabase
          .from('question_disputes')
          .insert({
            question_id: testQuestionId,
            user_id: testUserId,
            dispute_type: 'test_duplicate',
            description: 'Test de duplicado 2',
            status: 'pending'
          });

        if (secondError) {
          console.log('   ✅ CONSTRAINT FUNCIONANDO - Error esperado:', secondError.message);
        } else {
          console.log('   ❌ PROBLEMA: El duplicado se insertó sin error');
        }

        // Limpiar las pruebas
        await supabase
          .from('question_disputes')
          .delete()
          .eq('user_id', testUserId);
        
        console.log('   🧹 Datos de prueba limpiados');
      }
    } catch (testError) {
      console.log('   ⚠️ Error en prueba:', testError.message);
    }

    console.log('\n📋 RESUMEN DEL DIAGNÓSTICO:');
    console.log('   - Tabla question_disputes es accesible ✅');
    console.log(`   - Total impugnaciones: ${stats?.length || 0}`);
    console.log(`   - Posibles duplicados encontrados: ${actualDuplicates.length}`);
    
    if (actualDuplicates.length > 0) {
      console.log('\n🔧 RECOMENDACIÓN:');
      console.log('   Hay impugnaciones duplicadas en la BD. Considerar:');
      console.log('   1. Verificar/recrear constraint único');
      console.log('   2. Limpiar duplicados existentes');
      console.log('   3. Revisar lógica de frontend');
    }

  } catch (error) {
    console.error('❌ Error general en diagnóstico:', error);
  }
}

// Ejecutar diagnóstico
debugQuestionDisputes();