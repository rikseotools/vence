require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar preguntas del examen 2023
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, exam_source")
    .like("exam_source", "%2023%")
    .like("exam_source", "%Auxiliar Administrativo Estado%")
    .eq("is_active", true)
    .eq("is_official_exam", true);

  const { data: psychometric } = await supabase
    .from("psychometric_questions")
    .select("id, question_text, exam_source")
    .like("exam_source", "%2023%")
    .like("exam_source", "%Auxiliar Administrativo Estado%")
    .eq("is_active", true)
    .eq("is_official_exam", true);

  console.log("=== EXAMEN 2023 - BÚSQUEDA DE DUPLICADOS ===\n");
  console.log("Preguntas legislativas 2023:", questions?.length || 0);
  console.log("Preguntas psicotécnicas 2023:", psychometric?.length || 0);

  // Buscar duplicados por question_text
  const allQuestions = [...(questions || []), ...(psychometric || [])];
  const textMap = new Map();

  allQuestions.forEach(q => {
    const text = q.question_text?.trim().toLowerCase().substring(0, 100);
    if (text) {
      if (!textMap.has(text)) {
        textMap.set(text, []);
      }
      textMap.get(text).push(q);
    }
  });

  const duplicates = [...textMap.entries()].filter(([_, arr]) => arr.length > 1);

  console.log("\nDuplicados encontrados:", duplicates.length);

  if (duplicates.length > 0) {
    console.log("\n--- DUPLICADOS ---");
    duplicates.forEach(([text, qs]) => {
      console.log("\nTexto (primeros 80 chars):", text.substring(0, 80) + "...");
      qs.forEach(q => {
        console.log("  ID:", q.id);
        console.log("  Exam source:", q.exam_source);
      });
    });
  }

  // También verificar exam_source únicos
  const sources = new Set(allQuestions.map(q => q.exam_source));
  console.log("\n--- EXAM SOURCES 2023 ---");
  sources.forEach(s => console.log(" -", s));

  // Buscar específicamente pregunta de herederos
  console.log("\n\n=== BÚSQUEDA: HEREDEROS ===");
  const herederos = allQuestions.filter(q =>
    q.question_text?.toLowerCase().includes("heredero")
  );
  console.log("Preguntas con 'heredero':", herederos.length);
  herederos.forEach(q => {
    console.log("\nID:", q.id);
    console.log("Exam:", q.exam_source);
    console.log("Texto:", q.question_text?.substring(0, 150) + "...");
  });
})();
