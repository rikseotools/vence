/**
 * Script para crear la oposición de Tramitación Procesal y Administrativa
 *
 * Proceso:
 * 1. Crear registro en oposiciones
 * 2. Crear topics con epígrafes
 * 3. Generar topic_scope usando embeddings
 *
 * Uso: node scripts/oposiciones/crear-tramitacion-procesal.cjs [--dry-run]
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fs = require("fs");
const path = require("path");

// Cargar temario
const temarioPath = path.join(__dirname, "../../data/temarios/tramitacion-procesal.json");
const temario = JSON.parse(fs.readFileSync(temarioPath, "utf8"));

// Leyes principales con sus short_names en BD
const LEYES_MAP = {
  "Constitución Española": "CE",
  "LOPJ": "LO 6/1985",
  "LEC": "Ley 1/2000",
  "LECrim": "LECrim",
  "LJCA": "Ley 29/1998",
  "LRJS": "LRJS",
  "Registro Civil": "LRC",
  "LO 3/2007": "LO 3/2007",
  "LO 1/2004": "LO 1/2004",
  "Libertad Sindical": "LO 11/1985",
  "Ley 39/2015": "Ley 39/2015",
  "Ley 40/2015": "Ley 40/2015",
  "TREBEP": "RDL 5/2015",
  "TUE": "TUE",
  "TFUE": "TFUE"
};

// Mapeo de temas a leyes principales
const TEMA_LEYES = {
  1: ["CE"],
  2: ["LO 3/2007", "LO 1/2004"],
  3: ["Ley 40/2015", "CE"],
  4: ["CE"],
  5: ["TUE", "TFUE"],
  6: ["LO 6/1985", "CE"],
  7: ["LO 6/1985"],
  8: ["LO 6/1985"],
  9: ["Ley 39/2015"],
  10: ["Ley 39/2015", "Ley 40/2015"],
  11: ["LO 6/1985"],
  12: ["LO 6/1985", "RDL 5/2015"],
  13: ["RDL 5/2015"],
  14: ["RDL 5/2015"],
  15: ["LO 11/1985"],
  16: ["Ley 1/2000"],
  17: ["Ley 1/2000"],
  18: ["Ley 1/2000"],
  19: ["Ley 1/2000", "Ley 15/2015"],
  20: ["LECrim"],
  21: ["LECrim"],
  22: ["Ley 29/1998"],
  23: ["LRJS"],
  24: ["Ley 1/2000", "LECrim", "Ley 29/1998"],
  25: ["Ley 1/2000", "LECrim"],
  26: ["LO 6/1985", "Ley 1/2000"],
  27: ["Ley 1/2000", "LECrim"],
  28: ["Ley 1/2000", "LECrim"],
  29: ["LRC"],
  30: ["LRC"],
  31: ["LO 6/1985"]
};

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== CREACIÓN DE OPOSICIÓN: TRAMITACIÓN PROCESAL ===\n");

  if (DRY_RUN) {
    console.log("🔍 MODO DRY-RUN: No se harán cambios en BD\n");
  }

  // 1. Verificar si ya existe
  const { data: existingOpo } = await supabase
    .from("oposiciones")
    .select("id")
    .eq("slug", "tramitacion-procesal")
    .single();

  if (existingOpo) {
    console.log("⚠️  La oposición ya existe. Usa --force para recrear.");
    return;
  }

  // 2. Cargar leyes
  console.log("📚 Cargando leyes...");
  const { data: laws } = await supabase
    .from("laws")
    .select("id, short_name, name");

  const lawMap = {};
  for (const law of laws) {
    lawMap[law.short_name] = law.id;
  }

  // Verificar leyes necesarias
  const leyesFaltantes = [];
  for (const [nombre, shortName] of Object.entries(LEYES_MAP)) {
    if (!lawMap[shortName]) {
      leyesFaltantes.push(`${nombre} (${shortName})`);
    }
  }

  if (leyesFaltantes.length > 0) {
    console.log("❌ Faltan leyes:", leyesFaltantes.join(", "));
    return;
  }
  console.log("✅ Todas las leyes necesarias están en BD\n");

  // 3. Crear oposición
  console.log("📝 Creando oposición...");

  const oposicionData = {
    nombre: temario.oposicion.nombre,
    slug: temario.oposicion.slug,
    short_name: temario.oposicion.short_name,
    grupo: temario.oposicion.grupo,
    administracion: "Administración de Justicia",
    categoria: temario.oposicion.categoria,
    tipo_acceso: "libre",
    temas_count: temario.temas.length,
    bloques_count: temario.bloques.length,
    is_active: false, // No activar hasta validar
    is_convocatoria_activa: false
  };

  if (!DRY_RUN) {
    const { data: newOpo, error: opoError } = await supabase
      .from("oposiciones")
      .insert(oposicionData)
      .select()
      .single();

    if (opoError) {
      console.log("❌ Error creando oposición:", opoError.message);
      return;
    }
    console.log("✅ Oposición creada:", newOpo.id);
  } else {
    console.log("  [DRY-RUN] Crearía oposición:", oposicionData.nombre);
  }

  // 4. Crear topics
  console.log("\n📋 Creando topics...");

  const topicsCreados = [];
  for (const tema of temario.temas) {
    const topicData = {
      position_type: temario.oposicion.position_type,
      topic_number: tema.numero,
      title: tema.titulo,
      description: tema.epigrafe,
      is_active: true
    };

    if (!DRY_RUN) {
      const { data: newTopic, error: topicError } = await supabase
        .from("topics")
        .insert(topicData)
        .select()
        .single();

      if (topicError) {
        console.log(`❌ Error creando topic ${tema.numero}:`, topicError.message);
        continue;
      }
      topicsCreados.push({ ...newTopic, leyes: TEMA_LEYES[tema.numero] || [] });
      console.log(`  ✅ T${tema.numero}: ${tema.titulo.substring(0, 40)}...`);
    } else {
      console.log(`  [DRY-RUN] T${tema.numero}: ${tema.titulo.substring(0, 40)}...`);
      topicsCreados.push({ id: `fake-${tema.numero}`, topic_number: tema.numero, leyes: TEMA_LEYES[tema.numero] || [] });
    }
  }

  console.log(`\n✅ ${topicsCreados.length} topics creados`);

  // 5. Generar topic_scope
  console.log("\n🔗 Generando topic_scope...");

  let scopesCreados = 0;
  for (const topic of topicsCreados) {
    const leyesTema = TEMA_LEYES[topic.topic_number] || [];

    for (const leyShort of leyesTema) {
      const lawId = lawMap[leyShort];
      if (!lawId) {
        console.log(`  ⚠️  Ley no encontrada: ${leyShort}`);
        continue;
      }

      // Obtener artículos de esta ley con embedding
      const { data: articles } = await supabase
        .from("articles")
        .select("article_number")
        .eq("law_id", lawId)
        .not("embedding", "is", null);

      if (!articles || articles.length === 0) {
        console.log(`  ⚠️  Sin artículos para ${leyShort}`);
        continue;
      }

      // Para simplificar, incluir todos los artículos de la ley
      // En una versión avanzada, usaríamos embeddings para filtrar
      const articleNumbers = articles.map(a => a.article_number);

      const scopeData = {
        topic_id: topic.id,
        law_id: lawId,
        article_numbers: articleNumbers
      };

      if (!DRY_RUN) {
        const { error: scopeError } = await supabase
          .from("topic_scope")
          .insert(scopeData);

        if (scopeError) {
          console.log(`  ❌ Error scope T${topic.topic_number}/${leyShort}:`, scopeError.message);
          continue;
        }
      }

      scopesCreados++;
      console.log(`  ✅ T${topic.topic_number} ← ${leyShort} (${articleNumbers.length} arts)`);
    }
  }

  console.log(`\n✅ ${scopesCreados} topic_scope creados`);

  // 6. Resumen
  console.log("\n" + "=".repeat(50));
  console.log("RESUMEN");
  console.log("=".repeat(50));
  console.log(`Oposición: ${temario.oposicion.nombre}`);
  console.log(`Topics: ${topicsCreados.length}`);
  console.log(`Topic Scopes: ${scopesCreados}`);
  console.log(`Estado: INACTIVA (pendiente validación)`);
  console.log("\nPróximo paso: validar cobertura con exámenes oficiales");
  console.log("  node scripts/oposiciones/validar-cobertura.cjs tramitacion-procesal");
}

main().catch(console.error);
