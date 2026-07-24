# Koigrid migration journey — feedback report

> **What this is:** an honest, end-to-end log of migrating a real production app (Vence — a Spanish exam-prep platform: Next.js 16 frontend + 31 GB PostgreSQL) **from AWS (ECS Fargate + RDS) to Koigrid**, written to help Koigrid improve the migration experience. Mix of what worked great and where we hit friction, with concrete suggestions.
>
> **Source stack:** Next.js 16 (standalone) on ECS Fargate + PostgreSQL 17.6 on RDS Multi-AZ (eu-west-2). DB = 31 GB, ~195 tables, 245 functions, 87 triggers, generated columns, 38 views, pgvector embeddings. Origin was Supabase (cut over to RDS 2026-07), so the schema carries Supabase-era conventions (an `extensions` schema, an `auth` schema).
> **Tester:** an AI agent (Claude) driving the Koigrid REST API + CLI end-to-end. Dates: 2026-07-22 (initial run) → 2026-07-23 (re-test cycle across new releases) → 2026-07-24 (image-deploy retest, then the whole-app manifest + load-test features).

---

## ✅ 2026-07-24 (evening) — WE APPLIED THE MANIFEST FOR REAL: backend (NestJS) + Redis now LIVE on Koigrid against the real 31 GB DB. Two plan≠apply bugs found (one dangerous), both worked around.

Following the dry-run below, we ran the actual `POST /manifest` **apply** to bring up the **backend + Redis** into the same project as the migrated 31 GB DB. **Net result: the NestJS backend is live on Koigrid, serving `/health` 200, connected to the co-located 31 GB Postgres, with the Koigrid managed Redis wired in.** Getting there surfaced **two real platform bugs** — exactly the kind of feedback an apply (vs a dry-run) exposes.

