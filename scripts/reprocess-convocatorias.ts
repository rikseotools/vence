/**
 * Script para reprocesar todas las convocatorias existentes con el parser mejorado
 *
 * Uso:
 *   npx tsx scripts/reprocess-convocatorias.ts
 *   npx tsx scripts/reprocess-convocatorias.ts --dry-run   # Solo mostrar cambios sin guardar
 *   npx tsx scripts/reprocess-convocatorias.ts --limit 100 # Procesar solo 100
 */

import { createClient } from '@supabase/supabase-js';
import {
  extraerPlazasDeContenido,
  extraerPlazas,
  detectarCategoriaDeContenido,
  detectarCategoria,
  detectarAccesoDeContenido,
  detectarAcceso,
  detectarTipo,
  detectarOposicion,
  extraerDatosDelTexto,
  extraerDatosGeograficos,
  calcularRelevancia,
  limpiarTitulo,
  generarResumen,
  type TipoConvocatoria,
  type Categoria,
  type TipoAcceso,
} from '../lib/boe/convocatoriasParser';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Parse args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf('--limit') + 1]) : null;

interface Convocatoria {
  id: string;
  titulo: string;
  titulo_limpio: string | null;
  departamento_nombre: string | null;
  contenido_texto: string | null;
  tipo: string | null;
  categoria: string | null;
  acceso: string | null;
  num_plazas: number | null;
  num_plazas_libre: number | null;
  num_plazas_pi: number | null;
  num_plazas_discapacidad: number | null;
  oposicion_relacionada: string | null;
  resumen: string | null;
  plazo_inscripcion_dias: number | null;
  titulacion_requerida: string | null;
  tiene_temario: boolean | null;
  relevancia_score: number | null;
  ambito: string | null;
  comunidad_autonoma: string | null;
  provincia: string | null;
  municipio: string | null;
}

interface UpdateData {
  tipo?: string;
  categoria?: string;
  acceso?: string;
  num_plazas?: number;
  num_plazas_libre?: number;
  num_plazas_pi?: number;
  num_plazas_discapacidad?: number;
  oposicion_relacionada?: string;
  resumen?: string;
  titulo_limpio?: string;
  plazo_inscripcion_dias?: number;
  titulacion_requerida?: string;
  tiene_temario?: boolean;
  relevancia_score?: number;
  ambito?: string;
  comunidad_autonoma?: string;
  provincia?: string;
  municipio?: string;
  updated_at?: string;
}

// Estadísticas globales
const stats = {
  total: 0,
  conContenido: 0,
  sinContenido: 0,
  actualizadas: 0,
  sinCambios: 0,
  errores: 0,
  mejoras: {
    plazas: 0,
    categoria: 0,
    acceso: 0,
    resumen: 0,
    geografico: 0,
    oposicion: 0,
  }
};

