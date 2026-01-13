/**
 * Script para enriquecer convocatorias con referencias del BOE
 * Extrae las referencias "anteriores" del XML del BOE para vincular
 * publicaciones relacionadas (admitidos, tribunal, etc.) a su convocatoria original
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos service role para updates masivos
);

// Configuración
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 200; // ms - respetar rate limits del BOE
const MAX_RETRIES = 3;

/**
 * Espera un tiempo determinado
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch del XML del BOE con reintentos
 */
async function fetchBoeXml(boeId, retries = 0) {
  const url = `https://www.boe.es/diario_boe/xml.php?id=${boeId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Vence-Oposiciones/1.0 (Educational Platform)',
        'Accept': 'application/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`  ⚠️ Reintento ${retries + 1} para ${boeId}...`);
      await sleep(1000 * (retries + 1)); // Backoff exponencial
      return fetchBoeXml(boeId, retries + 1);
    }
    throw error;
  }
}

/**
 * Extrae referencias "anteriores" del XML del BOE
 * Busca patrones como: <anterior referencia="BOE-A-2023-26357">
 */
function extractReferences(xml) {
  const references = [];

  // Patrón para encontrar referencias anteriores
  const anteriorPattern = /<anterior[^>]*referencia="([^"]+)"[^>]*>/gi;
  let match;

  while ((match = anteriorPattern.exec(xml)) !== null) {
    const ref = match[1];
    if (ref && ref.startsWith('BOE-')) {
      references.push(ref);
    }
  }

  // También buscar en el texto por si hay formato diferente
  const boePattern = /referencia[^>]*>([^<]*BOE-[A-Z]-\d{4}-\d+)/gi;
  while ((match = boePattern.exec(xml)) !== null) {
    const ref = match[1].match(/BOE-[A-Z]-\d{4}-\d+/)?.[0];
    if (ref && !references.includes(ref)) {
      references.push(ref);
    }
  }

  return [...new Set(references)]; // Eliminar duplicados
}

/**
 * Procesa un lote de convocatorias
 */
async function processBatch(convocatorias, stats) {
  for (const conv of convocatorias) {
    try {
      // Fetch XML del BOE
      const xml = await fetchBoeXml(conv.boe_id);

      // Extraer referencias
      const references = extractReferences(xml);

      if (references.length > 0) {
        // Buscar si alguna referencia existe en nuestra BD
        const { data: existingRefs } = await supabase
          .from('convocatorias_boe')
          .select('id, boe_id, tipo')
          .in('boe_id', references)
          .eq('is_active', true);

        if (existingRefs && existingRefs.length > 0) {
          // Preferir convocatoria original, si no, la primera referencia
          const convocatoriaRef = existingRefs.find(r => r.tipo === 'convocatoria') || existingRefs[0];

          // Actualizar con la referencia encontrada
          const { error } = await supabase
            .from('convocatorias_boe')
            .update({
              convocatoria_origen_id: convocatoriaRef.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', conv.id);

          if (error) {
            console.log(`  ❌ Error actualizando ${conv.boe_id}: ${error.message}`);
            stats.errors++;
          } else {
            console.log(`  ✅ ${conv.boe_id} → ${convocatoriaRef.boe_id} (${convocatoriaRef.tipo})`);
            stats.linked++;
          }
        } else {
          // Referencias encontradas pero no existen en nuestra BD
          console.log(`  ⚪ ${conv.boe_id}: refs ${references.join(', ')} no encontradas en BD`);
          stats.refsNotFound++;
        }
      } else {
        // Sin referencias en el XML
        stats.noRefs++;
      }

      stats.processed++;

      // Delay entre requests
      await sleep(DELAY_BETWEEN_REQUESTS);

    } catch (error) {
      console.log(`  ❌ Error procesando ${conv.boe_id}: ${error.message}`);
      stats.errors++;
    }
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🔗 Enriquecimiento de referencias BOE');
  console.log('=====================================\n');

  // Estadísticas
  const stats = {
    total: 0,
    processed: 0,
    linked: 0,
    noRefs: 0,
    refsNotFound: 0,
    errors: 0
  };

  // Contar total de publicaciones sin vincular (excluir convocatorias originales)
  const { count: totalSinVincular } = await supabase
    .from('convocatorias_boe')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('convocatoria_origen_id', null)
    .neq('tipo', 'convocatoria'); // Las convocatorias no necesitan vínculo

  stats.total = totalSinVincular || 0;
  console.log(`📊 Total publicaciones sin vincular: ${stats.total}\n`);

  if (stats.total === 0) {
    console.log('✅ Todas las publicaciones ya están vinculadas!');
    return;
  }

  // Procesar en lotes
  let offset = 0;
  let batchNum = 1;

  while (offset < stats.total) {
    console.log(`\n📦 Lote ${batchNum} (${offset + 1} - ${Math.min(offset + BATCH_SIZE, stats.total)} de ${stats.total})`);
    console.log('-'.repeat(50));

    // Obtener lote
    const { data: batch, error } = await supabase
      .from('convocatorias_boe')
      .select('id, boe_id, tipo, titulo')
      .eq('is_active', true)
      .is('convocatoria_origen_id', null)
      .neq('tipo', 'convocatoria')
      .order('boe_fecha', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Error obteniendo lote:', error);
      break;
    }

    if (!batch || batch.length === 0) {
      break;
    }

    // Procesar lote
    await processBatch(batch, stats);

    offset += BATCH_SIZE;
    batchNum++;

    // Mostrar progreso
    const percent = ((stats.processed / stats.total) * 100).toFixed(1);
    console.log(`\n📈 Progreso: ${percent}% (${stats.processed}/${stats.total})`);
    console.log(`   ✅ Vinculados: ${stats.linked} | ⚪ Sin refs: ${stats.noRefs} | 🔍 Refs no en BD: ${stats.refsNotFound} | ❌ Errores: ${stats.errors}`);
  }

  // Resumen final
  console.log('\n\n🏁 RESUMEN FINAL');
  console.log('='.repeat(50));
  console.log(`📊 Total procesados: ${stats.processed}`);
  console.log(`✅ Vinculados exitosamente: ${stats.linked}`);
  console.log(`⚪ Sin referencias en XML: ${stats.noRefs}`);
  console.log(`🔍 Referencias no encontradas en BD: ${stats.refsNotFound}`);
  console.log(`❌ Errores: ${stats.errors}`);

  const successRate = stats.processed > 0 ? ((stats.linked / stats.processed) * 100).toFixed(1) : 0;
  console.log(`\n📈 Tasa de vinculación: ${successRate}%`);
}

// Ejecutar
main().catch(console.error);
