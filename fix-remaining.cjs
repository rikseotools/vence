const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixQuestion(questionId, newArticleId, description) {
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
    console.log("❌ Error en " + description + ":", error.message);
    return false;
  }
  console.log("✅ " + description);
  return true;
}

async function main() {
  console.log("🔧 Aplicando 4 fixes de wrong_article...\n");

  // Fix 1: Ley 29/1998 art. 10 → art. 12
  await fixQuestion(
    "01421ef1-c4cc-4b76-ae4f-6a0d8f87ab2c",
    "82ee47f4-f421-489b-b151-ab1f62b2dcbd",
    "Ley 29/1998: art. 10 → art. 12 (Juzgados Central Contencioso)"
  );

  // Fix 2: Ley 40/2015 art. 12 → art. 11
  await fixQuestion(
    "4b78a36e-1ff3-4bd6-8eda-f5c30d1f7802",
    "d1e36b44-093e-4d29-8a58-c38a9917f810",
    "Ley 40/2015: art. 12 → art. 11 (Competencia)"
  );

  // Fix 3: Ley 39/2015 art. 42 → art. 41
  await fixQuestion(
    "8960ddaa-8ad9-4ad7-bc73-5ce83098d9aa",
    "d757d1a8-875e-410d-b281-0b1f088ec910",
    "Ley 39/2015: art. 42 → art. 41 (Condiciones notificación)"
  );

  // Fix 4: Ley 39/2015 art. 31 → art. 30
  await fixQuestion(
    "9a539b47-a5fa-4bd9-b6cf-93ce63af21e7",
    "c174facc-4f69-4cd2-9e19-f8e8fcefd834",
    "Ley 39/2015: art. 31 → art. 30 (Cómputo plazos)"
  );

  console.log("\n✅ Fixes aplicados. Ejecutando check-problems.cjs...\n");
}

main();
