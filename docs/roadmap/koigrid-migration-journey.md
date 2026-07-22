# Koigrid migration journey — feedback report

> **What this is:** an honest, end-to-end log of migrating a real production app (Vence — a Spanish exam-prep platform: Next.js 16 frontend + 31 GB PostgreSQL) **from AWS (ECS Fargate + RDS) to Koigrid**, written to help Koigrid improve the migration experience. Mix of what worked great and where we hit friction, with concrete suggestions.
>
> **Source stack:** Next.js 16 (standalone) on ECS Fargate + PostgreSQL 17.6 on RDS Multi-AZ (eu-west-2). DB = 31 GB, ~195 tables, 245 functions, 87 triggers, generated columns, 38 views, pgvector embeddings. Origin was Supabase (cut over to RDS 2026-07), so the schema carries Supabase-era conventions (an `extensions` schema, an `auth` schema).
> **Tester:** an AI agent (Claude) driving the Koigrid REST API + CLI end-to-end. Date: 2026-07-22.

---

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
- **Snag K (build-runner OOM): ⛔ STILL OPEN** as of the latest release checked. Re-tested: `build_failed` again, deployment duration **121 s** (`createdAt`→`finishedAt`), i.e. still dying ~2 min into `next build` — same OOM as the local `--memory=3g` repro (`SIGKILL`). (A `#11 523.9s` line in the log is a **cached-layer artifact**, not real elapsed time — BuildKit prints cached step logs verbatim; don't be fooled by it, as I briefly was.) **The build runner still can't compile this app.**
- **Snag K-obs (truncated build log): ⛔ STILL OPEN** — the truncation is what forced local repro and made even *confirming* the above take extra work.
- **Snags I/J (deployment lifecycle): partially better** — a *fresh* app registers deployments reliably now; an app already in `error` still silently drops new deploys, and CLI-returned ids still don't match the API list.

**So the last thing standing between "DB migrated" and "whole app migrated" is one number: the build-runner's memory.** Bump it (this app needs >3 GB, realistically 4–8 GB for a Next.js SSG build of ~4,500 pages) — or let the app's requested `memoryMb` apply to its build — and the migration completes. Everything else is solved.

## Bottom line (from the person who ran this)
The **database** side is excellent — 31 GB moved 1:1, standard-Postgres portability, co-located latency 6.45 ms, elastic disk, pay-later compute. If Koigrid is "the anti-AWS," the DB story already delivers. The **whole-app** side is where the gap is, and it's concentrated and fixable: **(H)** give builds DB access (reference vars resolved at build-time is the clean fix), **(E)** raise the registry blob limit so SSG-heavy images push, **(F)** you already inject `NEXT_PUBLIC_*` — just document the `ENV X=${ARG}`-clobbers-it gotcha, and **(I/J)** make the deploy queue + build runner reliable and observable. Land those and a real Next.js app migrates as smoothly as the database did. Happy to re-run the whole thing the day these land — the playbook is written.

**Net for Phase 3 (final):** the DB migration is proven end-to-end (the app builds & prerenders 4,468 pages against Koigrid's DB *locally*). Getting the *hosted container* live is blocked by **H** (build runner dies compiling a large Next.js app) and made very hard to iterate by **I** (flaky deployment lifecycle). E and F both have workarounds (F fully; E is sidestepped because the DB-less build is small). Fix H + I and the whole-app migration completes. As-is, the DB moves in an afternoon; the app front-end needs your build runner to handle a large Next.js compile and your deployment queue to be reliable.

**Snag D — parallel-restore abort is opaque.**
When one `-j` worker dies, `pg_restore` aborts and the surviving output is a wall of cascade errors; the *root* error (the vector type) is 20 lines up. This is upstream Postgres behaviour, but a **Koigrid "managed restore" helper** (upload a dump → we run it with sane flags, pre-seed extensions, and give you a clean success/failure summary + row-count diff) would be a standout feature for the "anti-AWS, migrate-in-an-afternoon" pitch.

---

## Concrete suggestions, prioritized

| # | Suggestion | Impact | Effort |
|---|---|---|---|
| 1 | **Supabase/pgvector migration guide** + let owners place extensions in a chosen schema | Unblocks every Supabase refugee (your core ICP) | Low (docs) + Med (API) |
| 2 | **DB resize endpoint** (RAM/CPU/disk post-create) | Removes a hard dead-end | Med |
| 3 | **Surface DB OOM/crash in logs & metrics** | Turns an invisible failure into a legible one | Med |
| 4 | **Clarify elastic disk in API** (`diskFloorGb`/`diskElastic`) | Stops the "capped at 1 GB" misread | Low |
| 5 | **Managed restore helper** (dump → pre-seed exts → restore → row-count diff) | Signature "migrate in an afternoon" feature | High |
| 6 | Prominent **caCert / TLS** note (internal endpoint is self-signed; reference-var URL bakes `sslmode=require` → `pg` treats as `verify-full`) | Fewer first-connection face-plants | Low |

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
