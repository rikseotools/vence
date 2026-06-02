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
import { getAdminDb } from '@/db/client';
import { convocatoriasBoe } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
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

import { withErrorLogging } from '@/lib/api/withErrorLogging'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
function getDb() {
  return getAdminDb();
}

async function _GET(request: Request) {
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
  const db = getDb();

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
        const [existe] = await db
          .select({ id: convocatoriasBoe.id })
          .from(convocatoriasBoe)
          .where(eq(convocatoriasBoe.boeId, conv.boeId))
          .limit(1);

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

        // Preparar datos para insertar (claves camelCase = campos Drizzle de
        // convocatorias_boe; validadas contra el schema y el test de paridad)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nuevaConv: Record<string, any> = {
          boeId: conv.boeId,
          boeFecha: formatFecha(fecha),
          boeUrlPdf: conv.urlPdf,
          boeUrlHtml: conv.urlHtml,
          boeUrlXml: conv.urlXml,
          titulo: conv.titulo,
          tituloLimpio: tituloLimpio,
          departamentoCodigo: conv.departamentoCodigo,
          departamentoNombre: conv.departamentoNombre,
          epigrafe: conv.epigrafe,
          tipo,
          categoria,
          cuerpo: null, // Se puede extraer del texto XML
          acceso,
          numPlazas: plazas.total,
          numPlazasLibre: plazas.libre,
          numPlazasPi: plazas.pi,
          numPlazasDiscapacidad: plazas.discapacidad,
          oposicionRelacionada: oposicion,
          // Datos geográficos
          ambito: datosGeo.ambito,
          comunidadAutonoma: datosGeo.comunidadAutonoma,
          provincia: datosGeo.provincia,
          municipio: datosGeo.municipio,
        };

        // Descargar XML para datos adicionales (si está habilitado)
        if (downloadXml && conv.urlXml) {
          try {
            const xmlData = await fetchConvocatoriaXML(conv.boeId);
            stats.xmlDescargados++;

            nuevaConv.fechaDisposicion = xmlData.fechaDisposicion;
            nuevaConv.rango = xmlData.rango;
            nuevaConv.paginaInicial = xmlData.paginaInicial;
            nuevaConv.paginaFinal = xmlData.paginaFinal;
            nuevaConv.contenidoTexto = xmlData.contenidoTexto;

            // Vincular automáticamente a la convocatoria origen si existe
            if (xmlData.referenciasAnteriores.length > 0) {
              const existingRef = await db
                .select({ id: convocatoriasBoe.id, tipo: convocatoriasBoe.tipo })
                .from(convocatoriasBoe)
                .where(and(
                  inArray(convocatoriasBoe.boeId, xmlData.referenciasAnteriores),
                  eq(convocatoriasBoe.isActive, true),
                ));

              if (existingRef && existingRef.length > 0) {
                // Preferir referencia tipo "convocatoria", si no la primera encontrada
                const convocatoriaRef = existingRef.find(r => r.tipo === 'convocatoria') || existingRef[0];
                nuevaConv.convocatoriaOrigenId = convocatoriaRef.id;
                console.log(`  🔗 ${conv.boeId} vinculado a ${xmlData.referenciasAnteriores[0]}`);
              }
            }

            // Extraer datos adicionales del texto
            const datosTexto = extraerDatosDelTexto(xmlData.contenidoTexto);
            nuevaConv.plazoInscripcionDias = datosTexto.plazoInscripcionDias;
            nuevaConv.titulacionRequerida = datosTexto.titulacionRequerida;
            nuevaConv.tieneTemario = datosTexto.tieneTemario;
            nuevaConv.fechaExamen = datosTexto.fechaExamenMencionada;
            nuevaConv.urlBases = datosTexto.urlBases;

            // Extraer datos mejorados del contenido_texto
            if (xmlData.contenidoTexto) {
              // Plazas (prioridad contenido > título)
              const plazasContenido = extraerPlazasDeContenido(xmlData.contenidoTexto);
              if (plazasContenido.total) nuevaConv.numPlazas = plazasContenido.total;
              if (plazasContenido.libre) nuevaConv.numPlazasLibre = plazasContenido.libre;
              if (plazasContenido.pi) nuevaConv.numPlazasPi = plazasContenido.pi;
              if (plazasContenido.discapacidad) nuevaConv.numPlazasDiscapacidad = plazasContenido.discapacidad;

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
                numPlazas: nuevaConv.numPlazas,
                numPlazasLibre: nuevaConv.numPlazasLibre,
                numPlazasPI: nuevaConv.numPlazasPi,
                acceso: nuevaConv.acceso,
                departamento: nuevaConv.departamentoNombre,
                comunidadAutonoma: nuevaConv.comunidadAutonoma,
                municipio: nuevaConv.municipio,
                plazoInscripcion: nuevaConv.plazoInscripcionDias,
                titulacion: nuevaConv.titulacionRequerida,
              });
            }

            // Pequeña pausa para no saturar el servidor del BOE
            await sleep(100);
          } catch (xmlError) {
            console.warn(`⚠️ [sync-convocatorias] Error descargando XML ${conv.boeId}:`, xmlError);
          }
        }

        // Calcular relevancia
        nuevaConv.relevanciaScore = calcularRelevancia({
          tipo,
          categoria,
          oposicionRelacionada: oposicion,
          numPlazas: plazas.total,
          departamentoNombre: conv.departamentoNombre
        });

        // Insertar en BD
        let insertError = null;
        try {
          await db.insert(convocatoriasBoe).values(nuevaConv as typeof convocatoriasBoe.$inferInsert);
        } catch (e) {
          insertError = e;
        }

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
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'}/api/emails/send-admin-notification`, {
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

export const GET = withErrorLogging('/api/cron/sync-convocatorias', _GET)
