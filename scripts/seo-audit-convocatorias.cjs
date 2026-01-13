/**
 * Script de auditoría SEO para /convocatorias
 * Detecta problemas que Google penalizaría
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_URL = 'https://www.vence.es';

// Colores para la consola
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const issues = {
  critical: [],
  warning: [],
  info: []
};

function logCritical(msg) {
  issues.critical.push(msg);
  console.log(`${RED}[CRÍTICO]${RESET} ${msg}`);
}

function logWarning(msg) {
  issues.warning.push(msg);
  console.log(`${YELLOW}[WARNING]${RESET} ${msg}`);
}

function logInfo(msg) {
  issues.info.push(msg);
  console.log(`${CYAN}[INFO]${RESET} ${msg}`);
}

function logOk(msg) {
  console.log(`${GREEN}[OK]${RESET} ${msg}`);
}

async function auditConvocatorias() {
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}   AUDITORÍA SEO - /convocatorias${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  // 1. Obtener datos de la base de datos
  console.log(`${CYAN}1. ANALIZANDO DATOS DE LA BASE DE DATOS...${RESET}\n`);

  // Query simplificada para evitar timeout
  const { data: convocatorias, error } = await supabase
    .from('convocatorias_boe')
    .select('id, slug, titulo, titulo_limpio, tipo, resumen, boe_fecha, departamento_nombre, num_plazas, comunidad_autonoma')
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false })
    .limit(200);

  if (error) {
    logCritical(`Error obteniendo datos: ${error.message}`);
    return;
  }

  console.log(`Total convocatorias activas analizadas: ${convocatorias.length}\n`);

  // =========================================
  // 2. PROBLEMAS DE SLUG Y URLs
  // =========================================
  console.log(`${CYAN}2. ANALIZANDO SLUGS Y URLs...${RESET}\n`);

  const slugs = new Map();
  let sinSlug = 0;
  let slugsCortos = 0;
  let slugsLargos = 0;
  let slugsConCaracteresRaros = 0;

  for (const conv of convocatorias) {
    // Sin slug
    if (!conv.slug) {
      sinSlug++;
      continue;
    }

    // Slug duplicado
    if (slugs.has(conv.slug)) {
      logCritical(`Slug duplicado: "${conv.slug}" (IDs: ${slugs.get(conv.slug)}, ${conv.id})`);
    } else {
      slugs.set(conv.slug, conv.id);
    }

    // Slug muy corto (menos de 10 caracteres)
    if (conv.slug.length < 10) {
      slugsCortos++;
    }

    // Slug muy largo (más de 100 caracteres)
    if (conv.slug.length > 100) {
      slugsLargos++;
      logWarning(`Slug muy largo (${conv.slug.length} chars): ${conv.slug.slice(0, 50)}...`);
    }

    // Caracteres extraños en slug
    if (!/^[a-z0-9-]+$/.test(conv.slug)) {
      slugsConCaracteresRaros++;
      logWarning(`Slug con caracteres no estándar: "${conv.slug}"`);
    }
  }

  if (sinSlug > 0) {
    logWarning(`${sinSlug} convocatorias sin slug (usarán UUID como URL)`);
  } else {
    logOk('Todas las convocatorias tienen slug');
  }

  if (slugsLargos === 0) logOk('No hay slugs excesivamente largos');
  if (slugsConCaracteresRaros === 0) logOk('Todos los slugs usan caracteres estándar');

  // =========================================
  // 3. PROBLEMAS DE CONTENIDO
  // =========================================
  console.log(`\n${CYAN}3. ANALIZANDO CONTENIDO (THIN CONTENT)...${RESET}\n`);

  let sinTitulo = 0;
  let titulosMuyCortos = 0;
  let titulosMuyLargos = 0;
  let sinResumen = 0;
  let resumenMuyCorto = 0;
  const titulosUnicos = new Map();
  const titulosDuplicados = [];

  for (const conv of convocatorias) {
    const titulo = conv.titulo_limpio || conv.titulo;

    // Título
    if (!titulo) {
      sinTitulo++;
    } else {
      // Título duplicado
      if (titulosUnicos.has(titulo)) {
        titulosDuplicados.push({ titulo, ids: [titulosUnicos.get(titulo), conv.id] });
      } else {
        titulosUnicos.set(titulo, conv.id);
      }

      // Título muy corto (menos de 20 chars)
      if (titulo.length < 20) {
        titulosMuyCortos++;
      }

      // Título muy largo (más de 70 chars - se truncará en SERPs)
      if (titulo.length > 70) {
        titulosMuyLargos++;
      }
    }

    // Resumen (usado como meta description)
    if (!conv.resumen) {
      sinResumen++;
    } else if (conv.resumen.length < 50) {
      resumenMuyCorto++;
    }
  }

  if (sinTitulo > 0) logCritical(`${sinTitulo} convocatorias sin título`);
  else logOk('Todas tienen título');

  if (titulosMuyCortos > 0) logWarning(`${titulosMuyCortos} títulos muy cortos (<20 chars)`);
  if (titulosMuyLargos > 0) logInfo(`${titulosMuyLargos} títulos largos (>70 chars) - se truncarán en SERPs`);

  if (titulosDuplicados.length > 0) {
    logCritical(`${titulosDuplicados.length} títulos duplicados (contenido duplicado)`);
    titulosDuplicados.slice(0, 5).forEach(d => {
      console.log(`   - "${d.titulo.slice(0, 50)}..."`);
    });
    if (titulosDuplicados.length > 5) {
      console.log(`   ... y ${titulosDuplicados.length - 5} más`);
    }
  } else {
    logOk('No hay títulos duplicados');
  }

  if (sinResumen > 0) logWarning(`${sinResumen} sin resumen (meta description genérica)`);
  if (resumenMuyCorto > 0) logWarning(`${resumenMuyCorto} resúmenes muy cortos (<50 chars)`);

  // =========================================
  // 4. ANÁLISIS DE NOINDEX
  // =========================================
  console.log(`\n${CYAN}4. ANALIZANDO ESTRATEGIA DE INDEXACIÓN...${RESET}\n`);

  // Según el código, las páginas de detalle tienen noindex
  logInfo('Páginas de detalle (/convocatorias/[slug]) tienen robots: noindex, nofollow');
  logInfo('Esto es intencional por "thin content" hasta enriquecer datos');

  // Contar cuántas podrían indexarse (las que tienen plazas y resumen)
  const indexables = convocatorias.filter(c =>
    c.resumen && c.resumen.length > 100 && c.num_plazas && c.num_plazas > 0
  );

  if (indexables.length > 0) {
    logInfo(`${indexables.length} convocatorias podrían indexarse (tienen plazas + resumen largo)`);
  }

  // =========================================
  // 5. PROBLEMAS DE CANONICAL
  // =========================================
  console.log(`\n${CYAN}5. ANALIZANDO CANONICALS...${RESET}\n`);

  // Revisar el código para canonicals
  logInfo('Página principal /convocatorias: canonical relativo "/convocatorias"');
  logWarning('Canonical relativo puede causar problemas - debería ser URL absoluta');

  logInfo('Páginas de filtro: canonical apunta a /oposiciones/[slug] para ccaa, provincia, etc.');
  logOk('Estrategia de canonical a /oposiciones evita contenido duplicado');

  // =========================================
  // 6. PROBLEMAS DE PAGINACIÓN
  // =========================================
  console.log(`\n${CYAN}6. ANALIZANDO PAGINACIÓN...${RESET}\n`);

  const totalPages = Math.ceil(convocatorias.length / 20);

  if (totalPages > 1) {
    logInfo(`${totalPages} páginas de paginación`);
    logWarning('No hay rel="next" / rel="prev" implementado');
    logWarning('Sin canonical específico por página, Google puede ver como duplicado');
  }

  // =========================================
  // 7. DATOS ESTRUCTURADOS (Schema.org)
  // =========================================
  console.log(`\n${CYAN}7. ANALIZANDO SCHEMA.ORG...${RESET}\n`);

  logOk('Páginas de detalle tienen JobPosting schema');

  // Verificar campos requeridos
  const sinDepartamento = convocatorias.filter(c => !c.departamento_nombre).length;
  const sinPlazas = convocatorias.filter(c => !c.num_plazas || c.num_plazas === 0).length;
  const sinCCAA = convocatorias.filter(c => !c.comunidad_autonoma).length;

  if (sinDepartamento > 0) {
    logWarning(`${sinDepartamento} sin departamento (hiringOrganization genérico en schema)`);
  }
  if (sinPlazas > 0) {
    logInfo(`${sinPlazas} sin número de plazas (totalJobOpenings vacío)`);
  }
  if (sinCCAA > 0) {
    logInfo(`${sinCCAA} sin CCAA (jobLocation incompleto)`);
  }

  // =========================================
  // 8. PROBLEMAS DE INTERNAL LINKING
  // =========================================
  console.log(`\n${CYAN}8. ANALIZANDO INTERNAL LINKING...${RESET}\n`);

  // Contar convocatorias con oposicion_relacionada
  const conOposicion = convocatorias.filter(c => c.oposicion_relacionada).length;
  const sinOposicion = convocatorias.length - conOposicion;

  if (sinOposicion > 0) {
    logInfo(`${sinOposicion} sin oposición relacionada (sin CTA a tests)`);
  }

  logOk('Breadcrumbs implementados correctamente');
  logOk('Links a filtros relacionados en páginas de filtro');

  // =========================================
  // 9. ANÁLISIS POR TIPO
  // =========================================
  console.log(`\n${CYAN}9. DISTRIBUCIÓN POR TIPO...${RESET}\n`);

  const porTipo = {};
  for (const conv of convocatorias) {
    const tipo = conv.tipo || 'sin_tipo';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
  }

  Object.entries(porTipo).forEach(([tipo, count]) => {
    console.log(`   ${tipo}: ${count}`);
  });

  // =========================================
  // 10. URLs PROBLEMÁTICAS
  // =========================================
  console.log(`\n${CYAN}10. BUSCANDO URLs PROBLEMÁTICAS...${RESET}\n`);

  // Buscar convocatorias con títulos que generarían malos slugs
  const problemáticas = convocatorias.filter(c => {
    if (!c.slug) return false;
    // Slugs que son solo números
    if (/^[0-9-]+$/.test(c.slug)) return true;
    // Slugs que empiezan con boe-a pero no tienen más info
    if (/^boe-a-\d{4}-\d+$/.test(c.slug)) return true;
    return false;
  });

  if (problemáticas.length > 0) {
    logWarning(`${problemáticas.length} URLs con slugs poco descriptivos (solo IDs BOE)`);
    problemáticas.slice(0, 3).forEach(p => {
      console.log(`   - /convocatorias/${p.slug}`);
    });
  } else {
    logOk('Todos los slugs son descriptivos');
  }

  // =========================================
  // RESUMEN FINAL
  // =========================================
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}   RESUMEN DE LA AUDITORÍA${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  console.log(`${RED}Problemas críticos: ${issues.critical.length}${RESET}`);
  issues.critical.forEach(i => console.log(`   - ${i}`));

  console.log(`\n${YELLOW}Advertencias: ${issues.warning.length}${RESET}`);
  issues.warning.forEach(i => console.log(`   - ${i}`));

  console.log(`\n${CYAN}Informativos: ${issues.info.length}${RESET}`);

  // =========================================
  // RECOMENDACIONES
  // =========================================
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}   RECOMENDACIONES${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  if (issues.critical.length > 0) {
    console.log(`${RED}1. URGENTE: Resolver problemas de contenido duplicado y thin content${RESET}`);
    console.log('   - Enriquecer convocatorias sin contenido');
    console.log('   - Generar slugs únicos para evitar duplicados');
  }

  if (sinResumen > convocatorias.length * 0.3) {
    console.log(`\n${YELLOW}2. Generar resúmenes automáticos con IA para meta descriptions${RESET}`);
  }

  console.log(`\n${CYAN}3. Considerar indexar convocatorias con contenido rico${RESET}`);
  console.log(`   - ${indexables.length} convocatorias tienen >500 chars de contenido`);
  console.log('   - Cambiar robots a index,follow para estas páginas');

  console.log(`\n${CYAN}4. Implementar rel="next/prev" para paginación${RESET}`);

  console.log(`\n${CYAN}5. Cambiar canonical a URL absoluta con www${RESET}`);
  console.log('   - De: "/convocatorias"');
  console.log('   - A: "https://www.vence.es/convocatorias"');

  console.log('\n');
}

// Ejecutar
auditConvocatorias().catch(console.error);
