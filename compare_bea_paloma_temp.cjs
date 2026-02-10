require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";
  const paloma = "0e3b7956-1a2b-42d4-84c8-66e704128fb9";

  console.log("=== COMPARACIÓN DETALLADA: BEA vs PALOMA ===\n");

  for (const [name, id] of [["BEA", bea], ["PALOMA", paloma]]) {
    // Perfil
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    // Device info reciente
    const { data: interactions } = await supabase
      .from("user_interactions")
      .select("device_info, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Auth info
    const { data: authUser } = await supabase.auth.admin.getUserById(id);

    // Contar sesiones y tests
    const { count: sessionCount } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);

    const { count: testCount } = await supabase
      .from("test_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);

    console.log(`=== ${name} ===`);
    console.log("");

    // Info básica
    console.log("CUENTA:");
    console.log(`  Email: ${profile?.email}`);
    console.log(`  Registrada: ${profile?.created_at?.split("T")[0]}`);
    console.log(`  Plan: ${profile?.plan_type}`);
    console.log(`  Fuente registro: ${profile?.registration_source}`);
    console.log(`  Oposición: ${profile?.target_oposicion}`);
    console.log(`  Auth provider: ${authUser?.user?.app_metadata?.provider}`);

    // Dispositivo
    const device = interactions?.[0]?.device_info;
    const ua = device?.userAgent || "";

    console.log("");
    console.log("DISPOSITIVO:");
    console.log(`  Platform: ${device?.platform}`);
    console.log(`  Pantalla: ${device?.screenWidth}x${device?.screenHeight}`);
    console.log(`  Standalone (PWA): ${device?.isStandalone}`);
    console.log(`  Idioma: ${device?.language}`);

    // Versiones
    const iosVer = ua.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".");
    const safariVer = ua.match(/Version\/(\d+\.\d+)/)?.[1];
    const webkitVer = ua.match(/AppleWebKit\/(\d+\.\d+)/)?.[1];

    console.log("");
    console.log("VERSIONES:");
    console.log(`  iOS: ${iosVer}`);
    console.log(`  Safari: ${safariVer}`);
    console.log(`  WebKit: ${webkitVer}`);

    // User Agent completo
    console.log("");
    console.log("USER AGENT COMPLETO:");
    console.log(`  ${ua}`);

    // Actividad
    console.log("");
    console.log("ACTIVIDAD:");
    console.log(`  Sesiones totales: ${sessionCount}`);
    console.log(`  Tests guardados: ${testCount}`);
    console.log(`  Último login: ${authUser?.user?.last_sign_in_at?.split("T")[0]}`);

    console.log("");
    console.log("=".repeat(60));
    console.log("");
  }

  // Tabla comparativa
  console.log("=== TABLA COMPARATIVA ===\n");

  const { data: beaInt } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: palomaInt } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", paloma)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: beaProfile } = await supabase.from("user_profiles").select("*").eq("id", bea).single();
  const { data: palomaProfile } = await supabase.from("user_profiles").select("*").eq("id", paloma).single();

  const beaUA = beaInt?.device_info?.userAgent || "";
  const palomaUA = palomaInt?.device_info?.userAgent || "";

  const comparisons = [
    ["iOS", beaUA.match(/OS (\d+_\d+)/)?.[1]?.replace("_", "."), palomaUA.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".")],
    ["Safari", beaUA.match(/Version\/(\d+\.\d+)/)?.[1], palomaUA.match(/Version\/(\d+\.\d+)/)?.[1]],
    ["WebKit", beaUA.match(/AppleWebKit\/(\d+\.\d+)/)?.[1], palomaUA.match(/AppleWebKit\/(\d+\.\d+)/)?.[1]],
    ["Pantalla", `${beaInt?.device_info?.screenWidth}x${beaInt?.device_info?.screenHeight}`, `${palomaInt?.device_info?.screenWidth}x${palomaInt?.device_info?.screenHeight}`],
    ["Standalone", String(beaInt?.device_info?.isStandalone), String(palomaInt?.device_info?.isStandalone)],
    ["Idioma", beaInt?.device_info?.language, palomaInt?.device_info?.language],
    ["Plan", beaProfile?.plan_type, palomaProfile?.plan_type],
    ["Fuente", beaProfile?.registration_source, palomaProfile?.registration_source],
    ["Oposición", beaProfile?.target_oposicion, palomaProfile?.target_oposicion],
  ];

  console.log("Característica   | Bea              | Paloma           | ¿Igual?");
  console.log("-".repeat(70));

  for (const [label, beaVal, palomaVal] of comparisons) {
    const equal = beaVal === palomaVal ? "✅ SÍ" : "❌ NO";
    console.log(`${label.padEnd(16)} | ${(beaVal || "?").toString().padEnd(16)} | ${(palomaVal || "?").toString().padEnd(16)} | ${equal}`);
  }

  // Buscar patrones en común
  console.log("\n\n=== ANÁLISIS DE PATRONES COMUNES ===\n");

  // ¿Ambas usan iOS 18.x?
  const beaIOS = beaUA.match(/OS (\d+)/)?.[1];
  const palomaIOS = palomaUA.match(/OS (\d+)/)?.[1];
  console.log(`¿Ambas iOS 18+? Bea: iOS ${beaIOS}, Paloma: iOS ${palomaIOS}`);

  // ¿Ambas tienen isStandalone = false?
  console.log(`¿Ambas NO usan PWA? Bea: ${!beaInt?.device_info?.isStandalone}, Paloma: ${!palomaInt?.device_info?.isStandalone}`);

  // ¿Ambas premium?
  console.log(`¿Ambas premium? Bea: ${beaProfile?.plan_type === 'premium'}, Paloma: ${palomaProfile?.plan_type === 'premium'}`);

  // ¿Ambas Google Auth?
  const { data: beaAuth } = await supabase.auth.admin.getUserById(bea);
  const { data: palomaAuth } = await supabase.auth.admin.getUserById(paloma);
  console.log(`¿Ambas Google Auth? Bea: ${beaAuth?.user?.app_metadata?.provider}, Paloma: ${palomaAuth?.user?.app_metadata?.provider}`);

  // ¿Similar pantalla? (mismo modelo de iPhone?)
  const beaScreen = `${beaInt?.device_info?.screenWidth}x${beaInt?.device_info?.screenHeight}`;
  const palomaScreen = `${palomaInt?.device_info?.screenWidth}x${palomaInt?.device_info?.screenHeight}`;
  console.log(`¿Similar pantalla? Bea: ${beaScreen}, Paloma: ${palomaScreen}`);

  // Detectar modelo de iPhone por resolución
  const screenToModel = {
    "430x932": "iPhone 14 Pro / 15 / 15 Pro",
    "393x852": "iPhone 14 / 15",
    "428x926": "iPhone 12/13 Pro Max / 14 Plus",
    "390x844": "iPhone 12/13/14",
    "375x812": "iPhone X/XS/11 Pro",
    "414x896": "iPhone XR/XS Max/11/11 Pro Max",
    "375x667": "iPhone 6/7/8/SE",
    "320x568": "iPhone 5/SE 1st gen",
  };

  console.log(`\nModelo estimado Bea: ${screenToModel[beaScreen] || "Desconocido"}`);
  console.log(`Modelo estimado Paloma: ${screenToModel[palomaScreen] || "Desconocido"}`);

})();
