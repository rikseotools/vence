require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Leer JSON
  const json = JSON.parse(fs.readFileSync("data/examenes-oficiales/auxiliar-administrativo-estado/23-01-20 convocatoria 20 enero 2023 - OEP 2021-2022/20 de enero de 2023.json", "utf-8"));
  const primeraParteJson = json.partes[0].preguntas;

  // Preguntas legislativas del JSON (1-30)
  const legislativasJson = primeraParteJson.slice(0, 30);

  console.log("=== COMPARACIÓN JSON vs BD ===\n");
  console.log("Legislativas en JSON (primera parte):", legislativasJson.length);

  // Obtener de BD
  const { data: bdQuestions } = await supabase
    .from("questions")
    .select("id, question_text, is_active")
    .eq("exam_date", "2023-01-20")
    .eq("is_official_exam", true)
    .like("exam_source", "%Primera parte%")
    .not("exam_source", "ilike", "%Reserva%");

  const activas = bdQuestions?.filter(q => q.is_active) || [];
  console.log("Legislativas en BD (activas):", activas.length);

  // Buscar qué preguntas del JSON NO están en BD (o están inactivas)
  console.log("\n=== PREGUNTAS DEL JSON QUE FALTAN EN BD ===\n");

  let missing = 0;
  for (const jsonQ of legislativasJson) {
    const enunciado = jsonQ.enunciado.substring(0, 50).toLowerCase();

    // Buscar en BD
    const found = activas.find(bdQ =>
      bdQ.question_text?.toLowerCase().includes(enunciado.substring(0, 30))
    );

    if (!found) {
      missing++;
      console.log("FALTA Q" + jsonQ.numero + ":", jsonQ.enunciado.substring(0, 70) + "...");
    }
  }

  console.log("\n--- RESUMEN ---");
  console.log("Preguntas faltantes:", missing);
  console.log("Activas en BD:", activas.length);
  console.log("Esperadas:", 30);
  console.log("Diferencia:", 30 - activas.length);
})();
