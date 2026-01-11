#!/usr/bin/env npx tsx

/**
 * Script para actualizar convocatorias existentes con datos geográficos
 *
 * Uso:
 *   npx tsx scripts/update-convocatorias-geo.ts
 */

import { createClient } from '@supabase/supabase-js';
import { extraerDatosGeograficos } from '../lib/boe/convocatoriasParser';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🔄 Actualizando datos geográficos de convocatorias existentes...\n');

  // Obtener convocatorias sin datos geográficos
  const { data: convocatorias, error } = await supabase
    .from('convocatorias_boe')
    .select('id, titulo, departamento_nombre, ambito')
    .is('ambito', null)
    .limit(1000);

  if (error) {
    console.error('❌ Error obteniendo convocatorias:', error);
    process.exit(1);
  }

  console.log(`📋 Encontradas ${convocatorias?.length || 0} convocatorias sin datos geográficos\n`);

  let actualizadas = 0;
  let errores = 0;

  for (const conv of convocatorias || []) {
    try {
      const datosGeo = extraerDatosGeograficos(
        conv.titulo,
        conv.departamento_nombre || ''
      );

      // Solo actualizar si hay datos
      if (datosGeo.ambito || datosGeo.comunidadAutonoma || datosGeo.provincia || datosGeo.municipio) {
        const { error: updateError } = await supabase
          .from('convocatorias_boe')
          .update({
            ambito: datosGeo.ambito,
            comunidad_autonoma: datosGeo.comunidadAutonoma,
            provincia: datosGeo.provincia,
            municipio: datosGeo.municipio,
          })
          .eq('id', conv.id);

        if (updateError) {
          console.error(`❌ Error actualizando ${conv.id}:`, updateError.message);
          errores++;
        } else {
          actualizadas++;
          if (datosGeo.comunidadAutonoma) {
            console.log(`✅ ${conv.id}: ${datosGeo.ambito} - ${datosGeo.comunidadAutonoma}${datosGeo.provincia ? ` (${datosGeo.provincia})` : ''}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`❌ Error procesando ${conv.id}:`, err.message);
      errores++;
    }
  }

  console.log('\n================================');
  console.log('📊 RESUMEN');
  console.log('================================');
  console.log(`   Actualizadas: ${actualizadas}`);
  console.log(`   Errores: ${errores}`);
  console.log('================================');
}

main().catch(console.error);
