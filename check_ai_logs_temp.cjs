const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs de las preguntas con falsos positivos
const questionIds = [
  "dd7cf02b-ffe6-4fd1-aed6-42c5500d304b", // Senador compatible
  "a58f888e-87ad-4a68-876f-68961eccaa6e"  // Regencia incorrecta
];

(async () => {
  // 1. Buscar en ai_verification_results
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("              AI VERIFICATION RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const qId of questionIds) {
    const { data: results } = await supabase
      .from("ai_verification_results")
      .select("*")
      .eq("question_id", qId);

    if (results && results.length > 0) {
      for (const r of results) {
        console.log("Question:", qId.substring(0, 8) + "...");
        console.log("Model:", r.ai_model);
        console.log("Provider:", r.ai_provider);
        console.log("Created:", r.created_at);
        console.log("Answer OK:", r.answer_ok);
        console.log("Explanation OK:", r.explanation_ok);
        console.log("Full explanation:", r.explanation);
        console.log("---");
      }
    }
  }

  // 2. Buscar tablas relacionadas con AI logs
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("              BUSCANDO TABLAS DE LOGS AI");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Listar tablas que podrían tener logs
  const tables = [
    "ai_chat_logs",
    "ai_logs",
    "chat_logs",
    "ai_conversations",
    "ai_requests",
    "verification_logs"
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    if (!error) {
      console.log(`✅ Tabla '${table}' existe`);
    }
  }

  // 3. Buscar en question_disputes los detalles de la auto-detección
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("              DETALLES DE AUTO-DETECCIÓN");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("*")
    .in("question_id", questionIds);

  if (disputes) {
    for (const d of disputes) {
      console.log("Dispute ID:", d.id.substring(0, 8) + "...");
      console.log("Question:", d.question_id.substring(0, 8) + "...");
      console.log("Created at:", d.created_at);
      console.log("User ID:", d.user_id || "(auto-generada)");
      console.log("Metadata:", JSON.stringify(d.metadata, null, 2));
      console.log("---");
    }
  }
})();
