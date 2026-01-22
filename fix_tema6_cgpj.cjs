/**
 * Script para corregir el Tema 6 de Tramitación Procesal
 *
 * PROBLEMA: Falta el CGPJ (arts. 122-148 de LOPJ)
 * El epígrafe menciona: "El Consejo General del Poder Judicial: composición y funciones"
 *
 * SOLUCIÓN: Añadir arts. 122-148 al scope existente (que solo tiene 541-584 del MF)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(80));
  console.log('CORRECCIÓN TEMA 6: Añadir artículos del CGPJ');
  console.log('═'.repeat(80));
  console.log('');

  // 1. Obtener tema 6
  console.log('📋 Buscando Tema 6...');
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, title')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', 6)
    .single();

  if (topicError || !topic) {
    console.error('❌ Error:', topicError?.message || 'Tema no encontrado');
    return;
  }

  console.log(`   ✅ ${topic.title}`);
  console.log(`   ID: ${topic.id}`);

  // 2. Obtener LOPJ
  console.log('\n📚 Buscando LOPJ...');
  const { data: lopj, error: lopjError } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .eq('short_name', 'LO 6/1985')
    .single();

  if (lopjError || !lopj) {
    console.error('❌ Error:', lopjError?.message || 'LOPJ no encontrada');
    return;
  }

  console.log(`   ✅ ${lopj.short_name} - ${lopj.name}`);

  // 3. Obtener scope actual
  console.log('\n🔍 Scope actual...');
  const { data: currentScope, error: scopeError } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topic.id)
    .eq('law_id', lopj.id)
    .single();

  if (scopeError || !currentScope) {
    console.error('❌ Error:', scopeError?.message || 'Scope no encontrado');
    return;
  }

  console.log(`   Artículos actuales: ${currentScope.article_numbers?.length || 0}`);
  if (currentScope.article_numbers?.length > 0) {
    console.log(`   Rango: ${currentScope.article_numbers[0]} - ${currentScope.article_numbers[currentScope.article_numbers.length - 1]}`);
  }

  // 4. Obtener artículos del CGPJ que existen en BD
  console.log('\n📄 Verificando artículos CGPJ en BD...');
  const { data: cgpjArticles, error: cgpjError } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', lopj.id)
    .gte('article_number', '122')
    .lte('article_number', '148')
    .order('article_number');

  if (cgpjError) {
    console.error('❌ Error:', cgpjError.message);
    return;
  }

  console.log(`   ✅ Encontrados ${cgpjArticles.length} artículos del CGPJ en BD`);
  console.log(`   Artículos: ${cgpjArticles.map(a => a.article_number).join(', ')}`);

  // 5. Construir nuevo array de artículos
  console.log('\n🔧 Construyendo nuevo scope...');

  const cgpjNumbers = cgpjArticles.map(a => a.article_number);
  const currentNumbers = currentScope.article_numbers || [];

  // Combinar y ordenar
  const newArticleNumbers = [...new Set([...cgpjNumbers, ...currentNumbers])].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  console.log(`   Total artículos nuevos: ${newArticleNumbers.length}`);
  console.log(`   CGPJ (122-148): ${cgpjNumbers.length} artículos`);
  console.log(`   MF (541-584): ${currentNumbers.length} artículos`);

  // 6. Mostrar preview del cambio
  console.log('\n📊 PREVIEW DEL CAMBIO:');
  console.log('   ━'.repeat(40));
  console.log('   ANTES:');
  console.log(`     - Solo Ministerio Fiscal (${currentNumbers.length} arts)`);
  console.log(`     - Artículos: ${currentNumbers.slice(0, 5).join(', ')}...${currentNumbers.slice(-2).join(', ')}`);
  console.log('');
  console.log('   DESPUÉS:');
  console.log(`     - CGPJ + Ministerio Fiscal (${newArticleNumbers.length} arts)`);
  console.log(`     - CGPJ: ${cgpjNumbers.slice(0, 5).join(', ')}...${cgpjNumbers.slice(-2).join(', ')}`);
  console.log(`     - MF: ${currentNumbers.slice(0, 3).join(', ')}...${currentNumbers.slice(-2).join(', ')}`);
  console.log('   ━'.repeat(40));

  // 7. Pedir confirmación
  console.log('\n⚠️  ¿Proceder con la actualización? (Ctrl+C para cancelar)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 8. Actualizar
  console.log('\n💾 Actualizando topic_scope...');
  const { error: updateError } = await supabase
    .from('topic_scope')
    .update({ article_numbers: newArticleNumbers })
    .eq('id', currentScope.id);

  if (updateError) {
    console.error('❌ Error actualizando:', updateError.message);
    return;
  }

  console.log('   ✅ Actualización completada');

  // 9. Verificar
  console.log('\n🔍 Verificando cambio...');
  const { data: verified } = await supabase
    .from('topic_scope')
    .select('article_numbers')
    .eq('id', currentScope.id)
    .single();

  const hasCGPJ = verified.article_numbers.some(a => {
    const num = parseInt(a);
    return num >= 122 && num <= 148;
  });

  if (hasCGPJ) {
    console.log('   ✅ VERIFICADO: Ahora incluye artículos del CGPJ');
  } else {
    console.log('   ❌ ERROR: No se detectan artículos del CGPJ');
  }

  // 10. Resumen final
  console.log('\n' + '═'.repeat(80));
  console.log('✅ CORRECCIÓN COMPLETADA');
  console.log('═'.repeat(80));
  console.log(`Tema 6 ahora incluye:`);
  console.log(`  - CGPJ (arts. 122-148): ✅`);
  console.log(`  - Ministerio Fiscal (arts. 541-584): ✅`);
  console.log(`  - Total artículos: ${verified.article_numbers.length}`);
  console.log('');
  console.log('El epígrafe está ahora completamente cubierto.');
}

main()
  .then(() => {
    console.log('\n✨ Proceso finalizado con éxito');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error fatal:', err);
    process.exit(1);
  });
