require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = "9d2587b1-c799-476d-9797-b7a498a487b1";

(async () => {
  // Check user_events, analytics_events, user_actions, etc.
  const eventTables = [
    "user_events", "analytics_events", "user_actions", "page_views",
    "user_activity", "event_logs", "user_interactions", "click_events",
    "notification_events", "user_sessions"
  ];

  for (const t of eventTables) {
    const { data, error } = await supabase.from(t).select("id").limit(1);
    if (!error) console.log("TABLE EXISTS:", t, "rows:", data?.length);
  }

  // Check user_sessions for Mar
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T00:00:00")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== USER SESSIONS (23 feb) ===");
  console.log("Total:", sessions?.length || 0);
  if (sessions && sessions.length > 0) {
    console.log("Columns:", Object.keys(sessions[0]).join(", "));
    sessions.forEach(s => {
      const vals = Object.entries(s)
        .filter(([k,v]) => v !== null && k !== "user_id")
        .map(([k,v]) => k + ":" + (typeof v === 'object' ? JSON.stringify(v).substring(0,100) : String(v).substring(0,60)))
        .join(" | ");
      console.log("  ", vals);
    });
  }

  // Check user_events for Mar around dispute time
  const { data: events, error: evErr } = await supabase
    .from("user_events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", "2026-02-23T14:00:00")
    .lte("created_at", "2026-02-23T16:30:00")
    .order("created_at", { ascending: true })
    .limit(50);

  if (evErr) {
    console.log("\nuser_events error:", evErr.message);
  } else {
    console.log("\n=== USER EVENTS (23 feb, 14:00-16:30) ===");
    console.log("Total:", events?.length || 0);
    if (events && events.length > 0) {
      console.log("Columns:", Object.keys(events[0]).join(", "));
      events.forEach(e => {
        const vals = Object.entries(e)
          .filter(([k,v]) => v !== null && k !== "user_id")
          .map(([k,v]) => k + ":" + (typeof v === 'object' ? JSON.stringify(v).substring(0,150) : String(v).substring(0,80)))
          .join(" | ");
        console.log("  ", vals);
      });
    }
  }
})();
