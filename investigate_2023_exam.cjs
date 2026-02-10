require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Obtener todas las preguntas del examen 2023
  const { data: leg } = await supabase
    .from("questions")
    .select("id, question_text, exam_source, created_at")
    .like("exam_source", "%Convocatoria 20 enero 2023%")
    .eq("is_active", true)
    .eq("is_official_exam", true);

  const { data: psy } = await supabase
    .from("psychometric_questions")
    .select("id, question_text, exam_source, created_at")
    .like("exam_source", "%Convocatoria 20 enero 2023%")
    .eq("is_active", true)
    .eq("is_official_exam", true);

  console.log("=== VERIFICACIÓN FINAL EXAMEN 2023 ===\n");

  // Buscar duplicados por similitud de texto (primeros 80 chars)
  const checkDuplicates = (questions, type) => {
    const textMap = new Map();
    questions?.forEach(q => {
      const text = q.question_text?.trim().toLowerCase().substring(0, 80);
      if (text) {
        if (!textMap.has(text)) textMap.set(text, []);
        textMap.get(text).push(q);
      }
    });

    const dups = [...textMap.entries()].filter(([_, arr]) => arr.length > 1);
    console.log(type + " - Duplicados:", dups.length);

    dups.forEach(([text, qs]) => {
      console.log("\n  DUPLICADO:", text.substring(0, 60) + "...");
      qs.forEach(q => {
        console.log("    ID:", q.id);
        console.log("    Source:", q.exam_source);
        console.log("    Created:", q.created_at);
      });
    });

    return dups.length;
  };

  checkDuplicates(leg, "Legislativas");
  checkDuplicates(psy, "Psicotécnicas");

  console.log("\n--- RESUMEN ---");
  console.log("Legislativas:", leg?.length);
  console.log("Psicotécnicas:", psy?.length);
  console.log("TOTAL:", (leg?.length || 0) + (psy?.length || 0));

  // Desglose por parte
  const primeraLeg = leg?.filter(q => q.exam_source.includes("Primera parte") && !q.exam_source.includes("Reserva")).length || 0;
  const segunda = leg?.filter(q => q.exam_source.includes("Segunda parte")).length || 0;
  const reservaLeg = leg?.filter(q => q.exam_source.includes("Reserva")).length || 0;
  const primeraPsy = psy?.filter(q => q.exam_source.includes("Primera parte") && !q.exam_source.includes("Reserva")).length || 0;
  const reservaPsy = psy?.filter(q => q.exam_source.includes("Reserva")).length || 0;

  console.log("\nDesglose:");
  console.log("  Primera parte legislativas:", primeraLeg);
  console.log("  Primera parte psicotécnicas:", primeraPsy);
  console.log("  Segunda parte legislativas:", segunda);
  console.log("  Reserva legislativas:", reservaLeg);
  console.log("  Reserva psicotécnicas:", reservaPsy);
  console.log("\n  Primera parte TOTAL:", primeraLeg + primeraPsy, "(esperado: 60)");
  console.log("  Segunda parte TOTAL:", segunda, "(esperado: 50)");
})();
