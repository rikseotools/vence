const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function markPerfect(questionId, description) {
  const { error } = await supabase
    .from("questions")
    .update({
      topic_review_status: "perfect",
      verification_status: "ok"
    })
    .eq("id", questionId);

  if (error) {
    console.log("❌ Error:", error.message);
    return false;
  }
  console.log("✅ PERFECT:", description);
  return true;
}

async function findArticle(lawShortName, articleNumber) {
  const { data, error } = await supabase
    .from("articles")
    .select("id, article_number, laws!inner(short_name)")
    .eq("laws.short_name", lawShortName)
    .eq("article_number", articleNumber)
    .single();

  if (error || !data) {
    console.log("❌ No encontrado:", lawShortName, "art.", articleNumber);
    return null;
  }
  return data.id;
}

async function fixArticle(questionId, newArticleId, description) {
  const { error } = await supabase
    .from("questions")
    .update({
      primary_article_id: newArticleId,
      topic_review_status: null,
      verification_status: null,
      verified_at: null
    })
    .eq("id", questionId);

  if (error) {
    console.log("❌ Error:", error.message);
    return false;
  }
  console.log("✅ FIXED:", description);
  return true;
}

async function main() {
  console.log("🔧 CORRIGIENDO 9 PREGUNTAS BAD_EXPLANATION:\n");

  // 1. Falsos positivos - marcar como PERFECT
  console.log("📌 Marcando falsos positivos como PERFECT:\n");

  await markPerfect(
    "cedbbe45-53b4-4698-8763-dfc9cc2ac7c9",
    "CE art. 59 (Regencia)"
  );

  await markPerfect(
    "abe2219a-cf3e-4621-9fba-80a8681631ff",
    "CE art. 72 (Presidente sesión conjunta)"
  );

  // 2. Wrong Article - buscar artículos correctos y corregir
  console.log("\n📌 Corrigiendo WRONG_ARTICLE:\n");

  // LO 6/1985 art. 63 → art. 64 (Salas de la AN)
  const lopjArt64 = await findArticle("LOPJ", "64");
  if (lopjArt64) {
    await fixArticle(
      "5c7e1bb1-300a-4ddb-8f5d-86b694f9535a",
      lopjArt64,
      "LO 6/1985: art. 63 → art. 64 (Salas AN)"
    );
  }

  // Ley 29/1998 art. 10 → art. 12 (Competencias TS)
  const ljca12 = await findArticle("LJCA", "12");
  if (ljca12) {
    await fixArticle(
      "01421ef1-e164-4784-9999-3f62530e144d",
      ljca12,
      "Ley 29/1998: art. 10 → art. 12 (Competencias TS)"
    );
  }

  // Ley 40/2015 art. 12 → art. 11 (Encomienda de gestión)
  const ley40art11 = await findArticle("Ley 40/2015", "11");
  if (ley40art11) {
    await fixArticle(
      "4b78a36e-898f-4849-b391-1b0bd14d2172",
      ley40art11,
      "Ley 40/2015: art. 12 → art. 11 (Encomienda gestión)"
    );
  }

  // Ley 39/2015 art. 42 → art. 41 (Rechazo notificación)
  const ley39art41 = await findArticle("Ley 39/2015", "41");
  if (ley39art41) {
    await fixArticle(
      "8960ddaa-1e1b-444b-ab5c-2efcb62a9330",
      ley39art41,
      "Ley 39/2015: art. 42 → art. 41 (Rechazo notificación)"
    );
  }

  // Ley 39/2015 art. 31 → art. 30 (Días hábiles)
  const ley39art30 = await findArticle("Ley 39/2015", "30");
  if (ley39art30) {
    await fixArticle(
      "9a539b47-c8f3-426f-b12c-bc3bfdeb845a",
      ley39art30,
      "Ley 39/2015: art. 31 → art. 30 (Días hábiles)"
    );
  }

  // 3. Marcar Ley 19/2013 art. 26 como perfecto (la explicación está bien, es detallada)
  await markPerfect(
    "ca577a74-57a5-4741-a4bd-e552fdac966d",
    "Ley 19/2013 art. 26 (Principios buen gobierno)"
  );

  // 4. La pregunta sobre art. 126 necesita investigar cuál es el artículo correcto
  console.log("\n⚠️ Pendiente: Ley 39/2015 art. 126 - buscar artículo correcto sobre 'supresión reclamaciones previas'");
  console.log("   ID: 3966ca29-5cd7-4188-a0e0-6a6ca05b9b30");
}

main();