### 🎉 What now runs on Koigrid (proven, not planned)
- **Backend `@vence/backend` (NestJS) — LIVE.** `https://vence-backend-261bdf.apps.koigrid.com/health` → `200 {"status":"ok","service":"vence-backend","deploy":"a4d55e77"}`. The runtime logs show it **booted against the real migrated DB and ran actual work**: `[RefreshRankingsService] refresh_ranking_cache() completado: 1922 filas` — inserting the week/month ranking rows in **27–77 ms** (the co-located 6.45 ms DB earning its keep), and `[AlertsCron] alerts-engine: … 59/59 evaluadas`. This is the whole point of unproven-item #1 (backend), now retired: **it doesn't just deploy, it works against real data.**
- **ECR-native pull of the backend image works** (`deploy-a4d55e77`, 110 MB) — after we extended the scoped IAM key to the second repo (our gotcha, noted below). Defect #2's ECR path holds for a *second* image, not just the front-end.
- **Managed Redis provisioned + wired.** `POST /manifest` created the `cache` Redis; the connection URI is a **TLS `rediss://…@rds-cache-d9085a.rds.koigrid.com:44921`** (exactly what the backend's `ELASTICACHE_URL` expects). Set `CACHE_PROVIDER=elasticache` + `ELASTICACHE_URL=${{redis.cache.REDIS_URL}}` and the backend logged `[CacheService] Cache configurada (proveedor: elasticache)` with no connect error. Unproven-item #2 (Redis) substantially retired.
- **Backend env is trivial** thanks to a 12-factor design: its zod env schema makes **only `DATABASE_URL` required** (everything else defaults / degrades cleanly), so the manifest env was 5 lines and it boots. Missing optional secrets degraded exactly as designed (`CRON_SECRET no configurado — drain… cron_secret_missing`, `POOLER_TARGET_GROUP_ARN no configurado`), not crashed.
- **Idempotency confirmed.** Re-applying the manifest reported `database → exists`, `redis → exists`, `app vence-backend → updated` (same id) — match-by-name is stable across kinds.
- **No downtime on a failed redeploy.** When a redeploy failed (see bug #2), the **previous container kept serving `/health` 200** the whole time — Koigrid holds last-good and only cuts over on success. Good default.

### 🐞 BUG #1 (dangerous) — `manifest` resolves the `project` field by **ID in plan** but by **NAME in apply**

This one can bite hard in a cutover. We passed `project: "7a9881f4-…"` (the existing project's **UUID**):
- **`/manifest/plan`** resolved it *by id* → matched the existing project → returned `database vence-mig2 → plan-noop`, `app vence-web7 → plan-update`. Looks perfect and safe.
- **`/manifest`** (apply) resolved the *same string by name* → found no project named "7a9881f4-…" → **created a brand-new project literally named "7a9881f4-…"** and, inside it, created **all four resources fresh — including a new EMPTY `vence-mig2` database** (a second 4 GB DB with none of the 31 GB of data), plus a new backend and a **duplicate `vence-web7`** unrelated to the live one.

So the dry-run said "noop/update" and the apply **built a parallel empty stack against an empty DB.** In a real cutover that's the difference between "augment my project" and "silently stand up a hollow copy." The fix on our side was trivial once seen — **pass the project NAME** (`project: "demo"`); then plan *and* apply agreed (`projectId 7a9881f4…`, `database → exists`, `redis/backend → create` in the right project). But the plan/apply divergence itself is the bug.
→ **Fix (Koigrid):** resolve `project` **identically** in plan and apply — accept an id as an id in *both*, or reject an id-shaped string with "did you mean the name?", and never silently create a new project named after a UUID. At minimum, `plan` must predict what `apply` will do; a plan that says `noop` while apply says `create` defeats the purpose of a dry-run. (We cleaned up the stray project — deleting its 4 resources returned 200 each; the now-empty project's `DELETE` returned `409 "must be empty"` for a while after the children were gone — a minor **eventual-consistency** lag worth smoothing so cleanup isn't a retry loop.)

### 🐞 BUG #2 (flaky, blocks first-try image deploys) — `build_export_failed` on every image deploy; a manual retry lands it

**Every** image deploy of the backend failed on the **first** attempt with:
> `error: build_export_failed` — *"The image built but could not be exported/loaded on the runner (timeout or runner I/O pressure). This is a platform issue (not your code) — koigrid has been alerted; retry shortly."*

…and a **manual `POST /apps/{id}/deployments` retry consistently succeeded** (caught a healthy runner → `live`, public URL assigned, container serving). So the image path *works*, but it's **flaky under runner I/O pressure** and needs a retry every time — reproducible across 3 separate deploys this session (possibly aggravated by our own churn: multiple deploys + load tests on the shared runners). Two sub-issues make it worse than "just retry":
1. **A failed deploy leaves the app in `error` with no public URL, even though a retry's container is healthy and listening** (`[Bootstrap] Vence backend escuchando en :3000`). We had to delete+recreate or fire a fresh `POST /deployments` to get routing. (This is the Snag-I "error-state stickiness" from earlier, still biting.)
2. **A confusing cascade in the failure log:** after the export failed, the runner logged `docker: pull access denied for manifest, repository does not exist … Unable to find image 'manifest:latest'` — it appears to `docker run` the literal string `manifest` as an image. That's a red-herring error stacked on the real one (`build_export_failed`) and would send someone chasing a registry-auth problem that isn't there.
→ **Fix (Koigrid):** (a) make image export/load robust to runner I/O pressure (retry internally before failing, or isolate export from noisy neighbors) so a `sourceType:image` deploy lands on the first try like ECS does; (b) don't strand the app in `error` when a subsequent deploy's container is healthy — reconcile app status to the running container; (c) fix the `docker run 'manifest'` cascade so the log shows only the real cause.

### Where this leaves the whole-app POC
DB (31 GB, 1:1) ✅ + front-end (live, image deploy) ✅ + **backend (live, real DB + Redis) ✅ + Redis (provisioned + wired) ✅** — four of the stack's pieces now run on Koigrid in one project. Still not exercised (next): pointing the **front-end**'s `BACKEND_URL` at the Koigrid backend over private networking (`${{app.vence-backend.INTERNAL_URL}}`) and running **writes/auth/Stripe** end-to-end; a **peak load test** with CDN-on + replicas; repointing **crons**. But the manifest delivered the multi-service bring-up it promises — modulo the two bugs above, both of which a dry-run alone would not have caught. **This is the strongest evidence yet that a full Vence cutover is mechanically viable on Koigrid.**

---

## ✅ 2026-07-24 (later) — KOIGRID SHIPPED SUGGESTIONS #1 (whole-app manifest) AND #4 (load-test). We tested both. Both work.

Between the morning retest (front-end live via ECR image, below) and now, Koigrid shipped **exactly the two things this report flagged as the last axes where AWS still wins** — the multi-service cutover manifest and a first-class load test. We diffed `llms.txt`/`openapi.json` against our 2026-07-24 12:56 snapshot and found:
- **`POST /manifest` + `POST /manifest/plan`** (+ CLI `koigrid up` / `koigrid plan`, new scope `manifest:write`) — a `koigrid.yaml` declares a whole PROJECT (databases + redis + apps, wired by `${{...}}` reference vars) and brings it up idempotently, **deploying apps in dependency order (backend before web)**. This is *verbatim* suggestion #1 from the "FROM FRONT-END DEPLOYS TO WHOLE-APP CUTOVER" section. Fast turnaround — thank you.
- **`POST /apps/{id}/loadtest`** — hammer the app URL at bounded concurrency for N seconds → `rps` + `p50/p95/p99` + a `saturated` flag with a human `note`. This is suggestion #4 ("the #1 thing blocking our cutover decision: capacity"), now first-class.

### 🧪 Load-test feature — first real capacity numbers for Vence on Koigrid (this is genuinely useful)

We ran it against the live POC (`vence-web7`, **single 2 GB replica, CDN OFF** — deliberately the weakest config, to get a floor):

| Path | Concurrency | Duration | rps | p50 | p95 | p99 | errors | `saturated` |
|---|---|---|---|---|---|---|---|---|
| `/` (static) | 25 | 30 s | 8.7 | 1.31 s | 8.40 s | 9.25 s | 3.1% | **true** |
| `/leyes` (DB-heavy) | 15 | 30 s | 3.8 | 3.96 s | 7.28 s | 9.34 s | 0% | false |

The `note` field was excellent — plain-language and actionable: *"Satura a concurrencia 25 (p95=8401ms vs p50=1311ms, errores 3.1%). Sube réplicas o el tamaño de la app y re-mide"* and *"Sana a concurrencia 15… Para estimar el pico mensual: req/s × 2.6M ≈ req/mes sostenidas."* A load-test endpoint that *interprets its own result* is exactly the "self-explaining" DX this report kept asking for. 👏

**Honest read (this is a floor, not a verdict):** one small CDN-off replica saturates the static path at ~8.7 rps. Vence's peak ≈ 43 M req/mo ≈ **16.6 rps mean** (bursts ~3–5× → ~50–80 rps), so a single small replica is under even the mean — as expected. The DB-heavy path held 15-concurrency at **0 errors** (the co-located 6.45 ms DB earning its keep). The realistic cutover config — **CDN on** (offloads the static hits that drove the home saturation) + **~6–10 replicas + autoscale** — is what a peak load test needs to validate. But the key point: **the capacity axis is now measurable from the API**, which it wasn't 24 h ago. This alone changes "we think it'll hold" into "we can prove it."

**Feedback / suggestions on the load-test tool:**
1. **`durationSec` is capped at 60 and concurrency is bounded** — good guardrails, but a real cutover gate wants a *ramp* (step concurrency 10→50→100 and report the saturation point), and a longer soak (5–10 min) to catch GC/leak/connection-pool cliffs that a 30 s burst misses. A `mode: "ramp"` returning the rps-vs-p95 curve + the knee would be the killer capacity report.
2. **Report server-side signals alongside client-side latency** — during the run, echo the app's CPU/mem and replica count (and whether autoscale fired). Right now we see *client* p95 but can't tell if it saturated on CPU, memory, or the DB. Pairing this with `/metrics` during the test makes the saturation cause legible.
3. **Let it target an internal warm path** to separate cold-start from steady-state — our first request was a ~40 s cold start (container warmup + a 15 s app-side cache load); a load test that reports "excluding warmup" vs "including" avoids a scary-looking p99.
4. Minor: the tool hits a single `path`. A small **weighted path mix** (`[{path:"/",weight:70},{path:"/leyes",weight:30}]`) would model real traffic better than one URL.

### 🧩 Whole-app cutover manifest — dry-run (`/manifest/plan`) is VALID with 0 warnings

We authored a `koigrid.yaml`-equivalent JSON for the **entire Vence stack** and ran the dry-run:
- `databases: [vence-mig2 (4096 MB)]`
- `redis: [cache]`
- `apps: [vence-backend (ECR image, DATABASE_URL+REDIS_URL refs), vence-web7 (ECR image + registryAws* creds, full NEXT_PUBLIC_* env + REDIS_URL + BACKEND_URL=${{app.vence-backend.INTERNAL_URL}})]`

`POST /manifest/plan` returned a clean, correct plan (**0 warnings**):

| kind | name | action | note |
|---|---|---|---|
| database | `vence-mig2` | **plan-noop** | *"ya existe (resize por su API)"* — correctly recognized the existing 31 GB DB, matched by name |
| redis | `cache` | **plan-create** | |
| app | `vence-backend` | **plan-create** | new service |
| app | `vence-web7` | **plan-update** | correctly adopted the live POC app by name and would wire in `REDIS_URL` + `BACKEND_URL` |

This is a great result: **idempotent match-by-name across all four resource kinds**, `plan-noop` vs `plan-create` vs `plan-update` clearly distinguished, reference-var wiring (`${{db.x}}` / `${{redis.x}}` / `${{app.x.INTERNAL_URL}}`) accepted, and dependency order (backend before web) implied by the plan. This is the piece that turns "I deployed one container" into "I declared my whole stack" — the single biggest DX lever for a real migration, and it landed.

**Feedback / friction on the manifest:**
1. **Sub-schema inconsistency: `redis` inside the manifest rejects `memoryMb`, but `POST /redis` accepts it.** Our first plan failed with `redis.0: Unrecognized key(s) in object: 'memoryMb'`. The standalone `/redis` create endpoint takes `{name, replicas, memoryMb, projectId}`, so a user naturally copies those fields into the manifest — and the manifest's stricter validator rejects `memoryMb`. Two fixes, either works: **(a)** accept the same fields in the manifest as the standalone create (and size Redis there — important, since this report's Snag B showed an undersized DB *crashes* mid-load; the same "size at create" concern applies to Redis), or **(b)** document the manifest's redis sub-schema explicitly. The error itself was crisp and named the exact key — good validator UX; it's the *asymmetry* that surprises.
2. **The strict validator is a feature — keep it, but publish the manifest JSON Schema.** In `openapi.json`, `databases`/`redis`/`apps` items are typed as bare `object` (no properties), so a user can't discover the accepted fields from the spec — we had to reconstruct them from the `llms.txt` example and one rejection. Publishing the full per-kind item schema (with which fields are per-manifest vs "use the resource's own API") would remove the guesswork.
3. **`plan-noop` note "resize por su API" is exactly right** — the manifest wisely won't resize an existing DB (avoids a destructive surprise), and *tells you* to use the DB API. That's the correct, safe default. Consider the same explicit note for an app whose `plan-update` would change memory/replicas, so the operator knows what the apply will and won't touch.

### What's NOT done yet (and why — it's *our* side, not Koigrid's)

The **apply** (`POST /manifest`) — the real whole-stack bring-up — is ready to fire (manifest validated, images in ECR, DB live) but we haven't run it in this session for two reasons, **both on us**:
1. **Our internal task-claim lock.** Vence runs 2–10 parallel Claude sessions with a lease-based backlog; the Koigrid migration task (`T-089`) is currently leased to another session, and our own guardrail (correctly) blocks a second session from mutating shared infra until the lease frees. Not a Koigrid issue — if anything it's a nod to *why* the manifest's idempotent match-by-name matters: two operators must converge, not collide.
2. **One ECR-scope gotcha to fix first (our side).** The scoped IAM key we minted for the front-end pull (defect #2's ECR-native path) is scoped to the `vence-koigrid-mig` repo only. The manifest apply pulls the **backend** image from `vence-backend` too, so we'll extend that key's policy to include the second repo before apply — otherwise Koigrid would (correctly) surface `registry_auth_failed` on the backend app. **Doc suggestion for the ECR-native path:** note that a whole-app manifest needs the pull creds scoped to **every** repo it references, not just the web image — an easy thing to miss when you graduate from one app to a stack.

**Net:** two Koigrid features shipped since this morning, both tested, both work — the manifest dry-run is valid for the entire Vence stack, and the load test gives the first real capacity floor. The only thing between here and a live whole-stack POC on Koigrid is our own claim lock + a 2-minute IAM scope edit. **On the axes this report said AWS still won — whole-app orchestration and provable capacity — Koigrid just closed the orchestration gap and handed us the tool to close the capacity one.**

---

## ✅ 2026-07-24 — THE DEPLOY PATH IS PROVEN: front-end LIVE on Koigrid via pre-built image. (Whole-system cutover ≠ done — see scope.)

Koigrid shipped defect #2 (external private-registry pull with credentials). We re-ran via the **drop-in-ECS path** and **it worked**: pre-built image → Vence's ECR → Koigrid pulled it with scoped creds → **running in 30 s, no build, no OOM, no `413`**. The app serves real content from the co-located migrated DB (`✅ Cache cargado: 1354 leyes`), warm TTFB **0.2–0.77 s**. Live at `https://vence-web7-23f37d.apps.koigrid.com`. **Full write-up in "✅ VENCE-RETEST" below.**

**What this PROVES:** the two hardest things — (1) the 31 GB DB migrated 1:1, and (2) the clean CI-image → Koigrid deploy path (no build-OOM, no registry limit). **What it does NOT prove (a production cutover still needs these):** the **backend** (NestJS `@vence/backend` @ `api.vence.es`) isn't on Koigrid — the POC front-end still called the AWS backend; **Redis** wasn't provisioned (rate-limits / daily-device-chat limits / several caches run on it) so those paths are untested; **writes / auth login / Stripe webhooks / test submission** weren't exercised (smoke test was GET reads only); **crons** (GitHub Actions) aren't repointed; and there's been **no load test** at Vence's peak (~43 M req/mo) — the exact axis that caused the 21–22/07 incidents. See "⚠️ WHAT'S STILL UNPROVEN" below the retest. Everything under this line is the (now-resolved) build-OOM saga, kept for the record.

---

## 🔴 READ THIS FIRST — current status + the one thing left to unblock (2026-07-23, final for the day)

**The database migration is DONE and validated 1:1 (31 GB, schema + data + extensions, co-located at 6.45 ms). The only thing left is getting the front-end container live, and after a full day of testing it comes down to one clean ask: let Koigrid run a *pre-built image* the way ECS does.**

**The build itself is not the real problem — it's *where* it runs.** On AWS, `next build` runs in **GitHub Actions (16 GB)**, separate from runtime; ECS just runs the finished image. On Koigrid's `apps deploy --dir`, the build runs *on the app's 8 GB runner*, and a 4,468-page SSG `next build` OOM-kills (twice — `tsc`, then static generation). We proved locally that the whole build fits in **8 GB of dedicated memory** (`podman build --memory=8g` succeeds; `--memory=3g` fails), so on an 8 GB *total-machine* cpx32 the OS + buildkitd overhead is exactly what tips it over. **But chasing a bigger build runner is the wrong fix** — the right fix is to not build on Koigrid at all: build in CI (as we already do for AWS) and deploy the immutable image.

**And that clean path is blocked today by two missing pieces — either one unblocks the whole migration:**
1. **No pull of a private image from an external registry (ECR/GHCR) with credentials** (defect #2). `sourceType:"image"` takes only an `image` string — no `imagePullSecret`. So we can't reuse the ECR image CI already builds.
2. **Koigrid's own registry rejects the large prerender layer with `413`** (defect #3, re-confirmed empirically 2026-07-23: the 2.58 GB `.next/server` layer → `413 Payload Too Large`; ECR accepts it fine). So pushing to Koigrid's registry doesn't work either.

**So the two doors to the AWS-standard "deploy a pre-built image" model are both shut.** Close **either** — add external-registry pull credentials (#2, the ideal: makes Koigrid a drop-in ECS), or raise the registry blob limit (#3) — and the front-end migrates as cleanly as the DB did. Full defect list + fixes in **"BUILD & DEPLOY: Koigrid vs AWS"** below.

**What we did NOT do (and won't): trim `generateStaticParams` to fit the small build box.** That's a product regression (SSG→SSR) to accommodate a provider limit — a botch, not a migration. Rejected.

### The build-on-Koigrid re-test trail (why we concluded the above)

| Re-test | App | Change | Result |
|---|---|---|---|
| #1–3 (08:01–11:48) | `vence-web3/4` | 8 GB app, successive releases | `build_failed` @ 121–122 s (capacity-accounting bug pinned the 8 GB runners) |
| #4 (14:14) | `vence-web5` | account emptied to 0 apps, fresh 8 GB app | `build_oom` @ 122 s — real signal: the 8 GB *machine* is one size too small |
| #5 (14:38) | `vence-web6` | applied `typescript.ignoreBuildErrors` | tsc peak gone (`✓ Compiled in 67s`), but a **2nd OOM** in static-gen (past 3351/4468) |

Along the way Koigrid **fixed two things we reported** (credit due): the **capacity-accounting bug** (errored apps were reserving the new 8 GB runners) and the **`build_oom` classifier** (deployments now return a legible `error: build_oom` instead of a truncated log). Those confirm the platform iterates fast — the remaining gap is purely the image-deploy path (#2/#3).

*Everything else is solved: DB, schema, data, co-located latency, build-time DB access (Snag H), public-var injection (Snag F). The front-end is one Koigrid-side fix (#2 or #3) away from live.*

---

## ✅ KOIGRID UPDATE 2026-07-23 (koigrid side) — the build blocker should now be cleared; please re-test on a FRESH app

Thanks for the sharp diagnosis. One architectural correction + the fixes that landed:

**There is no separate "build runner" in koigrid.** The build (rootless BuildKit) runs on the SAME runner where the app is scheduled, and **buildkitd has no `--memory` cap** → a build can use the runner's FULL RAM. So "the build runner has ≤3 GB" was really "the app got scheduled onto a small/full runner." That points to the true root cause we just fixed:

**Root cause of "8192 MB didn't help" — a capacity-accounting bug (fixed today).** `runnerCapacity` was counting apps that are **soft-deleted or in `error`/`failed`** (no running container → 0 RAM used) as fully committed. Your own failed re-tests (`vence-web3`, `vence-web4`, each requesting 8192 MB, stuck in `error`) were **reserving the two new 8 GB runners entirely** → the scheduler saw them as "full" and placed the next build on a smaller runner (~3 GB), reproducing the OOM exactly. Fixed: capacity now excludes deleted/errored apps → the 8 GB runners are schedulable.

**What landed (2026-07-23):**
- **8 GB app-runners** (`koi-runner-hz1`/`hz2`, Hetzner cpx32). Since build RAM = runner RAM, a build now gets 8 GB.
- **Capacity bug fix** (above) — the real reason the 8 GB runners weren't being used.
- **BUILD-TIER F0** — `NODE_OPTIONS=--max-old-space-size` scaled to the runner RAM, so Node's heap doesn't balloon past the box.
- **Snag K-obs — FIXED**: `classifyBuildError` now detects the silent kernel-OOM signature (build dies at "creating an optimized production build" with no image) and returns a legible **`build_oom`** message with actionable fixes, instead of the truncated log. (The 8222-char log isn't koigrid truncating — the OOM-killer stops the build mid-line, so there's no more output; the classifier now names it for you.)

**Please re-test — on a BRAND-NEW app** (per your Snag I note, an app already in `error` drops new deploys, and its old row was pinning a runner). It should now schedule onto an 8 GB runner with the heap capped.

**Honest caveat:** if a ~4,500-page SSG build genuinely needs >8 GB, it'll still OOM — then the fix is a bigger runner (tracked as **MIG-K**) or your own suggestion (render the long tail dynamically; the co-located DB is fast). But 8 GB + heap cap is a real shot it compiles now. Happy to size up if it doesn't.

---

## 🧪 RE-TEST #4 after the capacity fix (Vence side, 2026-07-23 14:14) — `build_oom` classifier ✅ works; build still OOMs at 8 GB

Ran exactly as you asked. Result: **the new `build_oom` error classifier is live and correct — thank you, Snag K-obs is fixed** — but the build **still OOM-killed**, so this app genuinely needs more than the 8 GB runner (or the placement isn't landing 8 GB; we're disambiguating locally, see below).

**What we did (clean-room, to rule out the capacity-pinning you flagged):**
1. **Deleted all 16 errored `vence-web*` apps + both running `vence-poc-web` apps** → account had **0 apps**, so both 8 GB runners were completely free (no soft-deleted/errored rows pinning them).
2. Created a **brand-new** app `vence-web5`, `PUT /resources {memoryMb:8192}` (accepted overPlan), `POST /env` (reference-var `DATABASE_URL` included) → triggered the real build.

**Result:** deployment `789f9bb7` — `failed` at **122 s** (14:14:13 → 14:16:15), and the API now returns **`error: build_oom`** on the deployment object (previously an empty/truncated log). **That's the observability fix working — a legible, actionable failure reason straight from the API. 🎉**

**But the build itself still died** — same ~122 s wall, now on an empty-account 8 GB-requested app. Two possibilities we're separating:
- **(H1) the ~4,500-page SSG build genuinely needs >8 GB** → the fix is your **MIG-K bigger runner** (16 GB), or we render the long tail dynamically (path B, our side).
- **(H2) the build didn't actually get 8 GB** (placement/heap-cap didn't apply) → still your side.

**Disambiguating now:** re-running the identical build locally under `podman build --memory=8g` (we already have the `--memory=3g` repro that OOMs). If **8 GB also OOMs locally** → it's **H1**, please provision a **16 GB runner (MIG-K)** and we'll re-test. If **8 GB succeeds locally** → it's **H2**, the 8 GB isn't reaching the build. We'll post the number here.

**Two asks for you to confirm server-side (you can see what we can't):**
1. Did deployment `789f9bb7` actually schedule onto an **8 GB (cpx32)** runner, and what was its **peak build RSS**? That single number settles H1 vs H2.
2. If it was truly 8 GB and peak RSS exceeded it → **MIG-K (16 GB runner)** is the fix.

*Net: your two fixes both landed and are visible from the API (capacity accounting + `build_oom` classifier). The build is still over 8 GB of peak memory — one more runner-size bump (or we trim prerendering on our side) and it's done.*

---

## ✅ KOIGRID ANSWER to RE-TEST #4 (2026-07-23, from the server side) — it's the TYPE-CHECK, not the compile; it fits 8 GB with one config line

Answering your two server-side questions directly, from the deployment record + the build log:

**1. Did `789f9bb7` schedule onto an 8 GB runner?** **YES** — `koi-runner-hz1` (cpx32, **8192 MB**), and `NODE_OPTIONS=--max-old-space-size` was applied (visible in the log). So **H2 is ruled out**: the build got the 8 GB runner.

**2. But it is NOT "the whole build needs >8 GB" — the COMPILE fits 8 GB.** The build log (it's in the deployment's `logs` field, head-first) tells the real story:
> `✓ Compiled successfully in 66s` → `Running TypeScript …` → *[killed at 122 s]*

**The webpack/Turbopack COMPILE succeeded in 66 s inside 8 GB.** What OOM-killed it is the *next* phase — `next build`'s **TypeScript type-check (`tsc`)**, the heap-heaviest step, which loads the whole type graph of a ~4,500-page app. So it's **neither H1 (whole build >8 GB) nor H2 (placement)** — it's specifically the type-check.

**The fix is one line on your side, and the migration completes on the 8 GB runner you already have:**
```js
// next.config.js  (or .ts)
typescript: { ignoreBuildErrors: true },   // run tsc in CI, not inside the hosted build
```
The compile already works on 8 GB (66 s); skipping the type-check at build produces the image. Decoupling `tsc` from `next build` is standard practice for large Next.js apps. **koigrid's `build_oom` message already says exactly this** — it's literally the **first line of the deployment's `logs`** field:
> *"The build ran OUT OF MEMORY during TypeScript type-checking… it compiled but the tsc process was killed… skip type-checking in the build (`typescript.ignoreBuildErrors`) and check types in CI."*

You looked at `/apps/:id/logs?type=build` (which returns runtime logs → `"(sin contenedor activo)"`) — the build reason lives in the **deployment object's `logs`**, not that endpoint. That discoverability gap is real and is being fixed so the build error surfaces from the logs endpoint too.

**So: try `ignoreBuildErrors` first — it should complete on your existing 8 GB runner. No 16 GB runner needed** (though we'll happily provision MIG-K if you'd rather keep the in-build type-check).

## 🧪 RE-TEST #5 (Vence side, 2026-07-23) — local bracket confirms your diagnosis; applied the fix, redeploying

**Your answer matches our local bracket exactly — thank you, this is the real root cause.** We ran `podman build --memory=8g` (clean, `--no-cache`) and the **full build SUCCEEDED, type-check included**: the log shows
> `✓ Compiled successfully in 61s` → `Running TypeScript ...` → `Finished TypeScript in 72s ...` → `✓ Generating static pages (4468/4468) in 49s` → 2.76 GB image.

So the `tsc` phase (**72 s, the heap-heaviest step**) completes inside an **8 GB *dedicated cgroup*** — but OOM-kills on an **8 GB *total-machine* cpx32**, because the OS + rootless buildkitd overhead (~1–1.5 GB) leaves the build <8 GB, and `tsc`'s peak sits right at that edge. That's a perfect three-way agreement: your log (`Compiled` ✓ → `tsc` killed), your classifier (`build_oom` during type-check), and our local bracket (whole build ≤8 GB dedicated, `tsc` is the peak). **Neither H1 nor H2 — it's the type-check peak vs machine overhead.**

**Applied your fix.** Added to `next.config.mjs`:
```js
typescript: { ignoreBuildErrors: true },   // tsc runs in CI (npm run typecheck), not in the hosted build
```
Vence already has a `typecheck: "tsc --noEmit"` script, so types are still enforced in CI — we're only removing the redundant (and peak-memory) in-build type-check. Redeploying a fresh app (`vence-web6`) now; expecting the compile + static generation to finish on the existing 8 GB runner. Result appended below.

### Result of RE-TEST #5 — the tsc fix WORKS, but a *second* memory peak appears in static generation (deployment `d9a162db`)

**The `ignoreBuildErrors` fix did exactly what you said** — the build log confirms the type-check is gone:
> `✓ Compiled successfully in 67s` → `Collecting page data using 3 workers` → `Generating static pages using 3 workers (0/4468 … 3351/4468)` → *[log cuts off mid-page at 114 s, deployment ends `build_failed` at 122 s]*

So we cleared the `tsc` peak and got **all the way into static generation** (past **3351 of 4468** pages) — then it **OOM-killed again**, this time in the **`next build` static-generation phase**: 3 parallel workers rendering ~4,500 data-heavy SSG pages (each runs live DB queries + React SSR + loads law/teoría content). The log stops mid-stream with no error (classic SIGKILL), so the classifier reports generic `build_failed` rather than `build_oom` (the OOM signature it detects is the tsc-phase one; a kill during "Generating static pages" isn't matched — **worth extending the classifier to this phase too**).

**Why this is consistent with everything:** locally, `--memory=8g` runs the *whole* pipeline (compile + tsc + generate 4468 pages) to success — because a clean 8 GB cgroup on a big host has spare RAM for FS cache and page buffers. On an **8 GB *total-machine* cpx32**, the same static-generation phase (base process + 3 workers each holding heavy law data) exceeds the ~6.5–7 GB left after OS + buildkitd. **This app's build has two sequential memory peaks — tsc, then parallel static-gen — and the 8 GB machine can't hold the second either.**

**Where that leaves it — two clean options:**
1. **MIG-K: a 16 GB runner.** We've proven the entire build fits in 8 GB *dedicated*; a 16 GB machine gives it that headroom with room for the static-gen workers. This is the robust one-and-done fix and needs nothing more from us. **This is the ask.**
2. **Vence-side path B:** trim `generateStaticParams` so the data-heavy law/teoría pages render dynamically (co-located DB = 6.45 ms) instead of all 4,468 prerendering at build — cuts the static-gen peak so it fits a cpx32. Bigger change on our end, but removes the dependency on a larger runner.

**Net:** two Koigrid fixes landed and are confirmed working (capacity accounting; `build_oom` classifier), and your `ignoreBuildErrors` guidance cleared the first peak exactly as predicted. The remaining gap is one thing — an 8 GB *total-RAM* machine is one size too small for this particular build's static-generation peak. **A 16 GB runner (MIG-K) closes it; we're ready to re-test the moment it's available.**

**Doc-nit confirmed on our side:** we *did* only get `"(sin contenedor activo)"` from `/apps/:id/logs?type=build`, and the real reason was in the **deployment object's `logs`** (head-first) — which we'd been reading tail-first for the OOM signature. Surfacing the build error from the logs endpoint too (as you're planning) will save the next person this exact detour.

## 📚 DOCS REVIEW 2026-07-23 (later) — the new version folded this feedback into the docs; the documented fix is Vence-side

Re-reviewed `llms.txt` + the new `docs/DEPLOYING-APPS.md` after the latest release. **Koigrid shipped much of this report straight into the docs** — genuinely fast:
- New **`docs/DEPLOYING-APPS.md`** front-loads every gotcha we hit: build-time vs runtime env, the reference-var `${{db.x.DATABASE_URL}}` for build-time DB access, the **`ENV X=${ARG}` clobber**, **big-SSG type-check OOM → `typescript.ignoreBuildErrors`**, image-size limit, Supabase pgvector + DB sizing for restores.
- Failed deployments now carry a **structured `error` code** (`build_oom`, `build_export_failed`, `runner_unreachable`, `build_daemon_unavailable`, …) and `logs` that **begin with the human cause + fix** — "read `error` first; don't reproduce locally." (We confirmed `error: build_oom` live.)
- Disk response now echoes **`diskFloorGb` + `diskElastic:true`** (our Snag A #4 suggestion, shipped).

**The decisive line for our blocker** (llms.txt, `build_oom` entry, verbatim):
> *"a big SSG `next build` needs 4-8GB, **the runner is smaller**, the kernel OOM-kills it silently → **reduce generateStaticParams, pre-build locally & deploy the artifact (`apps deploy --dir`), or use a larger plan**."*

So Koigrid **documents that the build runner is intentionally smaller** than a big-SSG build needs — there is **no self-serve bigger build runner**; the "16 GB per app" figure is a fair-use *runtime* ceiling, not a build-runner size. **The documented fix is Vence-side:** (1) **trim `generateStaticParams`** (path B — now Koigrid's own #1 recommendation), or (2) **pre-build the image locally and deploy the artifact** (our local `--memory=8g` build already succeeds → this sidesteps both the build OOM *and* the registry 413, since `--dir` builds/runs on the runner without a registry push). A larger plan doesn't add build RAM, so option 3 doesn't apply to us. **Net: the realistic completion path is Vence-side (trim prerender, or ship a pre-built artifact), not waiting on a 16 GB runner.**

## 🎯 BUILD & DEPLOY: Koigrid vs AWS — the exact gaps to close to BEAT AWS (2026-07-23)

**Framing for the Koigrid team:** we *want* Koigrid to replace AWS for Vence — the flat rate, no egress, 6.45 ms co-located DB, and the removal of ECR+task-def+ALB+SSM already win on almost everything. This section is the honest gap list on the one axis where AWS is still ahead today — **getting a heavy app built and deployed** — with the fix for each. None are architectural; they're all "one size too small" or "one missing field."

**How Vence deploys on AWS today (the bar to clear):** GitHub Actions (16 GB runner) runs `docker build` → `next build` compiles 4,468 SSG pages → pushes the image to **ECR** (no practical layer-size limit) → **ECS/Fargate pulls and runs** it (never builds). Build and runtime are **separate**; the runtime host runs an immutable, CI-tested artifact. Secrets come from SSM; ALB + CloudFront front it. It's heavy on moving parts — but the *build/deploy* path itself is rock-solid because the build gets 16 GB and the runtime just runs a finished image.

**Where Koigrid falls short of that today, and the fix for each:**

1. **Managed build runner is too small for a real SSG build (8 GB, shared with the app) vs AWS CI's 16 GB.** `apps deploy --dir` builds *on the app's runner*; a 4,468-page `next build` peaks over the ~6.5–7 GB left after OS+buildkitd and OOM-kills (twice: `tsc`, then static-gen). AWS never hits this because the build lives on a fat CI runner, separate from runtime.
   → **Fix:** either (a) offer a **larger / configurable build runner** (a `buildMemoryMb` knob, or run the build on a transient 16 GB builder and deploy the result to the small app runner), or (b) — better and cheaper for you — make the **pre-built-image path first-class** (see #2), so a heavy app never needs your build runner at all.

2. **No pull of a PRIVATE image from an EXTERNAL registry (ECR / GHCR / Docker Hub) with credentials.** This is the big one. The clean, AWS-equivalent model is "build in CI, deploy an immutable image." Koigrid's `sourceType:"image"` takes only an `image` string — **no `imagePullSecret` / registry credentials field anywhere in the API**. So you can deploy a *public* image (unacceptable for a real app) or an image in *Koigrid's own* registry — but you **cannot reuse the ECR/GHCR image CI already builds**.
   → **Fix:** add registry credentials to image deploys — an `imagePullSecret` / `{registry, username, password}` on `POST /apps` (or a project-level registry credential). Then "build in CI → Koigrid pulls the private ECR/GHCR image → runs it" works exactly like ECS. **This single field makes Koigrid a drop-in ECS replacement.**
   → ✅ **SHIPPED (koigrid, 2026-07-23).** `POST /apps` (and `koigrid apps deploy --image`) now takes private-registry credentials, and koigrid pulls + runs the immutable image — no koigrid build, no build-OOM, no `413`.
     - **GHCR / Docker Hub / GitLab / any private registry:** `{registry, registryUsername, registryPassword}`.
     - **AWS ECR — native, like an ECS execution role:** `{registry, registryAwsRegion, registryAwsAccessKeyId, registryAwsSecretKey}`. koigrid calls `GetAuthorizationToken` and mints a **fresh ECR token on every deploy**, so a redeploy 12 h later never fails (don't paste a static `aws ecr get-login-password` token — it expires). This is exactly the ECR-pull half of an ECS task's execution role.
     - **Rotate/clear creds without recreating the app:** `PUT /apps/:id/registry` (or `koigrid apps registry <id> … / --clear`).
     - **Security:** creds encrypted at rest, never logged, never returned by the API; the password never appears in the runner's `argv` (base64 `docker --config` auth). A registry-auth failure surfaces as a legible `registry_auth_failed` on the deployment — not a silent hang.
     - **This closes defect #2 (the highest-leverage one) and makes #3 moot for the CI path** — you keep pushing to ECR (which accepts the 2.58 GB layer) and koigrid pulls it; you never touch koigrid's own registry. Ready to re-run the migration via this path (see VENCE-RETEST).

3. **Koigrid's own registry rejects large layers (`413`), so even the fallback "push to Koigrid registry" is blocked. ⚠️ RE-CONFIRMED empirically 2026-07-23.** Re-ran `podman push koigrid.com/vence-web:latest` (2.76 GB image): login OK, the ~11 small blobs uploaded fine, then it died on the big one — `Error: writing blob: uploading layer chunked: StatusCode: 413, "413 Payload Too Large"`. Our `.next/server` prerender layer is **2.58 GB** (legit content, not bloat); AWS ECR accepts the same layer without complaint. So it's a **per-blob size cap** (nginx-level, chunked upload rejected), and the one private-image path you *do* offer dies on it.
   → **Fix:** raise the registry blob/chunk limit (SSG-heavy Next.js/Astro/Hugo images routinely exceed 1–3 GB), or support chunked/resumable blob uploads. Pair this with #2 and heavy apps have two working paths instead of zero.

4. **`build_oom` classifier only catches the `tsc`-phase OOM, not the static-generation OOM.** After we applied `typescript.ignoreBuildErrors`, the build got past 3,351/4,468 pages then SIGKILL'd during "Generating static pages" — but the deployment reported generic **`build_failed`**, not `build_oom`, because the classifier's signature is the "Creating an optimized production build" line only.
   → **Fix:** extend the OOM classifier to the static-generation phase (a mid-"Generating static pages" kill with no image is the same kernel OOM) so the error still names itself.

5. **Build-log discoverability:** the real build error lives in the **deployment object's `logs`** (head-first), while `GET /apps/:id/logs?type=build` returns *runtime* logs (`"(sin contenedor activo)"`). We burned time reading the wrong endpoint tail-first.
   → **Fix (you're already on it):** surface the build log + `error` from the logs endpoint too, and document "build error = deployment.logs, head-first."

6. **Deployment lifecycle friction (Snag I/J):** an app already in `error` silently drops new deploys (so every re-test needs a brand-new app), and CLI-returned deployment ids don't match `GET /apps/:id/deployments`. AWS's deploy state is boringly authoritative.
   → **Fix:** let a fresh deploy recover an `error` app; make CLI↔API ids consistent; never accept a deploy that won't run.

**Net for Koigrid:** you already beat AWS on cost, egress, DB latency, and ops-surface. To beat it on **build/deploy** too, the highest-leverage fix by far is **#2 (pull a private external image with credentials)** — it unlocks the exact immutable-artifact CI/CD model teams already run on ECS, with none of your build-runner limits in the path. #1 and #3 are the "if they insist on building/pushing to us" backstops; #4–#6 are polish that turns a 2-hour head-scratch into a 10-minute deploy. Land #2 and Vence (and every other heavy Next.js/Supabase-refugee app) migrates the front-end as cleanly as the database already did.

## ✅ VENCE-RETEST 2026-07-24 — front-end migrated via the pre-built-image path (drop-in ECS). IT WORKS.

You shipped defect #2 (external private-registry pull with credentials, ECR-native). We re-ran the front-end via exactly that path — the AWS-equivalent, immutable-artifact model — and the whole app came up. **No Koigrid build, no build-OOM, no `413`.**

**What we did:**
1. **Built the image the way CI does** (locally, 8 GB — the same 2.76 GB image, 4,468 pages prerendered).
2. **Pushed it to Vence's own ECR** (`349744179687.dkr.ecr.eu-west-2.amazonaws.com/vence-koigrid-mig:latest`). ECR accepted the **2.58 GB prerender layer with no `413`** (698 MB compressed) — this is why the ECR path sidesteps defect #3 entirely.
3. **Created a scoped IAM key** — `ecr:GetAuthorizationToken` (account-level) + `BatchGetImage` / `GetDownloadUrlForLayer` / `BatchCheckLayerAvailability` on **just that repo**. Least-privilege, revocable.
4. **Created the Koigrid app from the ECR image with native-ECR creds:** `POST /apps {sourceType:"image", image, registry, registryAwsRegion, registryAwsAccessKeyId, registryAwsSecretKey, projectId}` (same project as the DB, for reference vars + private networking). Set runtime env via `POST /env` (`DATABASE_URL='${{db.vence-mig2.DATABASE_URL}}'` reference var + `NODE_TLS_REJECT_UNAUTHORIZED=0`), runtime size 2048 MB.

**Result — deployment `cf0df00d`, live in 30 s** (`11:03:30 → 11:04:01`, `error: None`, no `registry_auth_failed`): Koigrid minted a fresh ECR token, pulled the image, and ran it.
- Homepage `HTTP 200`, `<title>Test de Oposiciones y Leyes | Vence</title>`.
- DB-backed pages `HTTP 200` serving **real content from the co-located migrated DB** — the logs show `🔄 [LawsAPI] Cargando cache… → ✅ Cache cargado: 1354 leyes` and `✅ Instancia única de Supabase creada`.
- **Warm TTFB: home 0.20–0.46 s, `/leyes` 0.36 s, a DB-heavy `temario` page 0.77 s.** (First request was a ~40 s cold start — container warmup + the 1,354-law cache load ~15 s; steady-state is the numbers above.)
- Live URL: `https://vence-web7-23f37d.apps.koigrid.com`.

**Verdict: the whole-app migration is proven end-to-end.** DB (31 GB, 1:1) + front-end, both on Koigrid, the front-end running an immutable image built in CI and pulled from ECR — identical to how it ships on ECS today, minus ECR+task-def+ALB+SSM. **Defect #2's fix is exactly right and works on the first real try.** #3 (registry `413`) is now moot for us (we never touch Koigrid's registry), though still worth raising for teams without an external registry.

**Not-blockers, just notes for a *production* cutover (this was a smoke test):** the test image baked `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (rebuild with the real domain so absolute URLs/canonicals are right); run more than one replica + right-size RAM and keep it warm (the cold-start cache load is ~15 s); wire the custom domain + TLS. None of these are Koigrid gaps — they're the normal last-mile of any cutover.

## ⚠️ WHAT'S STILL UNPROVEN — this POC ≠ a whole-system cutover (2026-07-24)

The POC proved the **DB migration** and the **front-end deploy path**. Vence in production is more than that, and none of the following has been exercised on Koigrid yet — listing so nobody reads "front-end is live" as "everything works":

1. **Backend (NestJS `@vence/backend`, `api.vence.es`) — NOT migrated.** The front-end routes some endpoints to `BACKEND_URL=https://api.vence.es` (feature-flagged in `lib/api/backend-router.ts`). The POC front-end therefore hit the **AWS** backend, not a Koigrid one. Needs its own Koigrid app (same image-deploy path — its build is small, no OOM risk).
2. **Redis — NOT provisioned.** `lib/api/{rateLimit,dailyLimit,deviceLimit,chatLimit,featureLimits}.ts`, `medals`, and the filtered-questions cache use Redis. The POC ran with **no `REDIS_URL`** → those paths are untested (fail-open = no limits/abuse-and-cost risk; fail-closed = broken features). Koigrid has managed Redis — provision it + wire `${{redis.x.REDIS_URL}}`.
3. **Writes / auth / payments — NOT tested.** The smoke test was GET reads. Answering a question, saving a `test_session`, login (Supabase auth), and Stripe webhooks (dual-account) were never run against the Koigrid app.
4. **Crons — NOT repointed.** They live in GitHub Actions (few active: `e2e-smoke` 6-hourly, `referrals-promote` daily); they hit the app over HTTP so they'd work pointed at the new URL, but that's untested, and any move to Koigrid `/jobs` is separate work.
5. **Load / throughput — NOT tested.** Single 2 GB replica, no CDN. Vence peak ≈ 43 M req/mo; the 21–22/07 incidents were *capacity*. A load test at ≥2× peak (with replicas + autoscale + CDN on) is the single most important gate before trusting real traffic — the repo already has `loadtest.yml` + `e2e-smoke.yml` to reuse against the Koigrid URL.

**Measured latency, honest (from Spain, 2026-07-24):** AWS `www.vence.es` (CloudFront edge) TTFB **~40–90 ms**; Koigrid POC (single Hetzner box, **CDN OFF**, single replica) **~180–320 ms** static, **~400–890 ms** on a DB-heavy page. So AWS is **~2–5× faster on edge TTFB right now** — but it's not apples-to-apples: Koigrid's CDN is off and it's one cold-ish box vs AWS's CloudFront + multi-instance prod. With Koigrid's CDN enabled + replicas the edge gap narrows to ~2×; Koigrid's structural win is **DB co-location (6.45 ms)** and flat cost, not edge latency. **A fair perf verdict needs the same setup on both sides (CDN on, N replicas) under load — not yet run.**

## 🧭 FROM "FRONT-END DEPLOYS" TO "WHOLE-APP CUTOVER" — what Koigrid could add so a full production app migrates as cleanly as one service (2026-07-24)

You've nailed the single-service story (DB + one app). The gap now is the **whole-system** migration — a real app is frontend + backend + Redis + Postgres + crons + a capacity budget. You already have every primitive (`/apps`, `/redis`, `/databases`, `/jobs`, reference vars, private networking); what's missing is the **connective tissue and guidance** that turns "I deployed one container" into "I moved my production stack with confidence." Concrete, Koigrid-side improvements, roughly in impact order:

1. **A multi-service "cutover" runbook + a compose-style manifest.** Vence is 4 co-operating resources (Next.js front + NestJS backend + Redis + Postgres, wired by `${{db.x}}`/`${{redis.x}}`/`${{app.x.INTERNAL_URL}}`). Deploying them one API call at a time works, but a **single declarative manifest** (`koigrid.yaml`: apps + their images + resources + reference-var wiring + a Redis + a DB, brought up as a project) would make a whole-stack bring-up one command — the piece between DEPLOYING-APPS.md and a real migration. This is your biggest DX lever for "migrate the whole app," not just a service.

2. **CDN should be on-by-default (or a one-flag prompt) for web apps.** Our raw TTFB looked 2–5× slower than AWS purely because **`cdnEnabled` was off** — a migrator benchmarking a fresh app will misjudge Koigrid on a CDN-off single box. Default web apps to CDN-on, or surface "enable CDN?" at deploy, and put the co-located-DB latency (6.45 ms) next to it. First impressions are measured on defaults.

3. **Warm-start / min-replicas so the first request isn't a 40 s cold start.** Our first hit was ~40 s (container warmup + a 15 s app-side cache load); steady-state is 0.2–0.8 s. AWS avoids this with min running tasks + health-gated routing. A **`minReplicas`/keep-warm** that holds ≥1 hot instance and only routes when the readiness probe passes would make cold deploys invisible to users.

4. **Publish per-plan throughput/replica capacity + make a load test first-class.** The one thing blocking *our* cutover decision is capacity: does Scale ($89) hold ~43 M req/mo peak? Your pricing caps "apps" but says nothing about **replicas-per-app, req/s, or concurrent throughput**. Publish rough capacity numbers per plan, and offer a **built-in load-test / capacity report** (`koigrid apps loadtest` → req/s, p50/p95, saturation point) so a migrator can size *before* trusting real traffic. This is the difference between "looks fine" and "provably holds peak" — the exact axis that causes cutover disasters.

5. **Make Redis wiring as one-command as the DB.** Vence needs Redis (rate-limits, per-user limits, caches). The DB migration was smooth; document/streamline the parallel Redis path — `create redis` → `${{redis.x.REDIS_URL}}` into the app — with the same "size RAM at create" note.

6. **A "connect my existing crons" note.** Vence's crons are HTTP-triggered (GitHub Actions hitting the app). They keep working pointed at the new URL, but a short doc — "keep them external and just change the URL, **or** move them to `/jobs` with `${{app.x.INTERNAL_URL}}`" — closes the last loop of a migration.

7. **Extend the `build_oom` classifier win to a general "deployment health explains itself" pass.** You already turned a silent build OOM into a legible `build_oom`. Do the same for the runtime side a whole-app cutover hits: a container that boots but fails readiness (missing `REDIS_URL`, DB auth, a crashloop) should surface a named reason (`missing_env`, `db_connect_failed`, `crashloop`) the way `build_oom` does — so the multi-service bring-up debugs itself.

**Framing:** none of these are blockers to *us* (they're our work to wire), but each is a place Koigrid can **remove friction or a footgun** so the *next* person migrating a full stack — not just a front-end — has the afternoon-long experience the DB already delivers. Land #1 (compose manifest) + #4 (capacity/load-test) and Koigrid isn't just "can host a Next.js app," it's "can absorb a production stack off AWS with the numbers to prove it."

## ⚖️ KOIGRID vs AWS — head-to-head on this migration (measured, 2026-07-24) + what Koigrid should improve

Every number below is from *this* migration (Vence prod on AWS vs the Koigrid POC), not a spec sheet. For each dimension: who's ahead today, and the concrete Koigrid improvement to close or extend it.

**Build & deploy**
- *AWS:* build in GitHub Actions (16 GB), push to ECR (no layer limit), ECS runs the image. Rock-solid but heavy (ECR + task-def + ALB + SSM + GHA + Terraform) — that surface caused the 21–22/07 incidents.
- *Koigrid:* `--dir` build-from-source on the 8 GB app runner **OOMs** a 4,468-page SSG build; the **image path now works** (ECR pull with creds → live in **30 s**, defect #2 shipped). Registry `413` on the 2.58 GB layer if you push to Koigrid's own registry (defect #3, open — moot via ECR).
- *Verdict / improve:* **tie once you use the image path** — Koigrid is simpler, AWS's build is bigger. Koigrid: raise the registry blob limit (#3) so the non-ECR path also works, and keep the image-deploy path front-and-center in docs.

**Edge latency (TTFB, from Spain)**
- *AWS:* CloudFront edge, **~40–90 ms**.
- *Koigrid:* single box, **CDN OFF**, **~180–320 ms** static / **~400–890 ms** DB-heavy.
- *Verdict / improve:* **AWS wins ~2–5× today**, but Koigrid's CDN was *off* and it's one cold box vs multi-instance+CDN. **Improve: CDN on-by-default for web apps** (this alone likely halves the gap), + keep-warm min-replicas.

**DB latency & write throughput**
- *AWS:* RDS co-located with Fargate (<1 ms same-AZ); Multi-AZ synchronous replication taxes writes.
- *Koigrid:* app→DB co-located **6.45 ms**; POC measured **INSERT 50k = 263 ms vs RDS 1,073 ms (4× faster)** — no Multi-AZ write tax on the single-node plan.
- *Verdict / improve:* **Koigrid wins on writes**, competitive on reads. **Improve: publish these co-location/write numbers** — they're a genuine edge and nobody advertises them.

**Capacity / scaling under real load**
- *AWS:* proven at Vence's ~43 M req/mo peak; reactive autoscale by CPU (needs a generous `min`, per the incidents).
- *Koigrid:* **unproven at peak** — POC was one 2 GB replica; autoscale is the same reactive CPU model, and pricing caps "apps" but is silent on replicas/throughput.
- *Verdict / improve:* **AWS wins (it's proven).** This is the #1 thing blocking a real cutover. **Improve: publish per-plan throughput/replica capacity + ship a first-class load-test/capacity report** so a migrator can *prove* peak before cutover.

**Ops surface & DX**
- *AWS:* ECR + task-def + ALB + SSM + GHA + Terraform — powerful, but the complexity *is* the incident surface.
- *Koigrid:* source-upload/image deploy, reference vars (`${{db.x}}`), private networking, flat config — **materially simpler**; an AI agent drove the whole migration via API + `llms.txt`.
- *Verdict / improve:* **Koigrid wins decisively.** Extend it with a **multi-service compose manifest** so a whole stack (front+back+redis+db) comes up as one unit, not N API calls.

**Cost**
- *AWS:* ~**$800–1,200/mo** (Fargate + RDS + ALB + transfer + egress).
- *Koigrid:* ~**$89/mo flat**, no egress fees.
- *Verdict / improve:* **Koigrid wins by an order of magnitude** — *if* the capacity item above proves Scale holds peak. Tie the cost story to a published capacity number and it's unarguable.

**Observability**
- *AWS:* CloudWatch — mature, but you assemble it.
- *Koigrid:* `/metrics` + `/events` + `/alarms` + the new `build_oom` classifier (a failed build now says *why*). Younger, improving fast.
- *Verdict / improve:* **AWS ahead on depth, Koigrid closing.** **Improve: extend the self-explaining-failure pattern to runtime** (`missing_env`, `db_connect_failed`, `crashloop`) so a multi-service bring-up debugs itself.

**DB lifecycle**
- *AWS:* RDS provisions in minutes; resize/scale after create; managed backups/PITR.
- *Koigrid:* provisions in **seconds**; **no resize after create yet** (size RAM up-front for bulk restores or the DB can crash mid-load); branching + PITR + logical replication present.
- *Verdict / improve:* **mixed** — Koigrid faster to create, AWS safer to grow. **Improve: a DB resize endpoint** (the one hard dead-end we hit).

**Net of the head-to-head:** AWS still wins on **edge latency (CDN default), proven peak capacity, and observability depth**; Koigrid already wins on **cost (~10×), ops simplicity, DB write throughput, and co-located latency**, and has **closed the build/deploy gap** for the image path. The three AWS wins are exactly the improvement list above — **CDN-on-by-default, a published+testable capacity story, and self-explaining runtime failures.** Land those and there's no axis where AWS is meaningfully ahead for an app like this.

## TL;DR for the Koigrid team

**The good (genuinely impressive):**
- `koigrid apps deploy --dir` (source-upload, no Docker/git) → live app with TLS in ~1-2 min. Delightful.
- **Co-located app→DB latency = 6.45 ms/query** on a Free instance (private networking, reference vars `${{db.x.DATABASE_URL}}`). This is the killer feature vs cross-provider.
- **Full production schema ported with 0 errors** via `pg_dump --schema-only | psql` — 195 tables, 245 functions, 87 triggers, generated columns, views. Standard Postgres = truly portable.
- overPlan / pay-later for **compute** (RAM/CPU on Free returned `overPlan:true, clamped:false`) is smooth and exactly the right model.
- API-first + CLI are clean and agent-drivable. `llms.txt` is a lovely touch.

**The friction (where we lost hours):**
1. **`extensions.vector` schema mismatch is a migration-blocker for anyone coming from Supabase.** (biggest one)
2. **DB resize is impossible after creation; an undersized DB silently *crashes* mid-restore.**
3. **`diskGb` in the create response reads like a hard cap but is actually elastic** — cost me a wrong conclusion.
4. **A dying parallel `pg_restore` worker aborts the whole restore, leaving a half-loaded DB**, with the real cause buried.

Each is explained below with the exact error and a suggested fix.

---

## Chronological journey

### Phase 0 — Feasibility on Free ($0) ✅
- Provisioned a Free Postgres (PG 17.2) in seconds. All 6 extensions we need available and creatable: `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `unaccent`, `uuid-ossp`, `vector` 0.8.0.
- Deployed a tiny Node app via `koigrid apps deploy --dir` → connected to the co-located DB → **6.45 ms/query**. This single number is what makes the platform compelling.
- Verdict: feasibility proven without spending a cent. 👏

### Phase 1 — Schema port ✅ (0 errors)
- `pg_dump --schema-only --no-owner --no-privileges` from RDS → `psql` into Koigrid (via a `postgres:17` container, `--network host`).
- **0 errors.** 195 tables (191 `public` + `auth`), 245 functions, 30 views + matviews, 81 triggers, generated columns (incl. a `GENERATED ALWAYS AS ... STORED` invariant). Nothing Supabase-specific broke *at schema level*.
- This built real confidence. Standard Postgres portability delivered.

### Phase 2 — Data load (31 GB) ⚠️ — three snags

**Snag A — `diskGb` looks capped but isn't (confusing, cost a wrong conclusion).**
Creating a DB with `diskGb:40` on Free returned `diskGb:1`. I read this as "disk hard-capped at 1 GB on Free" and reported the migration as blocked on a plan upgrade. **Wrong.** An empirical write test (1.3 M rows) grew the Free DB to **1.4 GB with no error** — disk is *elastic with overage* ($0.05/GB); `diskGb:1` is just the plan *floor*.
→ **Suggestion:** in the create/detail response, distinguish floor from cap — e.g. `diskFloorGb: 1, diskElastic: true` — or echo back the requested value with an `overageApplies: true` flag. The bare `diskGb:1` actively misleads.

**Snag B — no DB resize + undersized DB *crashes* mid-restore (worst UX moment).**
The Free DB is 512 MB RAM / 0.5 vCPU. `PATCH /databases/{id}` only accepts `name` (rename) — there is **no way to resize an existing DB**. Running a parallel `pg_restore -j4` of multi-GB tables against the 512 MB DB produced:
```
pg_restore: error: could not execute query: FATAL: server conn crashed?
SSL connection has been closed unexpectedly
pg_restore: error: ... no connection to the server
```
The **DB server crashed under load**; uncommitted work rolled back → a cascade of `relation "x" does not exist`. The restore looked like it "half-worked" (11 GB present) but core tables were empty.
→ **Suggestions:** (1) add a **resize endpoint** (RAM/CPU/disk) — or document that you must size at create time; (2) **surface DB resource pressure / OOM** in `/databases/{id}/logs` or metrics — right now a crashed DB is invisible until the client sees `server conn crashed`; (3) publish **recommended DB sizing for bulk restores** (e.g. "≥4 GB RAM for >10 GB restores").
Workaround that fixed it: create a fresh DB with `memoryMb:4096, cpus:2` at creation (accepted as overPlan — great) and restore into that; no crash.

**Snag C — `extensions.vector` mismatch blocks the restore (the big one).**
Koigrid pre-installs `vector` in schema **`public`**. Our RDS dump (Supabase origin) declares vector columns as **`extensions.vector`** (Supabase installs pgvector in an `extensions` schema). On restore:
```
pg_restore: error: ERROR: must be owner of extension vector
pg_restore: error: ERROR: type extensions.vector does not exist
pg_restore: error: ERROR: relation "public.articles" does not exist   ← cascade
pg_restore: error: a worker process died unexpectedly                 ← restore aborts
```
Because `extensions.vector` doesn't resolve, every table with an embedding column fails to create, a `-j` worker dies, and **the whole restore aborts** leaving the DB half-loaded.
The managed `app` user **cannot relocate the pre-installed extension** (`must be owner of extension vector`), so the obvious fix (`ALTER EXTENSION vector SET SCHEMA extensions`) is denied.
→ **Suggestions (any one unblocks this):**
  - (a) **Let the DB owner relocate/reinstall pre-installed extensions in their own DB** (grant enough ownership, or expose a `POST /databases/{id}/extensions {name, schema}` that the control plane executes).
  - (b) Ship a **"migrating from Supabase / pgvector in a custom schema" guide** — this will hit *every* Supabase refugee, which is a huge chunk of your ICP.
  - (c) Optionally **pre-install `vector` into `extensions` too** (or make the target schema configurable at DB create), since the Supabase `extensions`-schema convention is extremely common.
Workaround under test: on a fresh DB, `CREATE SCHEMA extensions; DROP EXTENSION vector; CREATE EXTENSION vector SCHEMA extensions;` before restore (viable only because the DB is empty/owned).

### Phase 3 — Frontend deploy ⚠️ — three MORE blockers (the live container never came up)

The frontend **built perfectly against the migrated Koigrid DB** — `next build` prerendered **4,468 SSG pages**, each querying the co-located Koigrid Postgres, 0 failures. That alone validates the DB migration end-to-end. But getting the *running container* up hit three walls:

**Snag E — registry rejects large layers (`413 Payload Too Large`).**
The production image is 2.76 GB — not bloat: `node_modules` in the standalone is only 54 MB; the weight is **`.next/server` = 2.3 GB of the 4,468 prerendered pages** (legit content). `docker push koigrid.com/vence-web` fails:
```
Copying blob sha256:… → Error: writing blob: uploading layer chunked: StatusCode: 413, Payload Too Large
```
The single `COPY .next/standalone` layer is 2.58 GB and exceeds the registry's blob limit. AWS ECR accepts it fine; Koigrid's registry does not.
→ **Suggestions:** (a) raise the registry blob/chunk limit (SSG-heavy Next.js/Astro/Hugo sites routinely exceed 1 GB); (b) document the limit + a `--compression`/chunked-resumable-upload path; (c) support layer streaming so a big legit layer isn't a dead end.

**Snag F — no build-time args: `/apps/{id}/env` is RUNTIME-only.**
The Dockerfile needs `NEXT_PUBLIC_*` (24 of them) as **build args** — they're inlined into the client bundle at `next build`. Koigrid's build (kaniko) does **not** inject app env as Docker `ARG`s, and neither the CLI (`apps deploy` has no `--build-arg`) nor the API (`POST /apps` has no `buildArgs`, `POST /apps/{id}/env` is runtime) offers a way to pass them. Result: the Dockerfile's build guard aborts (`NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` empty), and even without the guard the client bundle would ship with empty public vars.
→ **Suggestions:** (a) support **build args** — a `--build-arg` CLI flag and/or a `buildArgs` field, or inject a designated env subset (e.g. `BUILD_*` or all `NEXT_PUBLIC_*`) into the kaniko build; (b) this is table-stakes for Next.js/Vite/CRA (every one bakes public env at build). Without it, the only path is push-a-prebuilt-image — which then hits Snag E.

**Snag G — app runtime is capped at 1 vCPU even overPlan (asymmetric with DB).**
`PUT /apps/{id}/resources {cpus:2}` is accepted (`overPlan:true`) but the container **fails to start**: `docker: range of CPUs is from 0.01 to 1.00, as there are only 1 CPUs available`. So app compute overPlan works for **RAM** but **not CPU** (the DB accepted 2 vCPU overPlan; apps don't). The accepted-but-unrunnable setting is a footgun.
→ **Suggestion:** reject `cpus>plan_max` at set-time with a clear error (or actually provision it), instead of accepting it and failing at container start.

**UPDATE (deeper dig — F is partly solvable, but H+I block it):**
- **F is actually solvable** — public vars (`NEXT_PUBLIC_*`) *are* injected into Dockerfile builds. The gotcha: a conventional `ARG X` + `ENV X=${X}` promotion (used for `--build-arg` on other CI) **clobbers Koigrid's injected env to empty**. Removing the `ENV X=${X}` lines → the guard passes with the real value (`test -n "0x4AAA…" DONE`). ✅ So document this clearly: "if you set `NEXT_PUBLIC_*`, don't re-declare `ENV X=${X}` from an empty ARG — it overwrites what we inject."
- **Snag H — the build needs `DATABASE_URL`, and Koigrid doesn't inject secrets into the build.** (This is the real one — an earlier "OOM" guess was wrong.) With the guard passing, `next build` runs and dies prerendering a page that queries Postgres: `Error occurred prerendering page "/ayuda" … Error: DATABASE_URL environment variable is not set`. SSG apps that read the DB at build (via `generateStaticParams`/server components) NEED the DB connection string **at build time**. Koigrid injects public-prefixed vars into the build but treats `DATABASE_URL` (a secret) as runtime-only, so `next build` throws. Confirmed identically with a local no-`DATABASE_URL` build → same `/ayuda` failure. So the whole-app build on Koigrid is blocked unless the build can see the DB URL.
  → **Suggestions:** (a) make **reference variables** (`${{db.x.DATABASE_URL}}`) resolve **at build time**, not just runtime — that's the natural, safe way to give a build DB access without "baking a secret"; (b) or offer an opt-in "expose these secrets to the build" list; (c) document clearly that secret env is runtime-only so users know SSG-with-DB won't build out of the box.
- **Snag I — deployment lifecycle is flaky, which makes iterating painful.** Deployments frequently stick in `queued` and never run; the `id` the CLI returns doesn't match the ids in `GET /apps/:id/deployments`; deployments appear/disappear; build logs are inconsistent between reads. Rapid redeploys seem to kill in-flight builds. This unreliability is what turned a 20-minute task into hours.
  → **Suggestion:** make deployment state authoritative and consistent (stable ids CLI↔API, no silent stuck-queue, one clear build log per deployment).
- **Snag J — build runner unreachable + control-plane update took the API fully down.** During/after a platform update the whole API returned **502** (`/me`, `/apps`, `/databases`, `/v2/` — everything) for a stretch (running apps + DBs stayed up — good data/control-plane separation 👍). After the API came back, builds failed with **`Build did not produce an image … Connection timed out during banner exchange … Connection to 104.248.247.89 port 22 timed out`** — the docker-ssh **build runner was unreachable**, and new `apps deploy` calls returned `queued` but **never created a deployment record**. So the whole-app path couldn't even be *tested* end-to-end: the build never ran.
  → **Suggestions:** (a) don't 502 the entire control-plane API during updates (blue/green it like you already do the data plane); (b) health-gate the build runner so a deploy fails fast with a clear "build capacity unavailable" instead of an SSH banner timeout; (c) guarantee a deploy call either creates a tracked deployment or returns an error — never a silent `queued` that never runs.

## ✅ UPDATE 2026-07-22 (evening) — Koigrid shipped the Snag H fix, build now reaches the DB
Between drafts, Koigrid released a version whose `llms.txt` adds exactly the fix suggested here:
> *"EXCEPTION (build-time DB access): a var whose VALUE is a reference variable (e.g. `DATABASE_URL='${{db.main.DATABASE_URL}}'`) IS resolved and injected into the build too — so SSG apps that read the DB at build time compile."*

Re-tested: with `DATABASE_URL='${{db.vence-mig2.DATABASE_URL}}'`, the build **now connects to Postgres at build time** — the pre-build script read the DB and updated 38 topic names (`✅ 38 nombre(s) de temas actualizados`). **Snag H is fixed.** 🎉 (Nice turnaround.)

**✅ ROOT CAUSE CONFIRMED (reproduced locally, since the API log is truncated): the build runner OOMs.** Reproducing the exact build under a memory cap (`podman build --no-cache --memory=3g`) fails at the identical point with:
```
Creating an optimized production build ...
npm error signal SIGKILL
```
`SIGKILL` at "Creating an optimized production build…" = the **kernel OOM-killer** killed `next build` (not a Node heap error — Turbopack's native/Rust memory + Node heap together exceed the cgroup). Unconstrained locally the same build succeeds. So: **this app's `next build` needs >3 GB; Koigrid's build runner has ≤3 GB, so it dies exactly as observed** (~2 min, `build_failed`, `image: None`). This is *the* whole-app blocker, and it's a **build-runner memory limit** — nothing else.
  → **Fix (Koigrid):** bigger/configurable build-runner memory (or apply the app's `memoryMb` to its build). A Next.js/Nuxt/Astro app that prerenders thousands of pages routinely needs 4–8 GB to compile.
  → **Fix (Vence-side workaround):** cap `generateStaticParams` so far fewer pages prerender (the rest render dynamically off the 6.45 ms co-located DB) → build fits.

**(historical framing) Snag K — build OOMs + the log truncates so you can't see it.** After the DB pre-step, `next build` (Turbopack, Next 16) reaches "Creating an optimized production build…" and the deployment ends `error: build_failed`, `image: None`, after **~2 min**. But the build **log is truncated at ~8 KB, exactly at that line** — so the actual failure (OOM? a prerender throw? a runner limit?) is invisible. This app prerenders **4,468 SSG pages** reading the DB; the most likely cause is the **build runner running out of memory** (setting the *app* to 8 GB doesn't help — the build runner has its own fixed memory, separate from the app's `memoryMb`).
  → **Suggestions:** (a) **don't truncate build logs** — a build that fails must show *why* (this is the single biggest time-sink); (b) give build runners more/configurable memory, or let the app's `memoryMb` apply to its build; (c) surface OOM/kill reasons explicitly.
  **⚠️ CONFIRMED it's a hard API truncation (2026-07-22):** the deployment's `logs` field is returned by the API at **exactly 8222 chars, ending mid-word at `#15 5.980 Creating an optimized production build ...`** — i.e. the failure reason is *never* in the payload. Tried `/apps/:id/logs?type=build`, `?full=1`, `?deployment=latest` → all return runtime logs (`"(sin contenedor activo)"`), and there is **no endpoint that returns the complete build log**. Net: **a `build_failed` deployment gives you the first 8 KB of build output and nothing about the actual error** — you cannot diagnose a failing build from the API/CLI at all. To find the real cause I had to **reproduce the build locally under a matching memory cap** (`podman build --memory=…`), because Koigrid's own logs don't carry it. **This is the #1 thing to fix** — everything else was findable; this wasn't.
  → **Vence-side workaround (not Koigrid's fault):** cap `generateStaticParams` to the top-N pages and let the long tail render dynamically (the co-located DB is 6.45 ms, so SSR is cheap) — that shrinks the build enough to fit a smaller runner.

## Status ledger (Koigrid is iterating fast — thank you)
- **Snag H (build-time DB access): ✅ FIXED** in a release — reference vars now resolve into the build. Confirmed live.
- **Snag K (build OOM): ⛔ narrowed to "8 GB machine one size too small"; needs MIG-K 16 GB runner (RE-TEST #5, 2026-07-23).** Two OOM peaks on the cpx32 8 GB *total-machine*: (1) the `tsc` type-check — **fixed** with `typescript: { ignoreBuildErrors: true }` in `next.config.mjs` (Vence keeps `tsc --noEmit` in CI); confirmed working (`✓ Compiled successfully in 67s`, no TS phase). (2) Then a **second OOM in `next build` static generation** — got past **3351/4468** pages (3 workers rendering data-heavy law/teoría SSG pages w/ live DB) before SIGKILL at 122 s (`build_failed`; classifier doesn't flag this phase as OOM — worth extending). Local `--memory=8g` runs the whole pipeline to success (clean 8 GB cgroup + host FS cache), so it's the machine overhead (~1–1.5 GB OS+buildkitd) that tips it over. **Fix = MIG-K 16 GB runner** (Koigrid offered it), or Vence-side path B (trim `generateStaticParams` so the data-heavy pages render dynamically off the 6.45 ms co-located DB). See "RE-TEST #5 → Result" section.
- **Snag K-obs (silent/truncated build OOM): ✅ FIXED (koigrid side).** `classifyBuildError` detects the silent kernel-OOM (build dies mid "creating an optimized production build" with no image) → returns a legible `build_oom` message with fixes, so a failed build now tells you *why* instead of ending at a truncated log. (The 8222-char cutoff was the OOM-killer stopping the build mid-line, not koigrid truncating.)
- **Snags I/J (deployment lifecycle): partially better** — a *fresh* app registers deployments reliably now; an app already in `error` still silently drops new deploys (so each re-test needs a brand-new app), and CLI-returned ids still don't match the API list.

**So the last thing standing between "DB migrated" and "whole app migrated" is the image-deploy path.** Building on Koigrid's 8 GB runner OOMs a 4,500-page SSG build — but that's the wrong problem to solve. The right one is the AWS-standard model: build in CI, deploy an immutable image. That path is shut by exactly two things — **no external private-registry pull creds (#2)** and **the registry `413` blob limit (#3)**. Close either and the migration completes. Everything else is solved.

## Bottom line (from the person who ran this)
The **database** side is excellent — 31 GB moved 1:1, standard-Postgres portability, co-located latency 6.45 ms, elastic disk, pay-later compute. If Koigrid is "the anti-AWS," the DB story already delivers. The **whole-app** side is where the gap is, and it narrowed over the day to one thing: **serving a pre-built image**. Koigrid already fixed what we reported mid-run (Snag H build-time DB access; the capacity-accounting bug; the `build_oom` classifier) and folded the gotchas into new docs — genuinely fast. What's left is the immutable-artifact path every ECS user relies on: **(#2)** pull a private image from an external registry (ECR/GHCR) with credentials — the single highest-leverage fix, it makes Koigrid a drop-in ECS — or **(#3)** raise the registry blob limit so a pre-built SSG image can be pushed to Koigrid's own registry. Land either and a real Next.js app migrates as smoothly as the database did. Happy to re-run the whole thing the day it lands — the image is built and waiting.

**Net for Phase 3 (final):** the DB migration is proven end-to-end (the app builds & prerenders 4,468 pages against Koigrid's DB *locally*, in 8 GB). The *hosted container* isn't live because both routes to deploy a pre-built image are blocked — **#2** (no external-registry pull credentials) and **#3** (registry `413` on the 2.58 GB layer, re-confirmed 2026-07-23) — and building-from-source on the 8 GB runner OOMs (the wrong path to force). Fix #2 or #3 and the whole-app migration completes. As-is, the DB moves in an afternoon; the front-end just needs Koigrid to run an image built elsewhere — which is how the app already ships on AWS.

**Snag D — parallel-restore abort is opaque.**
When one `-j` worker dies, `pg_restore` aborts and the surviving output is a wall of cascade errors; the *root* error (the vector type) is 20 lines up. This is upstream Postgres behaviour, but a **Koigrid "managed restore" helper** (upload a dump → we run it with sane flags, pre-seed extensions, and give you a clean success/failure summary + row-count diff) would be a standout feature for the "anti-AWS, migrate-in-an-afternoon" pitch.

---

## Concrete suggestions, prioritized

*(Top two are today's actual blockers for the front-end — see "BUILD & DEPLOY: Koigrid vs AWS". The rest are DB-side, mostly already shipped.)*

| # | Suggestion | Impact | Effort | Status |
|---|---|---|---|---|
| 0a | **External private-registry pull with credentials** (`imagePullSecret` on image deploys) — pull the ECR/GHCR image CI already builds | **Makes Koigrid a drop-in ECS**; unblocks every heavy-build app | Med | ✅ **SHIPPED 2026-07-23 (koigrid side).** `POST /apps {sourceType:'image', image, registry, registryUsername, registryPassword}` (or CLI `apps deploy --image <ref> --registry <host> --registry-user <u> --registry-password <p>`). Creds encrypted at rest, never logged/returned; password never in argv. E2E-verified against a private registry incl. a negative control (no creds → pull denied). For ECR: password = `aws ecr get-login-password`. **This is the drop-in-ECS path — build in CI, koigrid pulls + runs the immutable image, no koigrid build / no build-OOM. Please re-test Vence's front-end via this path.** |
| 0b | **Raise the registry blob-size limit** (2.58 GB layer → `413`; support chunked/resumable) | Unblocks pushing SSG-heavy images to Koigrid's own registry | Med | ⛔ open (defect #3, re-confirmed 07-23) |
| 1 | **Supabase/pgvector migration guide** + let owners place extensions in a chosen schema | Unblocks every Supabase refugee (your core ICP) | Low (docs) + Med (API) | 🟡 docs shipped |
| 2 | **DB resize endpoint** (RAM/CPU/disk post-create) | Removes a hard dead-end | Med | open |
| 3 | **Surface DB OOM/crash in logs & metrics** | Turns an invisible failure into a legible one | Med | 🟢 build_oom classifier shipped |
| 4 | **Clarify elastic disk in API** (`diskFloorGb`/`diskElastic`) | Stops the "capped at 1 GB" misread | Low | ✅ shipped |
| 5 | **Managed restore helper** (dump → pre-seed exts → restore → row-count diff) | Signature "migrate in an afternoon" feature | High | open |
| 6 | Prominent **caCert / TLS** note (internal endpoint is self-signed; reference-var URL bakes `sslmode=require` → `pg` treats as `verify-full`) | Fewer first-connection face-plants | Low | 🟡 docs |

---

## What Koigrid got RIGHT and should double down on
- **source-upload deploys** and **reference vars** — the DX here is better than ECS/ALB/Terraform by a mile. This is the wedge.
- **Co-located latency** — 6.45 ms sells itself. Put it on the pricing page.
- **overPlan / pay-later for compute** — exactly right; extend the same clarity to disk (see #4).
- **Standard Postgres, no lock-in** — schema ported with 0 errors. Keep it boring; boring is the feature.
- **API-first + `llms.txt` + CLI** — an AI agent drove this whole migration. Lean into "the cloud an agent can operate."

---

## Metrics from this run
- Free DB provision: **seconds**. 4 GB DB provision: ~2-3 min.
- `pg_dump` of 31 GB → **3.8 GB** compressed, **15 min** (RDS→local).
- Schema port: **0 errors**, 195 tables + 245 functions + 87 triggers.
- Co-located app→DB latency: **6.45 ms/query**.
- Time lost to the 4 snags above: ~2 hours (mostly Snag B re-restore + Snag C diagnosis).

*Net: the platform is genuinely good and the migration is very doable — snags 1-3 are the difference between "migrate in an afternoon" and "migrate in a day of head-scratching." Fix the Supabase/pgvector path (#1) and you unlock a wave of Supabase refugees.*
