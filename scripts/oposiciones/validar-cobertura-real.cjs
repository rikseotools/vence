/**
 * Script para validar cobertura REAL de preguntas con topic_scope
 *
 * Usa las preguntas parseadas de exámenes oficiales y busca
 * artículos relacionados mediante búsqueda de texto.
 *
 * Uso: node scripts/oposiciones/validar-cobertura-real.cjs tramitacion_procesal
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const positionType = process.argv[2] || "tramitacion_procesal";

// Palabras clave para identificar leyes en preguntas
const LEY_PATTERNS = [
  { pattern: /LOPJ|Ley Orgánica.*Poder Judicial|6\/1985/i, ley: "LO 6/1985" },
  { pattern: /LEC(?!rim)|Enjuiciamiento Civil|1\/2000/i, ley: "Ley 1/2000" },
  { pattern: /LECrim|Enjuiciamiento Criminal/i, ley: "LECrim" },
  { pattern: /LJCA|contencioso.?administ|29\/1998/i, ley: "Ley 29/1998" },
  { pattern: /Registro Civil|20\/2011/i, ley: "LRC" },
  { pattern: /Constitución|CE\b/i, ley: "CE" },
  { pattern: /Igualdad.*mujeres|3\/2007/i, ley: "LO 3/2007" },
  { pattern: /Violencia.*Género|1\/2004/i, ley: "LO 1/2004" },
  { pattern: /libertad sindical|11\/1985/i, ley: "LO 11/1985" },
  { pattern: /TREBEP|5\/2015|Estatuto.*Empleado/i, ley: "RDL 5/2015" },
  { pattern: /jurisdicción social|36\/2011/i, ley: "LRJS" },
  { pattern: /Tratado.*Unión Europea|TUE\b/i, ley: "TUE" },
  { pattern: /TFUE|Tratado.*Funcionamiento/i, ley: "TFUE" },
  { pattern: /39\/2015|procedimiento.*común/i, ley: "Ley 39/2015" },
  { pattern: /40\/2015|régimen jurídico.*sector/i, ley: "Ley 40/2015" },
  { pattern: /jurisdicción voluntaria|15\/2015/i, ley: "Ley 15/2015" }
];

async function main() {
  console.log(`=== VALIDACIÓN DE COBERTURA: ${positionType} ===\n`);

  // 1. Cargar preguntas de exámenes
  const examenesDir = path.join(__dirname, "../../data/examenes/tramitacion-procesal");
  const archivos = fs.readdirSync(examenesDir).filter(f => f.endsWith(".json") && !f.includes("fuentes"));

  let todasPreguntas = [];
  for (const archivo of archivos) {
    const data = JSON.parse(fs.readFileSync(path.join(examenesDir, archivo)));
    if (data.preguntas) {
      todasPreguntas = todasPreguntas.concat(
        data.preguntas.map(p => ({ ...p, archivo }))
      );
    }
  }

  console.log(`📚 Preguntas cargadas: ${todasPreguntas.length} de ${archivos.length} exámenes\n`);

  if (todasPreguntas.length === 0) {
    console.log("❌ No hay preguntas para validar");
    return;
  }

  // 2. Cargar topic_scope
  const { data: topics } = await supabase
    .from("topics")
    .select("id, topic_number, title")
    .eq("position_type", positionType);

  if (!topics || topics.length === 0) {
    console.log("❌ No hay topics para este position_type");
    return;
  }

  const topicIds = topics.map(t => t.id);
  const { data: scopes } = await supabase
    .from("topic_scope")
    .select("topic_id, law_id, article_numbers")
    .in("topic_id", topicIds);

  // Cargar leyes
  const { data: laws } = await supabase
    .from("laws")
    .select("id, short_name, name");

  const lawById = {};
  const lawByShort = {};
  for (const law of laws) {
    lawById[law.id] = law;
    lawByShort[law.short_name] = law;
  }

  // Construir mapa de leyes en scope
  const leyesEnScope = new Set();
  for (const scope of scopes || []) {
    const law = lawById[scope.law_id];
    if (law) {
      leyesEnScope.add(law.short_name);
    }
  }

  console.log(`📋 Topics: ${topics.length}`);
  console.log(`📋 Scopes: ${scopes?.length || 0}`);
  console.log(`📋 Leyes en scope: ${leyesEnScope.size}\n`);

  // 3. Validar cada pregunta
  let cubiertas = 0;
  let noCubiertas = 0;
  let sinLeyIdentificada = 0;
  const detalles = [];

  console.log("🔍 Validando preguntas...\n");

  for (const pregunta of todasPreguntas) {
    const textoCompleto = `${pregunta.texto} ${Object.values(pregunta.opciones).join(" ")}`;

    // Identificar ley mencionada
    let leyIdentificada = null;
    for (const { pattern, ley } of LEY_PATTERNS) {
      if (pattern.test(textoCompleto)) {
        leyIdentificada = ley;
        break;
      }
    }

    if (!leyIdentificada) {
      sinLeyIdentificada++;
      detalles.push({
        numero: pregunta.numero,
        texto: pregunta.texto.substring(0, 60),
        estado: "SIN_LEY",
        ley: null
      });
      continue;
    }

    // Verificar si la ley está en scope
    const cubierta = leyesEnScope.has(leyIdentificada);

    if (cubierta) {
      cubiertas++;
      detalles.push({
        numero: pregunta.numero,
        texto: pregunta.texto.substring(0, 60),
        estado: "CUBIERTA",
        ley: leyIdentificada
      });
    } else {
      noCubiertas++;
      detalles.push({
        numero: pregunta.numero,
        texto: pregunta.texto.substring(0, 60),
        estado: "NO_CUBIERTA",
        ley: leyIdentificada
      });
    }
  }

  // 4. Mostrar resultados
  console.log("=".repeat(60));
  console.log("RESULTADOS DE VALIDACIÓN");
  console.log("=".repeat(60));
  console.log(`Total preguntas: ${todasPreguntas.length}`);
  console.log(`✅ Cubiertas: ${cubiertas} (${((cubiertas / todasPreguntas.length) * 100).toFixed(1)}%)`);
  console.log(`❌ No cubiertas: ${noCubiertas}`);
  console.log(`❓ Sin ley identificada: ${sinLeyIdentificada}`);
  console.log("");

  // Calcular cobertura real (excluyendo las que no tienen ley identificada)
  const conLey = cubiertas + noCubiertas;
  if (conLey > 0) {
    const coberturaReal = (cubiertas / conLey) * 100;
    console.log(`📊 Cobertura real (preguntas con ley): ${coberturaReal.toFixed(1)}%`);
  }

  // Mostrar preguntas no cubiertas
  const noCubiertasDetalle = detalles.filter(d => d.estado === "NO_CUBIERTA");
  if (noCubiertasDetalle.length > 0) {
    console.log("\n⚠️  PREGUNTAS NO CUBIERTAS:");
    for (const d of noCubiertasDetalle.slice(0, 10)) {
      console.log(`  P${d.numero}: ${d.texto}... [${d.ley}]`);
    }
    if (noCubiertasDetalle.length > 10) {
      console.log(`  ... y ${noCubiertasDetalle.length - 10} más`);
    }
  }

  // Mostrar preguntas sin ley identificada
  const sinLeyDetalle = detalles.filter(d => d.estado === "SIN_LEY");
  if (sinLeyDetalle.length > 0) {
    console.log("\n❓ PREGUNTAS SIN LEY IDENTIFICADA (muestra):");
    for (const d of sinLeyDetalle.slice(0, 5)) {
      console.log(`  P${d.numero}: ${d.texto}...`);
    }
  }

  // Estadísticas por ley
  console.log("\n📊 ESTADÍSTICAS POR LEY:");
  const porLey = {};
  for (const d of detalles.filter(d => d.ley)) {
    if (!porLey[d.ley]) {
      porLey[d.ley] = { cubiertas: 0, noCubiertas: 0 };
    }
    if (d.estado === "CUBIERTA") {
      porLey[d.ley].cubiertas++;
    } else {
      porLey[d.ley].noCubiertas++;
    }
  }

  for (const [ley, stats] of Object.entries(porLey).sort((a, b) => (b[1].cubiertas + b[1].noCubiertas) - (a[1].cubiertas + a[1].noCubiertas))) {
    const total = stats.cubiertas + stats.noCubiertas;
    const pct = ((stats.cubiertas / total) * 100).toFixed(0);
    const icon = stats.noCubiertas === 0 ? "✅" : "⚠️";
    console.log(`  ${icon} ${ley.padEnd(15)}: ${stats.cubiertas}/${total} (${pct}%)`);
  }

  // Guardar informe
  const informe = {
    fecha: new Date().toISOString(),
    position_type: positionType,
    total_preguntas: todasPreguntas.length,
    cubiertas,
    no_cubiertas: noCubiertas,
    sin_ley: sinLeyIdentificada,
    cobertura_pct: conLey > 0 ? ((cubiertas / conLey) * 100).toFixed(1) : 0,
    por_ley: porLey,
    detalles
  };

  const informePath = path.join(examenesDir, "informe-cobertura.json");
  fs.writeFileSync(informePath, JSON.stringify(informe, null, 2));
  console.log(`\n📄 Informe guardado en: ${informePath}`);
}

main().catch(console.error);
