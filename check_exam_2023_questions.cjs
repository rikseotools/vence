require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Simular la query que hace getOfficialExamQuestions para el examen 2023 primera parte
  const examDate = "2023-01-20";
  const parte = "primera";

  // Buscar en question_official_exams
  const { data: qoe, error: qoeError } = await supabase
    .from("question_official_exams")
    .select("question_id, psychometric_question_id, exam_source, exam_part")
    .eq("exam_date", examDate)
    .eq("oposicion_type", "auxiliar-administrativo-estado");

  console.log("=== QUESTION_OFFICIAL_EXAMS para 2023-01-20 ===");
  console.log("Error:", qoeError);
  console.log("Registros encontrados:", qoe?.length || 0);

  if (qoe && qoe.length > 0) {
    console.log("\nEjemplos:");
    qoe.slice(0, 5).forEach(q => {
      console.log("  - Q:", q.question_id?.substring(0, 8) || "null", "| P:", q.psychometric_question_id?.substring(0, 8) || "null", "| Part:", q.exam_part);
    });
  }

  // Ahora buscar directamente en questions con exam_source
  console.log("\n\n=== QUESTIONS con exam_source 2023 ===");

  const { data: qs } = await supabase
    .from("questions")
    .select("id, question_text, exam_source, is_active")
    .like("exam_source", "%Convocatoria 20 enero 2023%Primera parte%")
    .eq("is_active", true)
    .eq("is_official_exam", true);

  console.log("Legislativas primera parte:", qs?.length || 0);

  // Verificar si hay duplicados
  const texts = qs?.map(q => q.question_text?.substring(0, 60).toLowerCase()) || [];
  const seen = new Set();
  const dups = [];
  texts.forEach((t, i) => {
    if (seen.has(t)) {
      dups.push({ text: t, id: qs[i].id });
    }
    seen.add(t);
  });

  console.log("\nDuplicados por texto:", dups.length);
  if (dups.length > 0) {
    dups.forEach(d => {
      console.log("  -", d.text.substring(0, 50) + "...");
      console.log("   ID:", d.id);
    });
  }

  // Buscar la pregunta de "personas físicas fallecidas" en las del examen 2023
  const fallecidas = qs?.filter(q => q.question_text?.toLowerCase().includes("personas físicas fallecidas"));
  console.log("\n\nPreguntas 'personas físicas fallecidas' en examen 2023:", fallecidas?.length || 0);
  fallecidas?.forEach(q => {
    console.log("  ID:", q.id);
    console.log("  Source:", q.exam_source);
  });
})();
