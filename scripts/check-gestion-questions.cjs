const { createClient } = require('./lib/pg-agnostic-client.cjs');
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Buscar preguntas de "Cuerpo de Gestión"
  const { data, error } = await supabase
    .from("questions")
    .select("id, exam_source, exam_position, exam_date")
    .eq("is_official_exam", true)
    .eq("is_active", true)
    .ilike("exam_source", "%Gestión%");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("📊 Preguntas con 'Gestión' en exam_source:");
  console.log("Total:", data.length);
  console.log("");

  // Agrupar por exam_position
  const byPosition = {};
  data.forEach(q => {
    const pos = q.exam_position || "NULL";
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(q);
  });

  Object.entries(byPosition).forEach(([pos, questions]) => {
    console.log(`\n📝 exam_position = "${pos}" (${questions.length} preguntas)`);
    questions.slice(0, 3).forEach(q => {
      console.log(`   - ${q.exam_source} (${q.exam_date || "sin fecha"})`);
    });
    if (questions.length > 3) console.log(`   ... y ${questions.length - 3} más`);
  });

  // PROBLEMA: Preguntas de Gestión con exam_position NULL
  const nullPositions = byPosition["NULL"] || [];
  if (nullPositions.length > 0) {
    console.log("\n⚠️  PROBLEMA: " + nullPositions.length + " preguntas de Gestión tienen exam_position NULL");
    console.log("   Estas preguntas se muestran a TODAS las oposiciones (incluyendo Auxiliar)");
  }
})();
