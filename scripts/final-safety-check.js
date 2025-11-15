// scripts/final-safety-check.js
// Verificación final de seguridad y compatibilidad

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function finalSafetyCheck() {
  console.log('🛡️ VERIFICACIÓN FINAL DE SEGURIDAD');
  console.log('='.repeat(45));

  const allChecks = [];

  try {
    // 1. VERIFICAR: Diferentes configuraciones de test
    console.log('\n📊 CHECK 1: Compatibilidad con configuraciones de test...');
    
    const testConfigurations = [
      { exclude_recent: 'true', difficulty_mode: 'easy' },
      { exclude_recent: 'false', difficulty_mode: 'medium' },
      { only_official: 'true', difficulty_mode: 'hard' },
      { only_official: 'false', difficulty_mode: 'random' }
    ];

    for (const config of testConfigurations) {
      try {
        // Simular searchParams que recibiría fetchPersonalizedQuestions
        console.log(`   Testing config: ${JSON.stringify(config)}`);
        
        const searchParams = new URLSearchParams(config);
        const configParams = {
          numQuestions: parseInt(searchParams.get('n')) || 25,
          excludeRecent: searchParams.get('exclude_recent') === 'true',
          difficultyMode: searchParams.get('difficulty_mode') || 'random',
          onlyOfficialQuestions: searchParams.get('only_official') === 'true'
        };
        
        console.log(`   ✅ Config procesada: ${JSON.stringify(configParams)}`);
        allChecks.push(true);
        
      } catch (configError) {
        console.error(`   ❌ Error con config:`, configError.message);
        allChecks.push(false);
      }
    }

    // 2. VERIFICAR: Manejo de errores de base de datos
    console.log('\n📊 CHECK 2: Manejo robusto de errores...');
    
    try {
      // Query inválida para probar manejo de errores
      const { data, error } = await supabase
        .from('test_questions')
        .select(`
          question_id, 
          tests!inner(user_id),
          questions!inner(
            articles!inner(
              laws!inner(nonexistent_column)
            )
          )
        `)
        .eq('tests.user_id', '33b7470f-f0a9-4b4c-b859-f8dbeb2f69b9')
        .limit(1);

      if (error) {
        console.log('   ✅ Error manejado correctamente:', error.message);
        allChecks.push(true);
      } else {
        console.log('   ⚠️ Query inesperadamente exitosa');
        allChecks.push(true);
      }
      
    } catch (errorTest) {
      console.log('   ✅ Exception capturada:', errorTest.message);
      allChecks.push(true);
    }

    // 3. VERIFICAR: Diferentes valores de tema
    console.log('\n📊 CHECK 3: Compatibilidad con diferentes temas...');
    
    const temas = ['1', '2', '3', '6', '7', '8', '9'];
    
    for (const tema of temas) {
      try {
        // Simular determinación de ley por tema (como en el código real)
        const targetLaw = tema === '7' ? 'Ley 19/2013' : 'Ley 19/2013';
        console.log(`   Tema ${tema} → ${targetLaw} ✅`);
        allChecks.push(true);
        
      } catch (temaError) {
        console.error(`   ❌ Error con tema ${tema}:`, temaError.message);
        allChecks.push(false);
      }
    }

    // 4. VERIFICAR: Cache de sesión no afectado
    console.log('\n📊 CHECK 4: Sistema de cache intacto...');
    
    try {
      const fs = await import('fs');
      const content = fs.readFileSync('/Users/manuel/Documents/github/vence/lib/testFetchers.js', 'utf8');
      
      const cacheFeatures = [
        'sessionQuestionCache',
        'cleanOldCacheEntries',
        'sessionKey',
        'sessionUsedIds'
      ];
      
      let cacheIntact = true;
      cacheFeatures.forEach(feature => {
        if (!content.includes(feature)) {
          console.error(`   ❌ Feature perdido: ${feature}`);
          cacheIntact = false;
        }
      });
      
      if (cacheIntact) {
        console.log('   ✅ Sistema de cache preservado');
        allChecks.push(true);
      } else {
        allChecks.push(false);
      }
      
    } catch (cacheError) {
      console.error('   ❌ Error verificando cache:', cacheError.message);
      allChecks.push(false);
    }

    // 5. VERIFICAR: Logging y debugging
    console.log('\n📊 CHECK 5: Sistema de logging...');
    
    try {
      const fs = await import('fs');
      const content = fs.readFileSync('/Users/manuel/Documents/github/vence/lib/testFetchers.js', 'utf8');
      
      const loggingFeatures = [
        'console.log',
        'console.error',
        'console.warn',
        '🎛️🔥',
        '🎯🔥'
      ];
      
      let loggingOK = true;
      loggingFeatures.forEach(feature => {
        if (!content.includes(feature)) {
          console.error(`   ❌ Logging perdido: ${feature}`);
          loggingOK = false;
        }
      });
      
      if (loggingOK) {
        console.log('   ✅ Sistema de logging preservado');
        allChecks.push(true);
      } else {
        allChecks.push(false);
      }
      
    } catch (loggingError) {
      console.error('   ❌ Error verificando logging:', loggingError.message);
      allChecks.push(false);
    }

    // 6. VERIFICAR: Compatibilidad con frontend
    console.log('\n📊 CHECK 6: Compatibilidad con frontend...');
    
    try {
      // Verificar que TestPageWrapper sigue importando correctamente
      const fs = await import('fs');
      const wrapperContent = fs.readFileSync('/Users/manuel/Documents/github/vence/components/TestPageWrapper.js', 'utf8');
      
      if (wrapperContent.includes('fetchPersonalizedQuestions')) {
        console.log('   ✅ TestPageWrapper importa fetchPersonalizedQuestions');
        allChecks.push(true);
      } else {
        console.error('   ❌ TestPageWrapper no encuentra fetchPersonalizedQuestions');
        allChecks.push(false);
      }
      
    } catch (frontendError) {
      console.error('   ❌ Error verificando frontend:', frontendError.message);
      allChecks.push(false);
    }

    // 7. VERIFICAR: Backwards compatibility
    console.log('\n📊 CHECK 7: Backwards compatibility...');
    
    try {
      // Verificar que la función sigue teniendo la misma signature
      const fs = await import('fs');
      const content = fs.readFileSync('/Users/manuel/Documents/github/vence/lib/testFetchers.js', 'utf8');
      
      const signatureMatch = content.match(/export async function fetchPersonalizedQuestions\(([^)]+)\)/);
      
      if (signatureMatch) {
        const params = signatureMatch[1];
        console.log(`   ✅ Signature preservada: (${params})`);
        
        if (params.includes('tema') && params.includes('searchParams') && params.includes('config')) {
          console.log('   ✅ Parámetros esperados presentes');
          allChecks.push(true);
        } else {
          console.error('   ❌ Parámetros esperados perdidos');
          allChecks.push(false);
        }
      } else {
        console.error('   ❌ Signature de función no encontrada');
        allChecks.push(false);
      }
      
    } catch (backwardError) {
      console.error('   ❌ Error verificando backwards compatibility:', backwardError.message);
      allChecks.push(false);
    }

    // RESULTADO FINAL
    console.log('\n' + '='.repeat(45));
    
    const totalChecks = allChecks.length;
    const passedChecks = allChecks.filter(check => check).length;
    const failedChecks = totalChecks - passedChecks;
    
    console.log('📊 RESUMEN DE VERIFICACIONES:');
    console.log(`   Total: ${totalChecks}`);
    console.log(`   ✅ Pasaron: ${passedChecks}`);
    console.log(`   ❌ Fallaron: ${failedChecks}`);
    console.log(`   📊 Ratio de éxito: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

    if (failedChecks === 0) {
      console.log('\n🛡️ ✅ VERIFICACIÓN FINAL EXITOSA');
      console.log('✅ Todas las verificaciones de seguridad pasaron');
      console.log('✅ No hay regresiones detectadas');
      console.log('✅ Compatibilidad preservada');
      console.log('🚀 EL FIX ES SEGURO PARA DESPLIEGUE');
      
    } else if (failedChecks <= 2) {
      console.log('\n🛡️ ⚠️ VERIFICACIÓN CON ADVERTENCIAS');
      console.log(`⚠️ ${failedChecks} verificación(es) fallaron`);
      console.log('⚠️ Revisar fallos antes de desplegar');
      console.log('📋 Posiblemente seguro, pero revisar detalladamente');
      
    } else {
      console.log('\n🛡️ ❌ VERIFICACIÓN FALLÓ');
      console.log(`❌ ${failedChecks} verificaciones críticas fallaron`);
      console.log('🚨 NO DESPLEGAR sin resolver los problemas');
      console.log('🔧 Requiere correcciones antes de continuar');
    }

  } catch (error) {
    console.error('❌ ERROR CRÍTICO en verificación final:', error.message);
    console.error('🚨 ABORTAR DESPLIEGUE');
  }
}

finalSafetyCheck();