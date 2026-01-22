const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesario para UPDATE
);

(async () => {
  console.log("🔧 Corrigiendo preguntas de Gestión mal clasificadas...\n");

  // 1. Buscar preguntas de Gestión con exam_position incorrecto
  const { data: wrongQuestions, error: findError } = await supabase
    .from("questions")
    .select("id, exam_source, exam_position")
    .eq("is_official_exam", true)
    .ilike("exam_source", "%Gestión%")
    .eq("exam_position", "auxiliar_administrativo_estado");

  if (findError) {
    console.error("❌ Error buscando:", findError);
    return;
  }

  console.log(`📊 Encontradas ${wrongQuestions.length} preguntas de Gestión con exam_position incorrecto`);

  if (wrongQuestions.length === 0) {
    console.log("✅ No hay nada que corregir");
    return;
  }

  // Mostrar algunas
  console.log("\nEjemplos:");
  wrongQuestions.slice(0, 5).forEach(q => {
    console.log(`   ID: ${q.id}`);
    console.log(`   exam_source: ${q.exam_source}`);
    console.log(`   exam_position actual: ${q.exam_position}`);
    console.log("");
  });

  // 2. Corregir: cambiar exam_position a cuerpo_gestion_administracion_civil
  const ids = wrongQuestions.map(q => q.id);

  const { data: updated, error: updateError } = await supabase
    .from("questions")
    .update({ exam_position: "cuerpo_gestion_administracion_civil" })
    .in("id", ids)
    .select("id");

  if (updateError) {
    console.error("❌ Error actualizando:", updateError);
    return;
  }

  console.log(`✅ Corregidas ${updated.length} preguntas`);
  console.log("   Nuevo exam_position: cuerpo_gestion_administracion_civil");

  // 3. Verificar
  const { data: verify } = await supabase
    .from("questions")
    .select("exam_position")
    .eq("is_official_exam", true)
    .ilike("exam_source", "%Gestión%");

  const counts = {};
  verify.forEach(q => {
    const pos = q.exam_position || "NULL";
    counts[pos] = (counts[pos] || 0) + 1;
  });

  console.log("\n📊 Distribución después de la corrección:");
  Object.entries(counts).forEach(([pos, count]) => {
    console.log(`   ${pos}: ${count}`);
  });
})();
