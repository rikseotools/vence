const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROBLEMS_FILE = "/tmp/verification_problems.json";

function loadProblems() {
  try {
    if (fs.existsSync(PROBLEMS_FILE)) {
      return JSON.parse(fs.readFileSync(PROBLEMS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function saveProblems(problems) {
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
}

async function saveVerification(questionId, result) {
  const { data: q } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      primary_article_id,
      articles!questions_primary_article_id_fkey (
        id,
        law_id
      )
    `)
    .eq("id", questionId)
    .single();

  if (!q) {
    console.log("Pregunta no encontrada:", questionId);
    return false;
  }

  const verification = {
    question_id: q.id,
    article_id: q.articles?.id,
    law_id: q.articles?.law_id,
    is_correct: result.answerOk,
    confidence: "alta",
    explanation: result.reasoning,
    article_quote: result.articleQuote || null,
    suggested_fix: result.suggestedFix || null,
    correct_option_should_be: result.correctOptionShouldBe || null,
    ai_provider: "anthropic",
    ai_model: "claude-opus-4-5-real",
    verified_at: new Date().toISOString(),
    article_ok: result.articleOk,
    answer_ok: result.answerOk,
    explanation_ok: result.explanationOk,
    correct_article_suggestion: result.correctArticleSuggestion || null,
    explanation_fix: result.explanationFix || null
  };

  const { data: existing } = await supabase
    .from("ai_verification_results")
    .select("id")
    .eq("question_id", q.id)
    .eq("ai_provider", "anthropic")
    .single();

  let error;
  if (existing) {
    const { error: updateErr } = await supabase
      .from("ai_verification_results")
      .update(verification)
      .eq("id", existing.id);
    error = updateErr;
  } else {
    const { error: insertErr } = await supabase
      .from("ai_verification_results")
      .insert(verification);
    error = insertErr;
  }

  if (error) {
    console.error("Error saving:", error.message);
    return false;
  }

  const status = result.articleOk && result.answerOk && result.explanationOk ? "ok" : "problem";

  await supabase
    .from("questions")
    .update({
      verification_status: status,
      topic_review_status: result.status,
      verified_at: new Date().toISOString()
    })
    .eq("id", q.id);

  if (status === "problem") {
    const problems = loadProblems();
    problems.push({
      questionId: q.id,
      questionText: q.question_text,
      status: result.status,
      articleOk: result.articleOk,
      answerOk: result.answerOk,
      explanationOk: result.explanationOk,
      reasoning: result.reasoning,
      timestamp: new Date().toISOString()
    });
    saveProblems(problems);
  }

  return true;
}

// Lote 2 de verificaciones
const verifications = [
  // 1. Art 55.4 Ley 40/2015 - Delegados Gobierno rango Subsecretario - PERFECT
  {
    id: "d30f346e-1426-480d-88e0-378371cf1b38",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 55.4 Ley 40/2015: 'los Delegados del Gobierno en las CCAA, que tendran rango de Subsecretario'. Opcion B correcta.",
      articleQuote: "los Delegados del Gobierno en las Comunidades Autonomas, que tendran rango de Subsecretario"
    }
  },
  // 2. Agenda 2030 - 17 ODS y 169 metas - wrong_article
  {
    id: "eb74b8ba-c4b0-4d43-ad4c-5d638d127bd7",
    result: {
      articleOk: false, answerOk: true, explanationOk: true, status: "wrong_article",
      reasoning: "Art 1 Agenda 2030 no especifica numero de ODS ni metas. Deberia vincularse a documento general Agenda 2030.",
      correctArticleSuggestion: "Resolucion ONU A/RES/70/1 Agenda 2030"
    }
  },
  // 3. Primero y ultimo ODS - wrong_article (parcial)
  {
    id: "17118a2e-a823-451a-881c-acccf22bba9a",
    result: {
      articleOk: false, answerOk: true, explanationOk: true, status: "wrong_article",
      reasoning: "Art 1 solo muestra ODS 1. No incluye ODS 17 para verificar la respuesta completa.",
      correctArticleSuggestion: "Agenda 2030 completa (ODS 1 y 17)"
    }
  },
  // 4. ODS 15 - Vida ecosistemas terrestres - PERFECT
  {
    id: "fb97e972-70d7-44c7-b344-45695faecf77",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 15 Agenda 2030: 'Proteger, restablecer y promover el uso sostenible de los ecosistemas terrestres'. ODS 15 correcto.",
      articleQuote: "Proteger, restablecer y promover el uso sostenible de los ecosistemas terrestres"
    }
  },
  // 5. Presidencia Foro Gobierno Abierto - wrong_article
  {
    id: "f425728b-e736-440b-814a-cdef79e35ee0",
    result: {
      articleOk: false, answerOk: true, explanationOk: true, status: "wrong_article",
      reasoning: "Art 1 Gobierno Abierto generico no contiene info sobre Presidencia del Foro.",
      correctArticleSuggestion: "Orden HFP/134/2018 o RD 210/2024"
    }
  },
  // 6. Ejes IV Plan - wrong_article
  {
    id: "e92e93af-371c-4444-87bf-af8ec0696941",
    result: {
      articleOk: false, answerOk: true, explanationOk: true, status: "wrong_article",
      reasoning: "Art 1 Gobierno Abierto generico no contiene ejes del IV Plan.",
      correctArticleSuggestion: "IV Plan de Gobierno Abierto"
    }
  },
  // 7. ODS 13 - Accion por el clima - PERFECT
  {
    id: "410f8f2b-bcd2-45be-a878-829336efdd69",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 13 Agenda 2030: 'Adoptar medidas urgentes para combatir el cambio climatico y sus efectos'. ODS 13 correcto.",
      articleQuote: "Adoptar medidas urgentes para combatir el cambio climatico y sus efectos"
    }
  },
  // 8. ODS 8 - Trabajo decente - PERFECT
  {
    id: "12e2319f-c23e-47ce-9a0b-478f3832062f",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 8 Agenda 2030: 'Promover el crecimiento economico sostenido, inclusivo y sostenible, el empleo pleno y productivo y el trabajo decente para todos'. Opcion A correcta.",
      articleQuote: "Promover el crecimiento economico sostenido, inclusivo y sostenible, el empleo pleno y productivo y el trabajo decente para todos"
    }
  },
  // 9. Foro integrado por Presidente y 64 vocales - PERFECT (Orden HFP/134/2018 Art 3)
  {
    id: "b586ff1c-d118-4797-a8ed-4cca5ac322d8",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 3.1 Orden HFP/134/2018: 'El Foro estara integrado por el Presidente y sesenta y cuatro vocales'. Opcion D correcta.",
      articleQuote: "El Foro estara integrado por el Presidente y sesenta y cuatro vocales"
    }
  },
  // 10. Art 66 Ley 40/2015 - Directores Generales - PERFECT
  {
    id: "86d5c36b-5cf1-4471-adcb-87b061bb9659",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 66.1.a Ley 40/2015: 'Proponer los proyectos de su Direccion general para alcanzar los objetivos establecidos por el Ministro, dirigir su ejecucion y controlar su adecuado cumplimiento'. Opcion D correcta.",
      articleQuote: "Proponer los proyectos de su Direccion general para alcanzar los objetivos establecidos por el Ministro"
    }
  },
  // 11. Art 63 Ley 40/2015 - Competencia INCORRECTA Subsecretarios - BAD_ANSWER
  {
    id: "8aa9d55a-7e72-4efc-a99d-f505af6dd987",
    result: {
      articleOk: true, answerOk: false, explanationOk: false, status: "bad_answer",
      reasoning: "ERROR: El Art 63.1.n SI menciona 'Ejercer la potestad disciplinaria del personal del Departamento por faltas graves o muy graves, salvo la separacion del servicio'. Por tanto, la opcion C NO es incorrecta, SI es competencia del Subsecretario. La respuesta marcada es erronea.",
      articleQuote: "Ejercer la potestad disciplinaria del personal del Departamento por faltas graves o muy graves, salvo la separacion del servicio",
      suggestedFix: "Revisar cual de las opciones realmente NO es competencia del Subsecretario segun Art 63 Ley 40/2015"
    }
  },
  // 12. Art 62.2 Ley 40/2015 - Secretarios de Estado - PERFECT
  {
    id: "4421a813-2d57-45e1-8ca7-7b20a7d609cd",
    result: {
      articleOk: true, answerOk: true, explanationOk: true, status: "perfect",
      reasoning: "Art 62.2 Ley 40/2015: 'Los Secretarios de Estado dirigen y coordinan las Secretarias y las Direcciones Generales situadas bajo su dependencia'. Opcion D correcta.",
      articleQuote: "Los Secretarios de Estado dirigen y coordinan las Secretarias y las Direcciones Generales situadas bajo su dependencia"
    }
  }
];

(async () => {
  console.log("Guardando", verifications.length, "verificaciones...\n");

  let ok = 0, errors = 0, problems = 0;
  for (const v of verifications) {
    const saved = await saveVerification(v.id, v.result);
    if (saved) {
      ok++;
      if (v.result.status !== "perfect") problems++;
      console.log("OK:", v.id.substring(0, 8), "-", v.result.status);
    } else {
      errors++;
      console.log("ERROR:", v.id.substring(0, 8));
    }
  }

  console.log("\nResumen: OK=" + ok + ", Errors=" + errors + ", Problems=" + problems);
})();
