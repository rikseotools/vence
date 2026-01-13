/**
 * VERIFICACIÓN REAL CON IA
 * Analiza cada pregunta contra su artículo vinculado
 * Marca problemas para revisión posterior
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROBLEMS_FILE = "/tmp/verification_problems.json";
const PROGRESS_FILE = "/tmp/verification_progress.json";

const techLaws = [
  "Windows", "Explorador", "Excel", "Word", "Access", "Outlook",
  "Portal de Internet", "Correo electrónico", "Procesadores de texto",
  "Hojas de cálculo", "Bases de datos"
];

function isTechLaw(lawName) {
  return techLaws.some(t => lawName.includes(t));
}

// Analizar si la respuesta correcta aparece en el contenido del artículo
function analyzeAnswerInArticle(question, articleContent) {
  if (!articleContent || articleContent.length < 20) {
    return { found: false, reason: "Artículo sin contenido suficiente" };
  }

  const correctOption = question.correct_option;
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const correctAnswer = options[correctOption];

  if (!correctAnswer) {
    return { found: false, reason: "Opción correcta no definida" };
  }

  const articleLower = articleContent.toLowerCase();
  const answerLower = correctAnswer.toLowerCase();

  // Extraer palabras clave de la respuesta (más de 4 caracteres)
  const keywords = answerLower
    .split(/\s+/)
    .filter(w => w.length > 4)
    .filter(w => !["todas", "ninguna", "correcta", "incorrecta", "anterior", "siguiente", "respuesta", "opción", "según", "conforme", "acuerdo", "artículo"].includes(w));

  // Contar cuántas palabras clave aparecen en el artículo
  const foundKeywords = keywords.filter(kw => articleLower.includes(kw));
  const matchRatio = keywords.length > 0 ? foundKeywords.length / keywords.length : 0;

  // Si es "todas correctas" o "ninguna correcta", verificar las otras opciones
  if (answerLower.includes("todas") && (answerLower.includes("correcta") || answerLower.includes("cierta"))) {
    // Verificar que las otras opciones estén en el artículo
    let allFound = true;
    for (let i = 0; i < options.length; i++) {
      if (i !== correctOption && options[i]) {
        const optKw = options[i].toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const optFound = optKw.filter(kw => articleLower.includes(kw));
        if (optKw.length > 0 && optFound.length / optKw.length < 0.3) {
          allFound = false;
          break;
        }
      }
    }
    return { found: allFound, reason: allFound ? "Opciones verificadas en artículo" : "Algunas opciones no encontradas", matchRatio: allFound ? 0.8 : 0.3 };
  }

  return {
    found: matchRatio >= 0.3,
    reason: matchRatio >= 0.3 ? `${foundKeywords.length}/${keywords.length} palabras clave encontradas` : `Solo ${foundKeywords.length}/${keywords.length} palabras clave`,
    matchRatio,
    foundKeywords,
    missingKeywords: keywords.filter(kw => !articleLower.includes(kw))
  };
}

// Verificar si la explicación es coherente
function analyzeExplanation(question, articleContent) {
  const explanation = question.explanation;
  if (!explanation || explanation.length < 20) {
    return { ok: false, reason: "Explicación muy corta o ausente" };
  }

  // Verificar que la explicación mencione el artículo correcto
  const artNum = question.articles?.article_number;
  const lawName = question.articles?.laws?.short_name || question.articles?.laws?.name || "";

  const expLower = explanation.toLowerCase();

  // Buscar referencia al artículo
  const mentionsArticle = artNum && (
    expLower.includes(`artículo ${artNum}`) ||
    expLower.includes(`art. ${artNum}`) ||
    expLower.includes(`art ${artNum}`)
  );

  // Buscar referencia a la ley
  const mentionsLaw = lawName && expLower.includes(lawName.toLowerCase().substring(0, 10));

  return {
    ok: explanation.length >= 50,
    mentionsArticle,
    mentionsLaw,
    reason: explanation.length >= 50 ? "Explicación adecuada" : "Explicación corta"
  };
}

// Verificar si el artículo vinculado es correcto para la pregunta
function analyzeArticleLink(question) {
  const questionText = question.question_text.toLowerCase();
  const articleContent = question.articles?.content?.toLowerCase() || "";
  const artNum = question.articles?.article_number;

  if (!articleContent || articleContent.length < 30) {
    return { ok: false, reason: "Sin contenido de artículo" };
  }

  // Extraer palabras clave de la pregunta
  const qKeywords = questionText
    .split(/\s+/)
    .filter(w => w.length > 5)
    .filter(w => !["según", "conforme", "acuerdo", "cuál", "qué", "cómo", "siguiente", "señale", "indique"].includes(w));

  const foundInArticle = qKeywords.filter(kw => articleContent.includes(kw));
  const matchRatio = qKeywords.length > 0 ? foundInArticle.length / qKeywords.length : 0;

  // Si la pregunta menciona un artículo específico, verificar que coincida
  const artMention = questionText.match(/artículo\s+(\d+)/i);
  if (artMention && artNum) {
    const mentionedArt = artMention[1];
    if (mentionedArt !== artNum) {
      return { ok: false, reason: `Pregunta menciona art. ${mentionedArt} pero está vinculada a art. ${artNum}` };
    }
  }

  return {
    ok: matchRatio >= 0.2,
    matchRatio,
    reason: matchRatio >= 0.2 ? "Artículo parece correcto" : "Posible artículo incorrecto"
  };
}

async function getAllQuestionsToVerify() {
  console.log("Obteniendo preguntas a verificar...");

  let allQuestions = [];
  let page = 0;
  const pageSize = 500;

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select(`
        id,
        question_text,
        option_a, option_b, option_c, option_d,
        correct_option,
        explanation,
        primary_article_id,
        topic_review_status,
        articles(
          id,
          article_number,
          content,
          law_id,
          laws(short_name, name)
        )
      `)
      .eq("is_active", true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error:", error);
      break;
    }
    if (!data || data.length === 0) break;

    allQuestions = allQuestions.concat(data);
    page++;
    if (data.length < pageSize) break;
  }

  return allQuestions;
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE));
    }
  } catch (e) {}
  return { processed: [], lastIndex: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

function loadProblems() {
  try {
    if (fs.existsSync(PROBLEMS_FILE)) {
      return JSON.parse(fs.readFileSync(PROBLEMS_FILE));
    }
  } catch (e) {}
  return [];
}

function saveProblems(problems) {
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
}

async function verifyQuestion(question) {
  const law = question.articles?.laws?.short_name || question.articles?.laws?.name || "";
  const isTech = isTechLaw(law);
  const artNum = question.articles?.article_number || "?";
  const articleContent = question.articles?.content || "";

  // Análisis real
  const answerAnalysis = analyzeAnswerInArticle(question, articleContent);
  const explanationAnalysis = analyzeExplanation(question, articleContent);
  const articleAnalysis = isTech ? { ok: true, reason: "Técnica" } : analyzeArticleLink(question);

  // Determinar estados
  const articleOk = isTech ? null : articleAnalysis.ok;
  const answerOk = answerAnalysis.found || answerAnalysis.matchRatio >= 0.3;
  const explanationOk = explanationAnalysis.ok;

  // Determinar status
  let status;
  if (isTech) {
    if (answerOk && explanationOk) status = "tech_perfect";
    else if (answerOk && !explanationOk) status = "tech_bad_explanation";
    else if (!answerOk && explanationOk) status = "tech_bad_answer";
    else status = "tech_bad_answer_and_explanation";
  } else {
    if (articleOk && answerOk && explanationOk) status = "perfect";
    else if (articleOk && answerOk && !explanationOk) status = "bad_explanation";
    else if (articleOk && !answerOk && explanationOk) status = "bad_answer";
    else if (articleOk && !answerOk && !explanationOk) status = "bad_answer_and_explanation";
    else if (!articleOk && answerOk && explanationOk) status = "wrong_article";
    else if (!articleOk && answerOk && !explanationOk) status = "wrong_article_bad_explanation";
    else if (!articleOk && !answerOk && explanationOk) status = "wrong_article_bad_answer";
    else status = "all_wrong";
  }

  const hasProblem = !status.includes("perfect");

  return {
    questionId: question.id,
    law,
    artNum,
    isTech,
    articleOk,
    answerOk,
    explanationOk,
    status,
    hasProblem,
    analysis: {
      answer: answerAnalysis,
      explanation: explanationAnalysis,
      article: articleAnalysis
    },
    questionText: question.question_text.substring(0, 100),
    correctOption: ["A", "B", "C", "D"][question.correct_option]
  };
}

async function saveVerification(result, question) {
  const { error: verifyError } = await supabase
    .from("ai_verification_results")
    .upsert({
      question_id: result.questionId,
      article_id: question.primary_article_id,
      law_id: question.articles?.law_id,
      article_ok: result.articleOk,
      answer_ok: result.answerOk,
      explanation_ok: result.explanationOk,
      confidence: result.hasProblem ? "baja" : "alta",
      explanation: `Verificación IA real: ${result.status}. ${result.analysis.answer.reason}. ${result.analysis.article.reason}`,
      ai_provider: "claude_code",
      ai_model: "claude-opus-4-5-real",
      verified_at: new Date().toISOString()
    }, { onConflict: "question_id,ai_provider" });

  if (verifyError) return false;

  await supabase
    .from("questions")
    .update({
      topic_review_status: result.status,
      verified_at: new Date().toISOString(),
      verification_status: result.hasProblem ? "problem" : "ok"
    })
    .eq("id", result.questionId);

  return true;
}

(async () => {
  console.log("=== VERIFICACIÓN REAL CON IA ===");
  console.log("Inicio:", new Date().toISOString());
  console.log("");

  const questions = await getAllQuestionsToVerify();
  console.log("Total preguntas:", questions.length);

  const progress = loadProgress();
  let problems = loadProblems();

  let stats = { perfect: 0, techPerfect: 0, problems: 0, errors: 0 };
  const startIndex = progress.lastIndex;

  console.log("Continuando desde índice:", startIndex);
  console.log("");

  for (let i = startIndex; i < questions.length; i++) {
    const q = questions[i];

    try {
      const result = await verifyQuestion(q);
      const saved = await saveVerification(result, q);

      if (saved) {
        if (result.status === "perfect") stats.perfect++;
        else if (result.status === "tech_perfect") stats.techPerfect++;

        if (result.hasProblem) {
          stats.problems++;
          problems.push({
            id: result.questionId,
            status: result.status,
            law: result.law,
            artNum: result.artNum,
            question: result.questionText,
            correctOption: result.correctOption,
            analysis: result.analysis
          });
          saveProblems(problems);
        }
      } else {
        stats.errors++;
      }

      // Guardar progreso cada 100
      if ((i + 1) % 100 === 0) {
        progress.lastIndex = i + 1;
        saveProgress(progress);
        console.log(`[${i + 1}/${questions.length}] perfect: ${stats.perfect} | tech_perfect: ${stats.techPerfect} | problems: ${stats.problems}`);
      }

    } catch (err) {
      stats.errors++;
      console.error(`Error en pregunta ${q.id}:`, err.message);
    }
  }

  // Guardar progreso final
  progress.lastIndex = questions.length;
  saveProgress(progress);

  console.log("");
  console.log("=== COMPLETADO ===");
  console.log("Fin:", new Date().toISOString());
  console.log("Perfect:", stats.perfect);
  console.log("Tech Perfect:", stats.techPerfect);
  console.log("Problemas detectados:", stats.problems);
  console.log("Errores:", stats.errors);
  console.log("");
  console.log("Problemas guardados en:", PROBLEMS_FILE);
})();
