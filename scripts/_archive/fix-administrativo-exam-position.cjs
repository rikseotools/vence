const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("🔧 Corrigiendo preguntas de Administrativo mal clasificadas...\n");

  // Buscar preguntas de "Cuerpo General Administrativo" con exam_position incorrecto
  const { data: wrongQuestions, error: findError } = await supabase
    .from("questions")
    .select("id, exam_source, exam_position")
    .eq("is_official_exam", true)
    .or("exam_source.ilike.%Cuerpo General Administrativo%,exam_source.ilike.%ADM-L%,exam_source.ilike.%ADM-PI%")
    .eq("exam_position", "auxiliar_administrativo_estado");

  if (findError) {
    console.error("❌ Error buscando:", findError);
    return;
  }

  console.log(`📊 Encontradas ${wrongQuestions.length} preguntas de Administrativo con exam_position incorrecto`);

  if (wrongQuestions.length === 0) {
    console.log("✅ No hay nada que corregir");
    return;
  }

  // Mostrar algunas
  console.log("\nEjemplos:");
  wrongQuestions.slice(0, 3).forEach(q => {
    console.log(`   - ${q.exam_source}`);
    console.log(`     actual: ${q.exam_position} → correcto: administrativo\n`);
  });

  // Corregir
  const ids = wrongQuestions.map(q => q.id);

  const { data: updated, error: updateError } = await supabase
    .from("questions")
    .update({ exam_position: "administrativo" })
    .in("id", ids)
    .select("id");

  if (updateError) {
    console.error("❌ Error actualizando:", updateError);
    return;
  }

  console.log(`✅ Corregidas ${updated.length} preguntas`);
  console.log("   Nuevo exam_position: administrativo");
})();
