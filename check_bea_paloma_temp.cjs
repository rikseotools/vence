require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Buscar Paloma
  const { data: palomaProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("full_name", "%Paloma%")
    .single();

  const paloma = palomaProfile?.id;

  console.log("=== COMPARACIÓN BEA vs PALOMA ===\n");

  for (const [name, id] of [["BEA", bea], ["PALOMA", paloma]]) {
    if (!id) {
      console.log(`${name}: No encontrada\n`);
      continue;
    }

    // Perfil completo
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    // Device info de sus interacciones
    const { data: interactions } = await supabase
      .from("user_interactions")
      .select("device_info, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    // User sessions
    const { data: sessions } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", id)
      .order("session_start", { ascending: false })
      .limit(3);

    // Auth info
    const { data: authUser } = await supabase.auth.admin.getUserById(id);

    console.log(`=== ${name} ===\n`);

    // Perfil
    console.log("PERFIL:");
    console.log(`  Email: ${profile?.email}`);
    console.log(`  Nombre: ${profile?.full_name}`);
    console.log(`  Creado: ${profile?.created_at}`);
    console.log(`  Plan: ${profile?.plan_type}`);
    console.log(`  Registration source: ${profile?.registration_source}`);
    console.log(`  Target oposición: ${profile?.target_oposicion}`);

    // Auth
    console.log("\nAUTH:");
    console.log(`  Provider: ${authUser?.user?.app_metadata?.provider}`);
    console.log(`  Providers: ${authUser?.user?.app_metadata?.providers?.join(", ")}`);
    console.log(`  Email confirmado: ${authUser?.user?.email_confirmed_at ? "SÍ" : "NO"}`);
    console.log(`  Último login: ${authUser?.user?.last_sign_in_at}`);

    // Device
    const deviceInfo = interactions?.[0]?.device_info;
    console.log("\nDISPOSITIVO:");
    console.log(`  Platform: ${deviceInfo?.platform}`);
    console.log(`  Screen: ${deviceInfo?.screenWidth}x${deviceInfo?.screenHeight}`);
    console.log(`  Language: ${deviceInfo?.language}`);
    console.log(`  Timezone: ${deviceInfo?.timezone}`);
    console.log(`  isMobile: ${deviceInfo?.isMobile}`);
    console.log(`  isStandalone: ${deviceInfo?.isStandalone}`);

    // User Agent completo
    const ua = deviceInfo?.userAgent || "";
    console.log("\nUSER AGENT:");
    console.log(`  ${ua}`);

    // Extraer versiones
    const iosMatch = ua.match(/OS (\d+_\d+)/);
    const safariMatch = ua.match(/Version\/(\d+\.\d+)/);
    const webkitMatch = ua.match(/AppleWebKit\/(\d+\.\d+)/);

    console.log("\nVERSIONES:");
    console.log(`  iOS: ${iosMatch?.[1]?.replace("_", ".") || "?"}`);
    console.log(`  Safari: ${safariMatch?.[1] || "?"}`);
    console.log(`  WebKit: ${webkitMatch?.[1] || "?"}`);

    // Modelo de iPhone (si se puede detectar)
    const modelMatch = ua.match(/iPhone\d+,\d+/);
    console.log(`  Modelo: ${modelMatch?.[0] || "iPhone (modelo no detectado)"}`);

    // Sesiones
    console.log("\nSESIONES RECIENTES:");
    sessions?.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.session_start?.split("T")[0]} - ${s.total_duration_minutes || 0} min`);
      console.log(`     Browser: ${s.browser_name} ${s.browser_version}`);
      console.log(`     OS: ${s.operating_system}`);
      console.log(`     Device: ${s.device_model}`);
    });

    console.log("\n" + "=".repeat(50) + "\n");
  }

  // Comparar características específicas
  console.log("=== RESUMEN COMPARATIVO ===\n");

  const { data: beaInt } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", bea)
    .limit(1)
    .single();

  const { data: palomaInt } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", paloma)
    .limit(1)
    .single();

  const beaUA = beaInt?.device_info?.userAgent || "";
  const palomaUA = palomaInt?.device_info?.userAgent || "";

  // Comparar
  const beaIOS = beaUA.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".");
  const palomaIOS = palomaUA.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".");

  const beaSafari = beaUA.match(/Version\/(\d+\.\d+)/)?.[1];
  const palomaSafari = palomaUA.match(/Version\/(\d+\.\d+)/)?.[1];

  const beaWebKit = beaUA.match(/AppleWebKit\/(\d+\.\d+)/)?.[1];
  const palomaWebKit = palomaUA.match(/AppleWebKit\/(\d+\.\d+)/)?.[1];

  const beaScreen = `${beaInt?.device_info?.screenWidth}x${beaInt?.device_info?.screenHeight}`;
  const palomaScreen = `${palomaInt?.device_info?.screenWidth}x${palomaInt?.device_info?.screenHeight}`;

  console.log("Característica      | Bea          | Paloma       | ¿Igual?");
  console.log("-".repeat(65));
  console.log(`iOS version         | ${beaIOS?.padEnd(12)} | ${palomaIOS?.padEnd(12)} | ${beaIOS === palomaIOS ? "SÍ ✓" : "NO"}`);
  console.log(`Safari version      | ${beaSafari?.padEnd(12)} | ${palomaSafari?.padEnd(12)} | ${beaSafari === palomaSafari ? "SÍ ✓" : "NO"}`);
  console.log(`WebKit version      | ${beaWebKit?.padEnd(12)} | ${palomaWebKit?.padEnd(12)} | ${beaWebKit === palomaWebKit ? "SÍ ✓" : "NO"}`);
  console.log(`Screen              | ${beaScreen?.padEnd(12)} | ${palomaScreen?.padEnd(12)} | ${beaScreen === palomaScreen ? "SÍ ✓" : "NO"}`);
  console.log(`isStandalone        | ${String(beaInt?.device_info?.isStandalone).padEnd(12)} | ${String(palomaInt?.device_info?.isStandalone).padEnd(12)} | ${beaInt?.device_info?.isStandalone === palomaInt?.device_info?.isStandalone ? "SÍ ✓" : "NO"}`);
  console.log(`Language            | ${beaInt?.device_info?.language?.padEnd(12)} | ${palomaInt?.device_info?.language?.padEnd(12)} | ${beaInt?.device_info?.language === palomaInt?.device_info?.language ? "SÍ ✓" : "NO"}`);

})();
