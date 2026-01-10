const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monicaId = "dc5ac505-4535-47df-b086-e454656646ce";

  console.log("🔍 INVESTIGACIÓN PROFUNDA DEL BUG...");
  console.log("═".repeat(70));

  // 1. Ver TODOS los tests de Monica en la tabla "tests"
  const { data: monicaTests, error: testsError } = await supabase
    .from("tests")
    .select("*")
    .eq("user_id", monicaId)
    .order("created_at", { ascending: false });

  console.log("\n🎯 TESTS DE MONICA EN TABLA 'tests':", monicaTests?.length || 0);
  if (testsError) console.log("   Error:", testsError.message);

  for (const t of (monicaTests || []).slice(0, 10)) {
    const fecha = new Date(t.created_at).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    console.log("\n   [" + fecha + "] ID: " + t.id.substring(0, 8));
    console.log("   Tipo:", t.test_type);
    console.log("   Total:", t.total_questions, "| Completado:", t.is_completed);
    console.log("   Tema:", t.tema_number);
  }

  // 2. Ver test_questions de Monica
  const { data: monicaAnswers, error: answersError } = await supabase
    .from("test_questions")
    .select("*, tests!inner(user_id, created_at)")
    .eq("tests.user_id", monicaId)
    .order("created_at", { ascending: false })
    .limit(30);

  console.log("\n\n📝 RESPUESTAS DE MONICA EN 'test_questions':", monicaAnswers?.length || 0);
  if (answersError) console.log("   Error:", answersError.message);

  // Agrupar por fecha
  const answersByDay = {};
  for (const a of monicaAnswers || []) {
    const day = a.created_at?.split("T")[0];
    if (!answersByDay[day]) answersByDay[day] = 0;
    answersByDay[day]++;
  }

  for (const [day, count] of Object.entries(answersByDay).sort().reverse()) {
    console.log("   " + day + ": " + count + " respuestas");
  }

  // 3. Comparar con otro usuario que SÍ tiene preguntas hoy
  const { data: workingUser } = await supabase
    .from("user_sessions")
    .select("user_id")
    .gte("session_start", "2026-01-10T00:00:00")
    .gt("questions_answered", 0)
    .limit(1)
    .single();

  if (workingUser) {
    console.log("\n\n📊 COMPARANDO CON USUARIO QUE SÍ FUNCIONA:");
    console.log("   User ID:", workingUser.user_id);

    const { data: workingTests } = await supabase
      .from("tests")
      .select("id, test_type, total_questions, is_completed, created_at")
      .eq("user_id", workingUser.user_id)
      .gte("created_at", "2026-01-10T00:00:00");

    console.log("   Tests hoy:", workingTests?.length || 0);
    for (const t of workingTests || []) {
      console.log("     - " + t.test_type + ": " + t.total_questions + " preguntas, completado:" + t.is_completed);
    }
  }

  // 4. Ver si hay algún patrón en los usuarios con 0 preguntas
  console.log("\n\n🔍 ANALIZANDO PATRÓN DE USUARIOS CON 0 PREGUNTAS:");

  const { data: zeroQuestionsSessions } = await supabase
    .from("user_sessions")
    .select("user_id, entry_page, session_start, referrer_url")
    .gte("session_start", "2026-01-08T00:00:00")
    .eq("questions_answered", 0)
    .or("entry_page.ilike.%/test/%,entry_page.ilike.%aleatorio%");

  // Ver si estos usuarios tienen tests en la tabla tests
  const usersWithZero = [...new Set((zeroQuestionsSessions || []).map(s => s.user_id).filter(Boolean))];
  console.log("   Usuarios únicos con 0 preguntas:", usersWithZero.length);

  for (const userId of usersWithZero.slice(0, 5)) {
    const { data: userTests } = await supabase
      .from("tests")
      .select("id, is_completed, created_at")
      .eq("user_id", userId)
      .gte("created_at", "2026-01-08T00:00:00");

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("is_premium, plan_type")
      .eq("id", userId)
      .single();

    console.log("\n   User " + userId.substring(0, 8) + ":");
    console.log("     Plan:", userProfile?.plan_type || "free");
    console.log("     Tests en BD:", userTests?.length || 0);
    if (userTests?.length > 0) {
      console.log("     Completados:", userTests.filter(t => t.is_completed).length);
    }
  }

  // 5. Verificar si el problema es específico de cierto test_type o URL
  console.log("\n\n📍 URLS CON PROBLEMAS (0 preguntas):");
  const urlCounts = {};
  for (const s of zeroQuestionsSessions || []) {
    // Extraer path base sin query params
    const url = s.entry_page?.split("?")[0] || "unknown";
    const shortUrl = url.replace("https://www.vence.es", "").replace("http://localhost:3000", "");
    if (!urlCounts[shortUrl]) urlCounts[shortUrl] = 0;
    urlCounts[shortUrl]++;
  }

  const sortedUrls = Object.entries(urlCounts).sort((a, b) => b[1] - a[1]);
  for (const [url, count] of sortedUrls.slice(0, 10)) {
    console.log("   " + count + "x → " + url);
  }

  console.log("\n" + "═".repeat(70));
}

main();
