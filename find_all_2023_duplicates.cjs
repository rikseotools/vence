require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Obtener TODAS las preguntas del examen 2023
  const { data: leg } = await supabase
    .from("questions")
    .select("id, question_text, exam_source, is_active, correct_option")
    .eq("exam_date", "2023-01-20")
    .eq("is_official_exam", true)
    .eq("is_active", true);

  const { data: psy } = await supabase
    .from("psychometric_questions")
    .select("id, question_text, exam_source, is_active")
    .eq("exam_date", "2023-01-20")
    .eq("is_official_exam", true)
    .eq("is_active", true);

  console.log("=== BÚSQUEDA DE DUPLICADOS EN EXAMEN 2023 ===\n");
  console.log("Legislativas activas:", leg?.length);
  console.log("Psicotécnicas activas:", psy?.length);

  // Buscar duplicados por similitud de texto (primeros 60 chars)
  const findDuplicates = (questions, label) => {
    const textMap = new Map();

    questions?.forEach(q => {
      // Normalizar texto: minúsculas, quitar espacios extra
      const text = q.question_text
        ?.trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .substring(0, 60);

      if (text) {
        if (!textMap.has(text)) {
          textMap.set(text, []);
        }
        textMap.get(text).push(q);
      }
    });

    const duplicates = [...textMap.entries()].filter(([_, arr]) => arr.length > 1);

    if (duplicates.length > 0) {
      console.log(`\n⚠️ DUPLICADOS EN ${label}:`);
      duplicates.forEach(([text, qs]) => {
        console.log("\n  Texto:", text + "...");
        qs.forEach(q => {
          console.log("    - ID:", q.id);
          console.log("      Source:", q.exam_source);
          console.log("      Correct:", q.correct_option);
        });
      });
    } else {
      console.log(`\n✅ No hay duplicados en ${label}`);
    }

    return duplicates;
  };

  findDuplicates(leg, "LEGISLATIVAS");
  findDuplicates(psy, "PSICOTÉCNICAS");

  // RESUMEN FINAL
  console.log("\n\n=== RESUMEN FINAL EXAMEN 2023 ===");

  const primeraLeg = leg?.filter(q => q.exam_source?.includes("Primera parte") && !q.exam_source?.includes("Reserva")).length || 0;
  const segundaLeg = leg?.filter(q => q.exam_source?.includes("Segunda parte")).length || 0;
  const reservaLeg = leg?.filter(q => q.exam_source?.includes("Reserva")).length || 0;
  const primeraPsy = psy?.filter(q => q.exam_source?.includes("Primera parte") && !q.exam_source?.includes("Reserva")).length || 0;
  const reservaPsy = psy?.filter(q => q.exam_source?.includes("Reserva")).length || 0;

  console.log("\nPrimera parte:");
  console.log("  Legislativas:", primeraLeg, "(esperado: 30)");
  console.log("  Psicotécnicas:", primeraPsy, "(esperado: 30)");
  console.log("  TOTAL:", primeraLeg + primeraPsy, "(esperado: 60)");

  console.log("\nSegunda parte:");
  console.log("  Legislativas:", segundaLeg, "(esperado: 50)");

  console.log("\nReservas:");
  console.log("  Legislativas:", reservaLeg);
  console.log("  Psicotécnicas:", reservaPsy);
})();
