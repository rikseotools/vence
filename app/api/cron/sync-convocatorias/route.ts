/**
 * API Cron: Sincronización de Convocatorias del BOE
 *
 * Endpoint: GET /api/cron/sync-convocatorias
 * Params:
 *   - fecha: YYYYMMDD (opcional, default: hoy)
 *   - downloadXml: boolean (opcional, default: true)
 *
 * Requiere: Authorization: Bearer {CRON_SECRET}
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchBoeSumario,
  fetchConvocatoriaXML,
  type ConvocatoriaBOE
} from '@/lib/boe/convocatoriasFetcher';
import {
  detectarTipo,
  detectarCategoria,
  detectarCategoriaDeContenido,
  detectarOposicion,
  extraerPlazas,
  extraerPlazasDeContenido,
  detectarAcceso,
  detectarAccesoDeContenido,
  extraerDatosDelTexto,
  calcularRelevancia,
  limpiarTitulo,
  extraerDatosGeograficos,
  generarResumen
} from '@/lib/boe/convocatoriasParser';

// Crear cliente Supabase con service role key (bypass RLS)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function GET(request: Request) {
  // 1. Verificar autorización
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    console.error('❌ [sync-convocatorias] Unauthorized request');
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    // 2. Obtener parámetros
    const url = new URL(request.url);
    const fechaParam = url.searchParams.get('fecha');
    const downloadXml = url.searchParams.get('downloadXml') !== 'false';

    // Fecha por defecto: hoy en formato YYYYMMDD
    const today = new Date();
    const fecha = fechaParam || [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('');

    console.log(`🔍 [sync-convocatorias] Sincronizando fecha: ${fecha}`);

    // 3. Fetch del BOE
    let convocatoriasBOE: ConvocatoriaBOE[];
    try {
      convocatoriasBOE = await fetchBoeSumario(fecha);
    } catch (error: any) {
      // Si es fin de semana o festivo, el BOE no tiene sumario
      if (error.message.includes('404') || error.message.includes('No se ha localizado')) {
        console.log(`📅 [sync-convocatorias] No hay BOE para fecha ${fecha} (fin de semana/festivo)`);
        return NextResponse.json({
          success: true,
          fecha,
          message: 'No hay BOE publicado para esta fecha',
          stats: { total: 0, nuevas: 0, existentes: 0, errores: 0 },
          duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }

    console.log(`📄 [sync-convocatorias] Encontradas ${convocatoriasBOE.length} publicaciones en sección 2B`);

    // 4. Procesar cada convocatoria
    const stats = {
      total: convocatoriasBOE.length,
      nuevas: 0,
      existentes: 0,
      errores: 0,
      xmlDescargados: 0
    };
    const nuevasRelevantes: any[] = [];

    for (const conv of convocatoriasBOE) {
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

        // Parsear datos básicos del título
        const tipo = detectarTipo(conv.titulo);
        const categoria = detectarCategoria(conv.titulo, conv.epigrafe);
        const oposicion = detectarOposicion(conv.titulo, conv.departamentoNombre);
        const plazas = extraerPlazas(conv.titulo);
        const acceso = detectarAcceso(conv.titulo);
        const tituloLimpio = limpiarTitulo(conv.titulo);
        const datosGeo = extraerDatosGeograficos(conv.titulo, conv.departamentoNombre);

        // Preparar datos para insertar
        const nuevaConv: Record<string, any> = {
          boe_id: conv.boeId,
          boe_fecha: formatFecha(fecha),
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
          cuerpo: null, // Se puede extraer del texto XML
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

        // Descargar XML para datos adicionales (si está habilitado)
        if (downloadXml && conv.urlXml) {
          try {
            const xmlData = await fetchConvocatoriaXML(conv.boeId);
            stats.xmlDescargados++;

            nuevaConv.fecha_disposicion = xmlData.fechaDisposicion;
            nuevaConv.rango = xmlData.rango;
            nuevaConv.pagina_inicial = xmlData.paginaInicial;
            nuevaConv.pagina_final = xmlData.paginaFinal;
            nuevaConv.contenido_texto = xmlData.contenidoTexto;

            // Vincular automáticamente a la convocatoria origen si existe
            if (xmlData.referenciasAnteriores.length > 0) {
              const { data: existingRef } = await supabase
                .from('convocatorias_boe')
                .select('id, tipo')
                .in('boe_id', xmlData.referenciasAnteriores)
                .eq('is_active', true);

              if (existingRef && existingRef.length > 0) {
                // Preferir referencia tipo "convocatoria", si no la primera encontrada
                const convocatoriaRef = existingRef.find(r => r.tipo === 'convocatoria') || existingRef[0];
                nuevaConv.convocatoria_origen_id = convocatoriaRef.id;
                console.log(`  🔗 ${conv.boeId} vinculado a ${xmlData.referenciasAnteriores[0]}`);
              }
            }

            // Extraer datos adicionales del texto
            const datosTexto = extraerDatosDelTexto(xmlData.contenidoTexto);
            nuevaConv.plazo_inscripcion_dias = datosTexto.plazoInscripcionDias;
            nuevaConv.titulacion_requerida = datosTexto.titulacionRequerida;
            nuevaConv.tiene_temario = datosTexto.tieneTemario;
            nuevaConv.fecha_examen = datosTexto.fechaExamenMencionada;
            nuevaConv.url_bases = datosTexto.urlBases;

            // Extraer datos mejorados del contenido_texto
            if (xmlData.contenidoTexto) {
              // Plazas (prioridad contenido > título)
              const plazasContenido = extraerPlazasDeContenido(xmlData.contenidoTexto);
              if (plazasContenido.total) nuevaConv.num_plazas = plazasContenido.total;
              if (plazasContenido.libre) nuevaConv.num_plazas_libre = plazasContenido.libre;
              if (plazasContenido.pi) nuevaConv.num_plazas_pi = plazasContenido.pi;
              if (plazasContenido.discapacidad) nuevaConv.num_plazas_discapacidad = plazasContenido.discapacidad;

              // Categoría (prioridad contenido > título)
              const categoriaContenido = detectarCategoriaDeContenido(xmlData.contenidoTexto);
              if (categoriaContenido) nuevaConv.categoria = categoriaContenido;

              // Acceso (prioridad contenido > título)
              const accesoContenido = detectarAccesoDeContenido(xmlData.contenidoTexto);
              if (accesoContenido) nuevaConv.acceso = accesoContenido;

              // Generar resumen estructurado
              nuevaConv.resumen = generarResumen({
                tipo: nuevaConv.tipo,
                categoria: nuevaConv.categoria,
                numPlazas: nuevaConv.num_plazas,
                numPlazasLibre: nuevaConv.num_plazas_libre,
                numPlazasPI: nuevaConv.num_plazas_pi,
                acceso: nuevaConv.acceso,
                departamento: nuevaConv.departamento_nombre,
                comunidadAutonoma: nuevaConv.comunidad_autonoma,
                municipio: nuevaConv.municipio,
                plazoInscripcion: nuevaConv.plazo_inscripcion_dias,
                titulacion: nuevaConv.titulacion_requerida,
              });
            }

            // Pequeña pausa para no saturar el servidor del BOE
            await sleep(100);
          } catch (xmlError) {
            console.warn(`⚠️ [sync-convocatorias] Error descargando XML ${conv.boeId}:`, xmlError);
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

        // Insertar en BD
        const { error: insertError } = await supabase
          .from('convocatorias_boe')
          .insert(nuevaConv);

        if (insertError) {
          console.error(`❌ [sync-convocatorias] Error insertando ${conv.boeId}:`, insertError);
          stats.errores++;
          continue;
        }

        stats.nuevas++;

        // Si es relevante para nuestras oposiciones, guardar para notificación
        if (oposicion && tipo === 'convocatoria') {
          nuevasRelevantes.push({
            boeId: conv.boeId,
            titulo: tituloLimpio,
            oposicion,
            plazas: plazas.total,
            departamento: conv.departamentoNombre
          });
        }

      } catch (err: any) {
        console.error(`❌ [sync-convocatorias] Error procesando ${conv.boeId}:`, err.message);
        stats.errores++;
      }
    }

    // 5. Notificar admin si hay convocatorias relevantes
    if (nuevasRelevantes.length > 0 && process.env.ADMIN_EMAIL) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_URL}/api/emails/send-admin-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nueva_convocatoria',
            adminEmail: process.env.ADMIN_EMAIL,
            data: {
              fecha,
              convocatorias: nuevasRelevantes,
              stats
            }
          })
        });
        console.log(`📧 [sync-convocatorias] Notificación enviada: ${nuevasRelevantes.length} convocatorias relevantes`);
      } catch (emailError) {
        console.warn('⚠️ [sync-convocatorias] Error enviando email:', emailError);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ [sync-convocatorias] Completado en ${duration}s - Nuevas: ${stats.nuevas}, Existentes: ${stats.existentes}, Errores: ${stats.errores}`);

    return NextResponse.json({
      success: true,
      fecha,
      stats,
      nuevasRelevantes: nuevasRelevantes.length,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [sync-convocatorias] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Formatea fecha YYYYMMDD a YYYY-MM-DD
 */
function formatFecha(fecha: string): string {
  if (fecha.length !== 8) return fecha;
  return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
