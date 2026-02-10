require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar usuario Nila
  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, display_name, email")
    .or("display_name.ilike.%nila%,email.ilike.%nila%");

  console.log("=== USUARIOS NILA ===");
  console.log(users);

  if (users && users.length > 0) {
    const userId = users[0].id;

    // Buscar tests recientes del examen 2023
    const { data: tests } = await supabase
      .from("tests")
      .select("id, test_type, source, total_questions, created_at")
      .eq("user_id", userId)
      .like("source", "%2023%")
      .order("created_at", { ascending: false })
      .limit(10);

    console.log("\n=== TESTS RECIENTES DE NILA (2023) ===");
    tests?.forEach(t => {
      console.log("\nTest ID:", t.id);
      console.log("Type:", t.test_type);
      console.log("Source:", t.source);
      console.log("Total questions:", t.total_questions);
      console.log("Created:", t.created_at);
    });

    // Revisar test_questions del test más reciente
    if (tests && tests.length > 0) {
      for (const test of tests.slice(0, 3)) {
        console.log("\n\n========================================");
        console.log("ANALIZANDO TEST:", test.id);
        console.log("Source:", test.source);
        console.log("========================================");

        const { data: tq } = await supabase
          .from("test_questions")
          .select("id, question_id, psychometric_question_id, question_order")
          .eq("test_id", test.id)
          .order("question_order", { ascending: true });

        console.log("Total preguntas en test_questions:", tq?.length);

        // Buscar duplicados en question_id
        const qIds = tq?.map(q => q.question_id).filter(Boolean) || [];
        const pIds = tq?.map(q => q.psychometric_question_id).filter(Boolean) || [];

        const qCounts = {};
        qIds.forEach(id => { qCounts[id] = (qCounts[id] || 0) + 1; });
        const qDups = Object.entries(qCounts).filter(([_, count]) => count > 1);

        const pCounts = {};
        pIds.forEach(id => { pCounts[id] = (pCounts[id] || 0) + 1; });
        const pDups = Object.entries(pCounts).filter(([_, count]) => count > 1);

        console.log("\nLegislativas:", qIds.length);
        console.log("Psicotécnicas:", pIds.length);

        if (qDups.length > 0) {
          console.log("\n⚠️ DUPLICADOS LEGISLATIVAS:");
          for (const [id, count] of qDups) {
            console.log(`  - ${id}: ${count} veces`);
            // Obtener texto de la pregunta
            const { data: q } = await supabase
              .from("questions")
              .select("question_text")
              .eq("id", id)
              .single();
            console.log(`    Texto: ${q?.question_text?.substring(0, 80)}...`);
          }
        } else {
          console.log("\n✅ Sin duplicados en legislativas");
        }

        if (pDups.length > 0) {
          console.log("\n⚠️ DUPLICADOS PSICOTÉCNICAS:");
          for (const [id, count] of pDups) {
            console.log(`  - ${id}: ${count} veces`);
          }
        } else {
          console.log("✅ Sin duplicados en psicotécnicas");
        }
      }
    }
  }
})();
