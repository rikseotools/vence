#!/usr/bin/env npx tsx

/**
 * Script para hacer backfill de convocatorias del BOE
 *
 * Uso:
 *   npx tsx scripts/backfill-convocatorias.ts --desde 2025-01-01 --hasta 2025-12-31
 *   npx tsx scripts/backfill-convocatorias.ts --fecha 2025-06-15
 *
 * Requiere:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DELAY_BETWEEN_DAYS = 500; // ms entre cada día
const DELAY_BETWEEN_XML = 100; // ms entre cada descarga XML

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Importar funciones del proyecto
import {
  fetchBoeSumario,
  fetchConvocatoriaXML,
  generarRangoFechas
} from '../lib/boe/convocatoriasFetcher';
import {
  detectarTipo,
  detectarCategoria,
  detectarOposicion,
  extraerPlazas,
  detectarAcceso,
  extraerDatosDelTexto,
  calcularRelevancia,
  limpiarTitulo,
  extraerDatosGeograficos
} from '../lib/boe/convocatoriasParser';

// Parsear argumentos
const args = process.argv.slice(2);
let desde: string | null = null;
let hasta: string | null = null;
let fechaUnica: string | null = null;
let downloadXml = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--desde' && args[i + 1]) {
    desde = args[i + 1];
    i++;
  } else if (args[i] === '--hasta' && args[i + 1]) {
    hasta = args[i + 1];
    i++;
  } else if (args[i] === '--fecha' && args[i + 1]) {
    fechaUnica = args[i + 1];
    i++;
  } else if (args[i] === '--no-xml') {
    downloadXml = false;
  }
}

// Validar
if (!fechaUnica && (!desde || !hasta)) {
  console.log(`
Uso:
  npx tsx scripts/backfill-convocatorias.ts --desde YYYY-MM-DD --hasta YYYY-MM-DD [--no-xml]
  npx tsx scripts/backfill-convocatorias.ts --fecha YYYY-MM-DD [--no-xml]

Opciones:
  --desde      Fecha de inicio (inclusive)
  --hasta      Fecha de fin (inclusive)
  --fecha      Procesar solo una fecha
  --no-xml     No descargar XML (más rápido, menos datos)

Ejemplo:
  npx tsx scripts/backfill-convocatorias.ts --desde 2025-01-01 --hasta 2025-12-31
  `);
  process.exit(1);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatFechaISO(fecha: string): string {
  // YYYYMMDD -> YYYY-MM-DD
  if (fecha.length === 8 && !fecha.includes('-')) {
    return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
  }
  return fecha;
}

function formatFechaBOE(fecha: string): string {
  // YYYY-MM-DD -> YYYYMMDD
  return fecha.replace(/-/g, '');
}

async function procesarFecha(fecha: string): Promise<{
  procesadas: number;
  nuevas: number;
  existentes: number;
  errores: number;
}> {
  const fechaBOE = formatFechaBOE(fecha);
  const stats = { procesadas: 0, nuevas: 0, existentes: 0, errores: 0 };

  try {
    console.log(`\n📅 Procesando ${fecha}...`);

    const convocatorias = await fetchBoeSumario(fechaBOE);
    stats.procesadas = convocatorias.length;

    if (convocatorias.length === 0) {
      console.log(`   ⚪ Sin publicaciones en sección 2B`);
      return stats;
    }

    console.log(`   📄 ${convocatorias.length} publicaciones encontradas`);

    for (const conv of convocatorias) {
      try {
        // Verificar si ya existe
        const { data: existe } = await supabase
          .from('convocatorias_boe')
          .select('id')
          .eq('boe_id', conv.boeId)
          .single();

        if (existe) {
          stats.existentes++;
          continue;
        }

        // Parsear datos básicos
        const tipo = detectarTipo(conv.titulo);
        const categoria = detectarCategoria(conv.titulo, conv.epigrafe);
        const oposicion = detectarOposicion(conv.titulo, conv.departamentoNombre);
        const plazas = extraerPlazas(conv.titulo);
        const acceso = detectarAcceso(conv.titulo);
        const tituloLimpio = limpiarTitulo(conv.titulo);
        const datosGeo = extraerDatosGeograficos(conv.titulo, conv.departamentoNombre);

        const nuevaConv: Record<string, any> = {
          boe_id: conv.boeId,
          boe_fecha: formatFechaISO(fechaBOE),
          boe_url_pdf: conv.urlPdf,
          boe_url_html: conv.urlHtml,
          boe_url_xml: conv.urlXml,
          titulo: conv.titulo,
          titulo_limpio: tituloLimpio,
          departamento_codigo: conv.departamentoCodigo,
          departamento_nombre: conv.departamentoNombre,
          epigrafe: conv.epigrafe,
          tipo,
          categoria,
          acceso,
          num_plazas: plazas.total,
          num_plazas_libre: plazas.libre,
          num_plazas_pi: plazas.pi,
          num_plazas_discapacidad: plazas.discapacidad,
          oposicion_relacionada: oposicion,
          // Datos geográficos
          ambito: datosGeo.ambito,
          comunidad_autonoma: datosGeo.comunidadAutonoma,
          provincia: datosGeo.provincia,
          municipio: datosGeo.municipio,
        };

        // Descargar XML si está habilitado
        if (downloadXml && conv.urlXml) {
          try {
            const xmlData = await fetchConvocatoriaXML(conv.boeId);

            nuevaConv.fecha_disposicion = xmlData.fechaDisposicion;
            nuevaConv.rango = xmlData.rango;
            nuevaConv.pagina_inicial = xmlData.paginaInicial;
            nuevaConv.pagina_final = xmlData.paginaFinal;
            nuevaConv.contenido_texto = xmlData.contenidoTexto;

            const datosTexto = extraerDatosDelTexto(xmlData.contenidoTexto);
            nuevaConv.plazo_inscripcion_dias = datosTexto.plazoInscripcionDias;
            nuevaConv.titulacion_requerida = datosTexto.titulacionRequerida;
            nuevaConv.tiene_temario = datosTexto.tieneTemario;
            nuevaConv.fecha_examen = datosTexto.fechaExamenMencionada;
            nuevaConv.url_bases = datosTexto.urlBases;

            await sleep(DELAY_BETWEEN_XML);
          } catch (xmlError: any) {
            console.warn(`   ⚠️ Error XML ${conv.boeId}: ${xmlError.message}`);
          }
        }

        // Calcular relevancia
        nuevaConv.relevancia_score = calcularRelevancia({
          tipo,
          categoria,
          oposicionRelacionada: oposicion,
          numPlazas: plazas.total,
          departamentoNombre: conv.departamentoNombre
        });

        // Insertar
        const { error: insertError } = await supabase
          .from('convocatorias_boe')
          .insert(nuevaConv);

        if (insertError) {
          console.error(`   ❌ Error insertando ${conv.boeId}: ${insertError.message}`);
          stats.errores++;
        } else {
          stats.nuevas++;
          // Mostrar si es relevante
          if (oposicion) {
            console.log(`   ✅ ${conv.boeId} - ${tipo} - ${oposicion}`);
          }
        }

      } catch (err: any) {
        console.error(`   ❌ Error ${conv.boeId}: ${err.message}`);
        stats.errores++;
      }
    }

    console.log(`   📊 Nuevas: ${stats.nuevas} | Existentes: ${stats.existentes} | Errores: ${stats.errores}`);

  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('No se ha localizado')) {
      console.log(`   ⚪ Sin BOE (fin de semana/festivo)`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      stats.errores++;
    }
  }

  return stats;
}

async function main() {
  console.log('🚀 Backfill de Convocatorias BOE');
  console.log('================================');

  let fechas: string[];

  if (fechaUnica) {
    fechas = [formatFechaBOE(fechaUnica)];
    console.log(`📅 Fecha: ${fechaUnica}`);
  } else {
    fechas = generarRangoFechas(desde!, hasta!);
    console.log(`📅 Desde: ${desde}`);
    console.log(`📅 Hasta: ${hasta}`);
    console.log(`📅 Días laborables: ${fechas.length}`);
  }

  console.log(`📥 Descargar XML: ${downloadXml ? 'Sí' : 'No'}`);
  console.log('');

  const totales = {
    procesadas: 0,
    nuevas: 0,
    existentes: 0,
    errores: 0,
    diasProcesados: 0
  };

  const startTime = Date.now();

  for (const fecha of fechas) {
    const stats = await procesarFecha(formatFechaISO(fecha));

    totales.procesadas += stats.procesadas;
    totales.nuevas += stats.nuevas;
    totales.existentes += stats.existentes;
    totales.errores += stats.errores;
    totales.diasProcesados++;

    // Pausa entre días
    await sleep(DELAY_BETWEEN_DAYS);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n================================');
  console.log('📊 RESUMEN FINAL');
  console.log('================================');
  console.log(`   Días procesados: ${totales.diasProcesados}`);
  console.log(`   Total publicaciones: ${totales.procesadas}`);
  console.log(`   Nuevas insertadas: ${totales.nuevas}`);
  console.log(`   Ya existentes: ${totales.existentes}`);
  console.log(`   Errores: ${totales.errores}`);
  console.log(`   Duración: ${duration} minutos`);
  console.log('================================');
}

main().catch(console.error);