function procesarConvocatoria(conv: Convocatoria): UpdateData | null {
  if (!conv.contenido_texto) {
    stats.sinContenido++;
    return null;
  }

  stats.conContenido++;
  const updates: UpdateData = {};

  // 1. Extraer plazas (prioridad contenido > título)
  const plazasContenido = extraerPlazasDeContenido(conv.contenido_texto);
  const plazasTitulo = extraerPlazas(conv.titulo);

  const numPlazas = plazasContenido.total || plazasTitulo.total;
  const numPlazasLibre = plazasContenido.libre || plazasTitulo.libre;
  const numPlazasPI = plazasContenido.pi || plazasTitulo.pi;
  const numPlazasDisc = plazasContenido.discapacidad || plazasTitulo.discapacidad;

  if (numPlazas && numPlazas !== conv.num_plazas) {
    updates.num_plazas = numPlazas;
    stats.mejoras.plazas++;
  }
  if (numPlazasLibre && numPlazasLibre !== conv.num_plazas_libre) {
    updates.num_plazas_libre = numPlazasLibre;
  }
  if (numPlazasPI && numPlazasPI !== conv.num_plazas_pi) {
    updates.num_plazas_pi = numPlazasPI;
  }
  if (numPlazasDisc && numPlazasDisc !== conv.num_plazas_discapacidad) {
    updates.num_plazas_discapacidad = numPlazasDisc;
  }

  // 2. Extraer categoría (prioridad contenido > título)
  const categoriaContenido = detectarCategoriaDeContenido(conv.contenido_texto);
  const categoriaTitulo = detectarCategoria(conv.titulo, '');
  const categoria = categoriaContenido || categoriaTitulo;

  if (categoria && categoria !== conv.categoria) {
    updates.categoria = categoria;
    stats.mejoras.categoria++;
  }

  // 3. Extraer acceso
  const accesoContenido = detectarAccesoDeContenido(conv.contenido_texto);
  const accesoTitulo = detectarAcceso(conv.titulo);
  const acceso = accesoContenido || accesoTitulo;

  if (acceso && acceso !== conv.acceso) {
    updates.acceso = acceso;
    stats.mejoras.acceso++;
  }

  // 4. Detectar tipo
  const tipo = detectarTipo(conv.titulo);
  if (tipo && tipo !== conv.tipo) {
    updates.tipo = tipo;
  }

  // 5. Detectar oposición relacionada
  const oposicion = detectarOposicion(conv.titulo, conv.departamento_nombre || '');
  if (oposicion && oposicion !== conv.oposicion_relacionada) {
    updates.oposicion_relacionada = oposicion;
    stats.mejoras.oposicion++;
  }

  // 6. Extraer datos del texto
  const datosTexto = extraerDatosDelTexto(conv.contenido_texto);

  if (datosTexto.plazoInscripcionDias && datosTexto.plazoInscripcionDias !== conv.plazo_inscripcion_dias) {
    updates.plazo_inscripcion_dias = datosTexto.plazoInscripcionDias;
  }
  if (datosTexto.titulacionRequerida && datosTexto.titulacionRequerida !== conv.titulacion_requerida) {
    updates.titulacion_requerida = datosTexto.titulacionRequerida;
  }
  if (datosTexto.tieneTemario !== conv.tiene_temario) {
    updates.tiene_temario = datosTexto.tieneTemario;
  }

  // 7. Extraer datos geográficos
  const datosGeo = extraerDatosGeograficos(conv.titulo, conv.departamento_nombre || '');

  if (datosGeo.ambito && datosGeo.ambito !== conv.ambito) {
    updates.ambito = datosGeo.ambito;
    stats.mejoras.geografico++;
  }
  if (datosGeo.comunidadAutonoma && datosGeo.comunidadAutonoma !== conv.comunidad_autonoma) {
    updates.comunidad_autonoma = datosGeo.comunidadAutonoma;
  }
  if (datosGeo.provincia && datosGeo.provincia !== conv.provincia) {
    updates.provincia = datosGeo.provincia;
  }
  if (datosGeo.municipio && datosGeo.municipio !== conv.municipio) {
    updates.municipio = datosGeo.municipio;
  }

  // 8. Limpiar título
  const tituloLimpio = limpiarTitulo(conv.titulo);
  if (tituloLimpio !== conv.titulo && tituloLimpio !== conv.titulo_limpio) {
    updates.titulo_limpio = tituloLimpio;
  }

  // 9. Generar resumen
  const resumen = generarResumen({
    tipo: (updates.tipo || conv.tipo) as TipoConvocatoria | null,
    categoria: (updates.categoria || conv.categoria) as Categoria | null,
    numPlazas: updates.num_plazas || conv.num_plazas,
    numPlazasLibre: updates.num_plazas_libre || conv.num_plazas_libre,
    numPlazasPI: updates.num_plazas_pi || conv.num_plazas_pi,
    acceso: (updates.acceso || conv.acceso) as TipoAcceso | null,
    departamento: conv.departamento_nombre,
    comunidadAutonoma: updates.comunidad_autonoma || conv.comunidad_autonoma,
    municipio: updates.municipio || conv.municipio,
    plazoInscripcion: updates.plazo_inscripcion_dias || conv.plazo_inscripcion_dias,
    titulacion: updates.titulacion_requerida || conv.titulacion_requerida,
  });

  if (resumen && resumen !== conv.resumen && resumen !== '.') {
    updates.resumen = resumen;
    if (!conv.resumen) {
      stats.mejoras.resumen++;
    }
  }

  // 10. Calcular relevancia
  const relevancia = calcularRelevancia({
    tipo: (updates.tipo || conv.tipo) as TipoConvocatoria | null,
    categoria: (updates.categoria || conv.categoria) as Categoria | null,
    oposicionRelacionada: updates.oposicion_relacionada || conv.oposicion_relacionada,
    numPlazas: updates.num_plazas || conv.num_plazas,
    departamentoNombre: conv.departamento_nombre || undefined,
  });

  if (relevancia !== conv.relevancia_score) {
    updates.relevancia_score = relevancia;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

async function main() {
  console.log('🔄 Reprocesando convocatorias con parser mejorado...\n');

  if (isDryRun) {
    console.log('⚠️  MODO DRY-RUN: No se guardarán cambios\n');
  }

  if (limit) {
    console.log(`📊 Límite: ${limit} convocatorias\n`);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const BATCH_SIZE = 500;
  let offset = 0;
  let hasMore = true;
  let batchNum = 0;

  while (hasMore) {
    // Si hay límite y ya lo alcanzamos, salir
    if (limit && stats.total >= limit) {
      break;
    }

    const batchLimit = limit ? Math.min(BATCH_SIZE, limit - stats.total) : BATCH_SIZE;

    const { data: convocatorias, error } = await supabase
      .from('convocatorias_boe')
      .select('id, titulo, titulo_limpio, departamento_nombre, contenido_texto, tipo, categoria, acceso, num_plazas, num_plazas_libre, num_plazas_pi, num_plazas_discapacidad, oposicion_relacionada, resumen, plazo_inscripcion_dias, titulacion_requerida, tiene_temario, relevancia_score, ambito, comunidad_autonoma, provincia, municipio')
      .eq('is_active', true)
      .order('boe_fecha', { ascending: false })
      .range(offset, offset + batchLimit - 1);

    if (error) {
      console.error('❌ Error obteniendo batch:', error);
      process.exit(1);
    }

    if (!convocatorias || convocatorias.length === 0) {
      hasMore = false;
      break;
    }

    batchNum++;
    console.log(`📦 Batch ${batchNum}: procesando ${convocatorias.length} convocatorias...`);

    // Procesar batch
    for (const conv of convocatorias) {
      stats.total++;

      try {
        const updates = procesarConvocatoria(conv);

        if (updates) {
          updates.updated_at = new Date().toISOString();

          if (!isDryRun) {
            const { error: updateError } = await supabase
              .from('convocatorias_boe')
              .update(updates)
              .eq('id', conv.id);

            if (updateError) {
              stats.errores++;
            } else {
              stats.actualizadas++;
            }
          } else {
            stats.actualizadas++;
          }
        } else {
          stats.sinCambios++;
        }
      } catch (err) {
        stats.errores++;
      }
    }

    // Avanzar al siguiente batch
    offset += convocatorias.length;

    if (convocatorias.length < batchLimit) {
      hasMore = false;
    }

    // Pequeña pausa entre batches para no saturar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Mostrar estadísticas finales
  console.log('\n' + '='.repeat(60));
  console.log('📊 ESTADÍSTICAS FINALES');
  console.log('='.repeat(60));
  console.log(`Total procesadas:     ${stats.total}`);
  console.log(`Con contenido_texto:  ${stats.conContenido}`);
  console.log(`Sin contenido_texto:  ${stats.sinContenido}`);
  console.log(`Actualizadas:         ${stats.actualizadas}`);
  console.log(`Sin cambios:          ${stats.sinCambios}`);
  console.log(`Errores:              ${stats.errores}`);
  console.log('');
  console.log('Mejoras encontradas:');
  console.log(`  - Plazas extraídas:     ${stats.mejoras.plazas}`);
  console.log(`  - Categorías detectadas: ${stats.mejoras.categoria}`);
  console.log(`  - Acceso detectado:      ${stats.mejoras.acceso}`);
  console.log(`  - Resúmenes generados:   ${stats.mejoras.resumen}`);
  console.log(`  - Datos geográficos:     ${stats.mejoras.geografico}`);
  console.log(`  - Oposiciones enlazadas: ${stats.mejoras.oposicion}`);

  if (isDryRun) {
    console.log('\n⚠️  Modo dry-run: ningún cambio fue guardado');
    console.log('   Ejecuta sin --dry-run para aplicar los cambios');
  }
}

main().catch(console.error);
