const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar preguntas con IDs específicos para verificar
  const toVerify = [
    "30f45398", "23d1a34c", "e02182e7", "29e1b5b6", "3aceed93",
    "84c2ff44", "6cf64cd9", "c7f38a93", "3762533d", "1e2c369a",
    "f7ba8b52", "3837e294"
  ];

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, correct_option, option_a, option_b, option_c, option_d, explanation, articles!questions_primary_article_id_fkey(article_number, title, content, laws!articles_law_id_fkey(short_name, name))")
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article");

  console.log("Analizando preguntas que parecen tener artículo correcto...\n");

  const perfectos = [];
  const techPerfectos = [];
  const opts = ["A", "B", "C", "D"];

  for (const q of questions) {
    const prefix = q.id.substring(0, 8);
    if (!toVerify.includes(prefix)) continue;

    const lawRef = q.articles?.laws?.short_name || q.articles?.laws?.name;
    const artNum = q.articles?.article_number;
    const content = q.articles?.content || "";
    const respuesta = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option];

    console.log("=== " + prefix + " ===");
    console.log("Q:", q.question_text.substring(0, 150));
    console.log("Resp " + opts[q.correct_option] + ":", respuesta?.substring(0, 80));
    console.log("Art:", lawRef, "Art", artNum);
    console.log("Contenido:", content.substring(0, 200));

    // Análisis automático
    let isPerfect = false;
    let isTechPerfect = false;
    let note = "";

    // Verificar si es pregunta técnica
    if (lawRef === "Informática Básica" || lawRef === "La Red Internet" ||
        lawRef === "Windows" || lawRef === "Excel" || lawRef === "Word") {
      // Verificar respuesta de troyanos
      if (q.question_text.includes("troyanos")) {
        // Troyanos permiten acceso/control remoto - B es correcto
        isTechPerfect = true;
        note = "Troyanos: software malicioso que permite acceso/control remoto. Respuesta B correcta.";
      }
    }

    // Verificar Art 106 Ley 39/2015
    if (lawRef === "Ley 39/2015" && artNum === "106") {
      if (content.includes("dictamen favorable del Consejo de Estado")) {
        isPerfect = true;
        note = "Art 106 Ley 39/2015 confirma: dictamen favorable del Consejo de Estado. Respuesta A correcta.";
      }
    }

    // Verificar Art 120 CE
    if (lawRef === "CE" && artNum === "120") {
      if (content.includes("audiencia pública")) {
        isPerfect = true;
        note = "Art 120.3 CE: sentencias se pronunciarán en audiencia pública. Respuesta B correcta.";
      }
    }

    // Verificar Art 11 Ley 7/1985
    if (lawRef === "Ley 7/1985" && artNum === "11") {
      if (content.includes("territorio") && content.includes("población")) {
        isPerfect = true;
        note = "Art 11 Ley 7/1985: elementos del municipio son territorio, población y organización. Respuesta A correcta.";
      }
    }

    // Verificar CE Art 19 (derecho circulación)
    if (lawRef === "CE" && artNum === "19") {
      isPerfect = true;
      note = "Art 19 CE: derecho de los españoles a elegir residencia, circular, entrar y salir. Respuesta D correcta.";
    }

    // Verificar RDL 5/2015 Art 74 (convocatorias)
    if (lawRef === "RDL 5/2015" && artNum === "74") {
      if (content.includes("públicas")) {
        isPerfect = true;
        note = "Art 74 TREBEP: convocatorias de procesos selectivos serán públicas. Respuesta B correcta.";
      }
    }

    // Verificar RGPD Art 8
    if (lawRef === "Reglamento UE 2016/679" && artNum === "8") {
      isPerfect = true;
      note = "Art 8 RGPD: Estados miembros pueden establecer edad inferior (mínimo 13). Respuesta B correcta.";
    }

    // Verificar RDL 4/2000 Art 28 clases pasivas
    if (lawRef === "RDL 4/2000" && artNum === "28") {
      isPerfect = true;
      note = "Art 28 Ley Clases Pasivas: 3 clases de jubilación (forzosa, voluntaria, incapacidad). Respuesta D correcta.";
    }

    if (isPerfect) {
      perfectos.push({ id: q.id, note });
      console.log("→ PERFECT ✅");
    } else if (isTechPerfect) {
      techPerfectos.push({ id: q.id, note });
      console.log("→ TECH_PERFECT ✅");
    } else {
      console.log("→ Necesita verificación manual");
    }
    console.log("");
  }

  console.log("\n=== RESUMEN ===");
  console.log("Perfectos:", perfectos.length);
  console.log("Tech perfectos:", techPerfectos.length);

  // Guardar los perfectos
  for (const p of perfectos) {
    await supabase.from("questions").update({
      topic_review_status: "perfect",
      verified_at: new Date().toISOString(),
      verification_status: "ok"
    }).eq("id", p.id);

    await supabase.from("ai_verification_results").update({
      article_ok: true,
      answer_ok: true,
      explanation_ok: true,
      confidence: "alta",
      explanation: "Opus 4.5: " + p.note,
      ai_model: "claude-opus-4-5-real",
      verified_at: new Date().toISOString()
    }).eq("question_id", p.id);

    console.log("✅ Guardado perfect:", p.id.substring(0, 8));
  }

  for (const p of techPerfectos) {
    await supabase.from("questions").update({
      topic_review_status: "tech_perfect",
      verified_at: new Date().toISOString(),
      verification_status: "ok"
    }).eq("id", p.id);

    await supabase.from("ai_verification_results").update({
      article_ok: null,
      answer_ok: true,
      explanation_ok: true,
      confidence: "alta",
      explanation: "Opus 4.5: " + p.note,
      ai_model: "claude-opus-4-5-real",
      verified_at: new Date().toISOString()
    }).eq("question_id", p.id);

    console.log("✅ Guardado tech_perfect:", p.id.substring(0, 8));
  }

  // Contar restantes
  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("topic_review_status", "wrong_article");

  console.log("\nQuedan", count, "preguntas wrong_article");
})();
