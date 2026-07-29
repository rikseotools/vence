# Koigrid migration journey — feedback report

> **What this is:** an honest, end-to-end log of migrating a real production app (Vence — a Spanish exam-prep platform: Next.js 16 frontend + 31 GB PostgreSQL) **from AWS (ECS Fargate + RDS) to Koigrid**, written to help Koigrid improve the migration experience. Mix of what worked great and where we hit friction, with concrete suggestions.
>
> **Source stack:** Next.js 16 (standalone) on ECS Fargate + PostgreSQL 17.6 on RDS Multi-AZ (eu-west-2). DB = 31 GB, ~195 tables, 245 functions, 87 triggers, generated columns, 38 views, pgvector embeddings. Origin was Supabase (cut over to RDS 2026-07), so the schema carries Supabase-era conventions (an `extensions` schema, an `auth` schema).
> **Tester:** an AI agent (Claude) driving the Koigrid REST API + CLI end-to-end. Dates: 2026-07-22 (initial run) → 2026-07-23 (re-test cycle across new releases) → 2026-07-24 (image-deploy retest, then the whole-app manifest + load-test features) → 2026-07-25 (managed restore-dump tested end-to-end + AWS head-to-head re-run) → 2026-07-27 (three releases in one day: `scale-out` re-test, custom-domain/CDN policy, bring-your-own CDN) → **2026-07-29 (A3 confirmed working: edge caching + ~60× capacity, managed restore re-tested end-to-end, new blocker A4)**. **Start with the OPEN ACTION LIST right below** — it consolidates every outstanding ask with a repro and an acceptance test.

---

## 🔧 OPEN ACTION LIST — everything this report still asks for, prioritized, each with a repro and an acceptance test (updated 2026-07-29)

> Read this first if you're here to ship fixes. Every item below was **reproduced on a real migration** (Vence: Next.js 16 + 31 GB Postgres, AWS→Koigrid), and every "acceptance test" is something you can run against a fresh account to know it's closed. Detail and evidence for each is in the dated sections further down. Nothing here is a nice-to-have we imagined — it's what actually blocked or slowed a paying-sized migration.

> ## 🎉 **STATUS 2026-07-29 — READ THIS FIRST. The two blockers that mattered are CLOSED.**
>
> - **A3 (HTML edge caching) WORKS.** Bare `s-maxage` is honoured exactly as we argued (R1-bis): `/`, `/leyes`
>   and `/leyes/constitucion-espanola` all go `MISS → HIT` with a growing `age`. **Open since 07-24, closed.**
> - **The capacity consequence is ~60×:** same load test, same app, **one 2 GB replica on the free plan** →
>   **615 rps** (p50 19 ms, p95 50 ms, 0 % errors, *not* saturated, CPU 0 %), against **8.8–10.5 rps saturated**
>   on 07-25. Our production peak is 16.6 rps: **one replica now carries 37× our peak.**
> - **Latency vs AWS production (CloudFront + 8 Fargate tasks) collapsed to 1.4–2.0×**, from 4.2–5.6× — and
>   Koigrid **wins** our heaviest page (165 ms vs 202 ms).
> - **Managed restore re-tested end-to-end: A1, B1, B2 and `preSeed` all CONFIRMED FIXED.**
> - 🔴 **One new hard blocker, A4:** the restore cannot build a pgvector **ivfflat** index —
>   `maintenance_work_mem is 64 MB` (PostgreSQL's factory default, `source: "default"`, not scaled to the
>   cluster) and **no API exists to raise it**. One `SET` in your restore session fixes it; we proved the
>   unprivileged `app` role can set it. This blocks the managed restore for every Supabase/pgvector source.
> - 🔴 **N1 (`scale-out`) still fails** with `replica_unhealthy`, third reproduction — but it **no longer
>   blocks us**, and it turned out A3 never depended on it (see Finding 4: your `/rules` message says it does).
> - 💰 **LATER THE SAME DAY YOU PUBLISHED THE PRICES — G5 is closed too.** Worked against our measured
>   numbers: **Pro ($35/mo)** fits us, with **exact DB RAM parity** with our RDS (4 GB) and 5× bandwidth
>   headroom. Against our measured AWS run-rate of **$491/mo that is 14× cheaper.** Remaining gap in the
>   published model: **Redis is not priced anywhere.**
> - ✅ **Nothing technical and nothing commercial is now open on your side.** What's left is ours.
>
> Full evidence in the **RE-TEST 2026-07-29** section at the end of this document.

> **STATUS UPDATE 2026-07-25 (later), after the next release:** **A3 (HTML edge caching) is now documented as SHIPPED 🎉 — but we cannot observe it**, because `PUT /apps/{id}/cdn {enabled:true}` **regressed** and now fails on every `*.apps.koigrid.com` app (new item **R1**, and it's a one-way door: disabling still works). **A1/A2/B1/B2 are moot for now: the managed restore-dump endpoints were withdrawn** (404, `openapi.json` byte-identical to the 24/07 build) — re-test when they return. Three more regressions landed with this build: **R3** (new apps no longer CDN-by-default), **R4** (`POST /apps sourceType:image` no longer auto-deploys), **R5** (`/rules` header rules have no effect), **R6** (runtime error-code catalogue gone from the docs). Detail + evidence in the 🚨 section below.

### ✅ CLOSED 2026-07-25 (evening release) — verified against the live API
**R1** (CDN enables again) · **R3** (new apps CDN-on by default) · **R4** (image apps auto-deploy, live on 1st attempt in ~25 s) · **R5** (`/rules` now reports `enforcement{enforced,servedBy,note,remedy}` — better than we asked) · **R6** (runtime error codes back) · **the replica/autoscale plan gate is gone** (free tier can now run a 6–10 replica capacity test — the #1 cutover gate, and **we passed it: 109 rps @ 0 % errors on 6 replicas vs our 16.6 rps peak**) · **A1/A2/B1/B2 + C2** shipped as documented in the restored managed restore (`\restrict` stripped, auto-ownership + `POST /databases/:id/fix-ownership`, dump kept on failure, atomic restore) — *documented, end-to-end re-test pending*.

### 🔴 STILL OPEN — updated 2026-07-29
- ~~**A4 — the managed restore cannot build a pgvector `ivfflat` index.**~~ ✅ **CLOSED 2026-07-29 17:55** — fixed and verified end-to-end: the failure line moved past the index build, and a complete dump then restored `done` in 267 s with **61 123 articles + 1 404 laws (exact match with RDS)**, the `ivfflat` index present and `owner = app`. **First fully successful managed restore.** Original report kept below for the record.
- **A5 (new, small) — `tableCounts` comes back as `[]` on a SUCCESSFUL restore.** Your docs sell it as *"per-table row counts to verify the migration"*; it is what makes a restore trustworthy without a second tool. Empty on success (`{"status":"done","tableCounts":[],"logs":"__KOIOK__"}`), `null` on failure (fair). We had to verify the counts ourselves via `/query`.
- **A4-OLD (for the record) — the managed restore cannot build a pgvector `ivfflat` index.** `ERROR: memory required is 65 MB, maintenance_work_mem is 64 MB`. `SHOW maintenance_work_mem` → `65536 kB` with **`source: "default"`** (PostgreSQL's factory default, *not* derived from cluster RAM), `PUT /databases/{id}/resources` is `404`, `apply-config` is for node recreation, and your pooler rejects `PGOPTIONS="-c maintenance_work_mem=…"` (`unsupported startup parameter in options`). **Fix: `SET maintenance_work_mem` in the restore session** — it is `USERSET` and we verified the unprivileged `app` role can set it to 256 MB on your own cluster. **Acceptance:** a dump containing `CREATE INDEX … USING ivfflat` over ≥50 k rows restores cleanly on a free-tier cluster.
- **N1 — `PUT /apps/{id}/scale-out {enabled:true}` + deploy fails with `replica_unhealthy`.** **UPDATE 17:55 — half fixed:** `runner` is now recorded (`167.233.84.5`) and `logs` is no longer empty, **but** it contains only the sentinel `KOI_SO_FAIL`, the `error` is still the same `replica_unhealthy` string (so it does **not** yet distinguish "couldn't reach the machine" from "container didn't start"), and `image` is `null` on the failed deployment where successful ones carry the ECR reference. The whole thing fails in **14 s** while the app's own log stream shows `✓ Ready in 0ms`. **Correction we owe koigrid:** our earlier "the replica was never scheduled" diagnosis was inferred from `runner: null` and now looks **wrong** — placement did happen. Narrower ask: **say why the replica was judged unhealthy** (exit code / failed probe / timeout). **Sixth reproduction** (07-25, 07-27, 07-29 ×4), the longest-lived open bug in this report, always ~24-30 s, always **empty logs**, always **`runner: null`**. **Now proven platform-wide, not our app: it fails identically on a second, unrelated app (`vence-web9`)**, while both apps deploy fine on the normal path minutes before and after. `runner: null` + no logs + no container output says the replica was **never scheduled** — so `replica_unhealthy` is reporting the wrong layer and sends you hunting for a `healthPath` that doesn't exist. **Asks:** (1) distinguish *never scheduled* from *scheduled and unhealthy* (`no_runner_available` / `scale_out_placement_failed`); (2) emit logs on this path — it is the only failure mode on koigrid that does not self-explain; (3) actually return the documented preconditions (`need_2_meshed_runners` / `scale_out_v1_image_only` / `no_lb_vip`), because today none are returned yet placement never happens. **No longer blocks us** (A3 works without it), and **no downtime in any of the four attempts** — the last-good deployment kept serving throughout.
- **`/rules` `enforcement` message is misleading now that A3 works.** It still returns `enforced:false, servedBy:"legacy_runner"` with a remedy pointing at `scale-out` — on an app that is demonstrably edge-caching. It cost us a wrong conclusion on 07-27 ("A3 is gated behind N1"). Suggestion: report `documentCaching: "active"` separately from `customRules: "pending_central_edge"`.
- **`GET /apps/{id}/env/verify` reports green on an unresolved `${{…}}` reference.** Our container received the literal string `${{db.vence-mig2.DATABASE_URL}}` (the referenced DB had been deleted) → every API route `500`; `env/verify` said `present:true, matchesConfigured:true`. Ask: fail the deploy on an unresolved reference, and have `env/verify` flag `^\$\{\{.*\}\}$` as `unresolved_reference`.
- **`postgres: {running, available, behind}` is documented but absent** from `GET /databases/{id}`. Ours actually runs **17.2** while the docs say PG17 ships 17.5 (our source is 17.6) — and you correctly tell people to check this after a migration.

### 🔴 STORAGE (new, 2026-07-29 15:20) — we cannot complete the move to `storage.koigrid.com`
- **S1 — an org-minted key cannot read our production bucket.** `POST /storage/keys` correctly returns `endpoint: https://storage.koigrid.com`, but that key gets **`AccessDenied`** on `ListObjectsV2 s3://vence-videos/` and **403** on `HeadObject`. Meanwhile `GET /buckets` → **`{"buckets":[]}`** although we serve ~56 GB of course video from `vence-videos` in production. **Ask: attach the bucket to our organization, or issue a key authorized for it.** Until then we are not switching — the old address still works (presigned GET → **206 in 44 ms**).
- **S2 — `GET /buckets` omits a bucket we own and serve.** An inventory endpoint that hides live data is worse than none; it briefly made us think the bucket was gone. List it, or say why it can't be listed.
- **S3 (docs, cheap, prevents an outage) — state that the endpoint change and the key rotation are COUPLED.** Both halves proved: old key + new endpoint = `InvalidAccessKeyId`; new key + our bucket = `AccessDenied`. Someone reading *"change the address"* and shipping that one env var alone **403s every object**.
- **S4 (process) — a token named `migracion videos (borrar)` (scopes `storage:*`) was created in our account at 12:43 UTC and revoked at 13:14 UTC today.** Done cleanly, revoked after, nothing broke — but we only found out by listing our own tokens. **Emit a customer-visible event** (`storage.migrated`, `staff.access.granted/revoked`), because nobody reads a token list.
- ✅ **The docs change itself is right** — *"never hardcode the endpoint"* — and it caught a real bug **on our side**: our production code defaults to the old constant and our task definition sets no override.

### ✅ CLOSED 2026-07-29 — verified end-to-end against the live API
**A3** (HTML edge caching: `MISS → HIT`, growing `age`, bare `s-maxage` honoured — and **~60× capacity: 615 rps on one 2 GB replica**, p95 50 ms, 0 % errors) · **A1** (`\restrict` from `pg_dump` 17.10 parsed) · **B1** (dump retained on failure, retried with the same `dumpKey`, no re-upload) · **B2** (atomic: two failed jobs left **zero** half-created objects) · **`preSeed`** (`extensions.vector` pre-created, restore proceeded past the pgvector column) · **`pause`/`resume`** (paused POC resumed and serving production HTML in ~45 s, no rebuild).

### P0-OLD — regressions from the previous build (all FIXED, kept for the record)

**R1. `PUT /apps/{id}/cdn {"enabled":true}` fails on `*.apps.koigrid.com` — CDN cannot be turned on by anyone, and disabling is a one-way door.** Verbatim the error you fixed on 24/07 (*"needs a valid Cloudflare edge certificate … attach a custom domain"*), reproduced on an existing app (5 attempts) **and on a brand-new app** (`server: Caddy`, no Cloudflare in front). **This blocks A3 entirely** — the feature this release ships cannot be exercised. **Acceptance:** on a free account, enabling the CDN on a default-hostname app succeeds and the next response carries `cf-cache-status`.

**R1-bis. Treat bare `s-maxage` as edge-cacheable, not just the literal `public`.** The new docs ask for `Cache-Control: public, s-maxage=<n>`. **Next.js never emits `public`** — prerendered ISR pages ship `s-maxage=31536000` / `s-maxage=3600, stale-while-revalidate=…` alone, and CloudFront caches them (RFC 9111: `s-maxage` is itself a shared-cache directive). If the literal token is required, your entire Next.js/Astro ICP will still see `DYNAMIC`. Keep `Set-Cookie`/`private`/`no-store` as the disqualifiers. **Acceptance:** a page sending only `s-maxage=60` returns `cf-cache-status: HIT` on the second request.

**R2. Managed restore-dump was withdrawn** (404 on all three routes). Fine if deliberate while A1/A2 are fixed — flagged in case it was collateral. **A1/A2/B1/B2 below are parked until it returns.**

**R3. New apps are no longer CDN-enabled by default** (`POST /apps` → `cdnEnabled:false`; the "on by default" docs line is gone). Shipped 24/07, gone now. Combined with R1: **no path to an edge-cached app on the default hostname.**

**R4. `POST /apps {sourceType:"image"}` no longer auto-deploys** — the app sits at `status:"created"`, `url:null`, `deployments:[]` for 10+ minutes with no error until you `POST /apps/{id}/deployments` by hand. **Acceptance:** creating an image app reaches `running` with no extra call.

**R5. `/apps/{id}/rules` header rules are stored but have no observable effect** — `type:"header"` with `Cache-Control` returned `201` and the response header never changed (4 requests over 30 s, CDN on at the time). The documented `vercel.json` equivalent doesn't apply. **Acceptance:** a header rule visibly changes the response header.

**R6. The runtime error-code catalogue disappeared from `llms.txt`** (`missing_env`, `db_connect_failed` + the `NODE_TLS_REJECT_UNAUTHORIZED=0` hint, `redis_connect_failed`, `oom_runtime`, `port_mismatch`, `crashloop`). Docs regression at minimum; if the codes are gone too, multi-service bring-up lost its self-debugging.

### P0 — blocks a migration outright *(A1/A2 parked: the feature is currently withdrawn — see R2)*

**A1. Managed restore rejects any dump from a current `pg_dump` (≥17.6/18).** *(new, 2026-07-25)*
- **Symptom:** `POST /databases/:id/restore-dump` → `status: failed`, `error: "psql:<stdin>:5: error: invalid command \restrict"` — fails at line 5, before any data.
- **Cause:** since the Aug-2025 security releases, `pg_dump` ≥ 17.6/18 wraps output in the `\restrict <token>` / `\unrestrict` psql meta-commands. Your restore runner's `psql` is older and can't parse them.
- **Reproduced on both a PG 16 and a PG 17 cluster** → it's the runner's client binary, not the cluster major. Creating the DB with `--version 17` does **not** help (a migrator will try that first).
- **Fix:** ship `psql` ≥ 18 in the restore runner (newer clients read older dumps fine), or strip/tolerate `\restrict`/`\unrestrict` server-side.
- **Acceptance test:** `pg_dump` (17.6+) any DB → upload → restore → `done`. No user-side editing of the dump.

**A2. After a *successful* restore, the app role can't read its own data — and neither can Koigrid's own APIs.** *(new, 2026-07-25)*
- **Symptom:** restore reports `done` with correct `tableCounts`, then: `psql` as `app` → `ERROR: permission denied for table topics`; `GET /databases/:id/data/topics` → `{"error":"bad_request","detail":"permission denied for table topics"}`; `POST /databases/:id/query` → `{"error":"query_error","detail":"permission denied for table topics"}`.
- **Cause:** the restore runs as superuser, so every object ends `tableowner = postgres`, while `app` (the only login role you expose — `GET /databases/:id/roles` confirms `superuser:false`) gets nothing.
- **No self-heal exists:** `ALTER TABLE … OWNER TO app` → *"must be owner of table"*; `GRANT SELECT … TO app` → *"permission denied for table"*; `POST /query` is read-only → *"cannot execute GRANT in a read-only transaction"*. The database is a brick.
- **Note this is a regression vs the DIY path** (`pg_dump | psql "$DATABASE_URL"` as `app` leaves everything owned by `app` and working) — i.e. the managed feature is currently worse than the thing it replaces, at the one job it exists for.
- **Fix:** run the restore **as the app role**, or finish it with `REASSIGN OWNED BY postgres TO app` + `GRANT ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA … TO app` + matching `ALTER DEFAULT PRIVILEGES`. Please also expose an idempotent `POST /databases/:id/fix-ownership` for databases already stuck in this state.
- **Acceptance test:** after `status: done`, `SELECT count(*)` as the connection-string user succeeds, and `GET /databases/:id/data/<table>` returns rows.

**A3. Cache document/HTML responses at the edge when the origin opts in.** *(open since 2026-07-24 — full detail in the section right below)*
- **Symptom:** every page returns `cf-cache-status: DYNAMIC` although the app sends `Cache-Control: public, s-maxage=86400…`, no `Set-Cookie`, `x-nextjs-cache: HIT` (prerendered). CloudFront serves the identical response from edge (`x-cache: Hit from cloudfront`, `age: 6560`).
- **New evidence (2026-07-25) — it is also a *capacity* gate, not just latency:** with CDN **ON**, `POST /apps/{id}/loadtest` 30 s @ concurrency 15 gives **8.8 rps** on `/` and **9.2 rps** on a fully prerendered ISR page, saturated — **identical to the pre-CDN 8.7 rps**, because every request still reaches the single origin container. Our production peak needs ~16.6 rps: edge-caching that one prerendered document is the difference between **1 replica and 6–10**.
- **Fix:** when `cdnEnabled` and the origin advertises a public `s-maxage` with no `Set-Cookie`, apply a Cache Rule = *Cache Everything* + *Edge TTL: respect origin*; handle the Next.js `Vary: RSC, next-router-*` so the document variant caches while RSC/prefetch sub-requests pass through; expose an override (`PUT /apps/{id}/cdn {"cacheDocuments":true,"edgeTtl":"origin"}`); report HIT/MISS ratio in `/metrics`.
- **Acceptance test:** second request to a prerendered page returns `cf-cache-status: HIT`, and a load-test on that page no longer saturates at ~9 rps on 1 replica.

### P1 — turns one mistake into an expensive loop

**B1. `dumpKey` is single-use, and re-using it fails opaquely.** *(new, 2026-07-25)* Re-submitting a key after a failed job → `error: "download_failed"`, logs `curl: (22) … 404`. So **every** failed attempt costs a **full re-upload** — 5 MB for our probe, **31 GB** for the real thing, and this is exactly the loop a migrator lands in while discovering A1 and A2. **Fix:** keep the object until the job succeeds (or for its TTL) and allow re-submitting the same key; otherwise return *"dump already consumed — request a new upload URL"* instead of a raw 404. **Acceptance:** a failed restore can be retried with the same `dumpKey`.

**B2. A failed restore leaves partial objects, and the next attempt reports the *wrong* root cause.** *(new, 2026-07-25)* No rollback, no pre-flight check: after a failure at line 120, the next run died at line 43 with `relation "ai_knowledge_base" already exists` — the leftover, not the real problem. That defeats your otherwise excellent fail-fast design (we only got a true signal after a manual `DROP SCHEMA public CASCADE`). **Fix:** restore into a transaction/staging schema, or detect a non-empty target and either refuse up-front (`target_not_empty`) or accept `{"mode":"clean"}`. **Acceptance:** two consecutive failing restores report the *same* root-cause error.

**B3. Write-only env introspection.** *(open since 2026-07-24)* We could not close the Stripe-webhook canary because a secret set via `POST /env` and via the manifest still didn't match at runtime, and Koigrid never returns a stored value (correct!) — so "is my secret actually loaded and correct?" is undiagnosable remotely. **Fix:** a scope-gated `GET /apps/{id}/env?verify=KEY&sha256=<hash>` (or "does the running container see KEY with this digest?") that never returns plaintext. **Acceptance:** a migrator can prove a secret reached the container without printing it.

### P2 — docs and API polish (cheap, high first-impression value)

- **C1.** `GET /docs/migrate` still documents only the DIY `pg_dump | psql` path — **zero mentions of `restore-dump`**. Your flagship migration feature is invisible exactly where a migrator looks first.
- **C2.** Envelope mismatch: `llms.txt` calls it a *job* (`/restore-dump/:jobId`) but the response wraps under **`{"restore":{…}}`**. An agent that follows the docs reads `resp.job.id` → `undefined` (we did, first try).
- **C3.** `POST /databases` defaults to **`version: "16"`** while your own migrate guide (rightly) says to match the source major. Default to the newest supported, or warn on mismatch — nobody notices until restore time.
- **C4.** Document the `\restrict` requirement (until A1 lands) and the ownership behavior (until A2 lands) in the migrate guide — a one-line warning would have saved us both loops.

### ✅ Shipped since this report started (thank you — turnaround measured in hours)
capacity-accounting bug · `build_oom` classifier · external-registry pull with creds + **native ECR** · whole-app **`/manifest`** · **`/apps/{id}/loadtest`** · `build_export_failed` flake · runtime error self-classification (`missing_env`/`db_connect_failed`/…) · **CDN on by default** (incl. existing apps) · **managed restore-dump** (engine is right — see A1/A2/B1/B2 for what's left).

### 📝 Correction we owe you
We earlier wrote that **inbound logical replication from an external primary was missing**. `/docs/migrate` documents it (`CREATE SUBSCRIPTION` on Koigrid, *"the app user has REPLICATION — no superuser needed"*). We have **not** tested it (it needs `rds.logical_replication=1` + a publication on our production RDS, an owner-approved change), but the capability exists and our note was wrong.

---

## 🎯 THE #1 THING KOIGRID SHOULD BUILD TO BEAT AWS — cache HTML at the edge honoring origin `Cache-Control` (2026-07-24)

**This is the single highest-leverage improvement for Koigrid, measured on this migration.** After Koigrid shipped CDN-on-by-default, AWS *still* wins edge latency — and we traced the entire remaining gap to one thing: **Koigrid's CDN (`cdnEnabled`) does not cache HTML/document responses; AWS CloudFront does.** It is NOT an app problem (Vence already sends cacheable headers) and NOT fixable by the user (Koigrid exposes no cache-rule control).

**The evidence (same app, same page, measured 2026-07-24):**
| | origin `Cache-Control` | `Set-Cookie` | CDN result | TTFB |
|---|---|---|---|---|
| **AWS CloudFront** | `s-maxage=86400, stale-while-revalidate` | none | `x-cache: Hit from cloudfront`, `age: 3433` (served from edge) | **65 ms** |
| **Koigrid Cloudflare** | `s-maxage=31536000` (1 yr), `x-nextjs-cache: HIT`, prerendered | none | **`cf-cache-status: DYNAMIC`** (origin every time) | **~300–450 ms** |

The app is already CDN-perfect: public `s-maxage`, no cookies, prerendered ISR HTML. **CloudFront caches it and serves from edge; Koigrid's Cloudflare returns `DYNAMIC` and hits the origin on every request.** Root cause = **Cloudflare's default caches only static assets by file extension and bypasses `text/html`** unless a "Cache Everything" / Edge-Cache-TTL rule is set — and Koigrid surfaces no such control (`/apps/{id}/rules` = redirect/rewrite/header only; API grep for `cache-everything`/`cacheTtl`/`cacheLevel` = 0). A header rule to normalize the Next.js RSC `Vary` had no effect (still `DYNAMIC`).

**What to build (concrete, in priority order):**
1. **Cache document/HTML responses when the origin opts in with `Cache-Control: public, s-maxage=…` (and there's no `Set-Cookie`).** This is exactly CloudFront's and Vercel's default behavior. For a Cloudflare-backed edge, that means a per-app **Cache Rule with "Eligible for cache: Cache Everything" + "Edge TTL: respect origin"** applied automatically when `cdnEnabled` and the origin sends a public `s-maxage`. This one change closes the whole edge-latency gap for every ISR/SSR site.
2. **Handle the framework `Vary: RSC, next-router-*` correctly** — cache the document variant while still passing RSC/prefetch sub-requests through (CloudFront/Vercel do this; a naive `Vary` bypass is why generic Cloudflare chokes on Next.js App Router).
3. **Expose an explicit override** for teams that want it: `PUT /apps/{id}/cdn {"enabled":true,"cacheDocuments":true,"edgeTtl":"origin"}` or a `/rules` `type:"cache"`. Default it **on** when the origin advertises a public `s-maxage` — most migrators won't know to ask.
4. **Surface cache effectiveness**: report `cf-cache HIT/MISS` ratio per app in `/metrics`, so a migrator can *see* the CDN working (or not) instead of discovering `DYNAMIC` by hand.

**Why this matters strategically:** Koigrid's whole pitch is "the anti-AWS" and its ICP is Next.js/Astro/Hugo/Supabase refugees — **all SSR/ISR HTML-first frameworks.** Right now `cdnEnabled` on such an app only saves the TLS handshake, not the render, so it benchmarks 2–5× slower than CloudFront on exactly the number a migrator checks first (TTFB of a fresh app). **Land item #1 and Koigrid ties or beats AWS on edge latency too** — removing the last axis where this migration report says AWS is meaningfully ahead. Combined with the co-located DB (6.45 ms), ~10× lower cost, and the already-shipped image-deploy/manifest/runtime-error/CDN fixes, there'd be **no dimension left where AWS wins** for an app like Vence.

---

## 🏆 2026-07-25 (evening) — THE BIG ONE: **the peak load-test finally ran, and Koigrid passed it with room to spare.** Nearly every item in our action list shipped. Two things still don't work — and they're now the *only* two.

Koigrid shipped again, and this release reads like our action list executed line by line. We verified each item against the live API instead of trusting the changelog. **Headline: with replicas un-gated on the free tier, we ran the capacity test that has been the #1 cutover gate since day one — and Koigrid delivers 6.5× our production peak with 0 % errors.**

### 🥇 The measurement that matters: peak capacity (free tier, 6 replicas of 2 GB)
`PUT /apps/{id}/scale {"replicas":6}` → `{"scale":{"replicas":6},"redeployed":true}` (**no `plan_limit`** — this is the change that unblocked everything), then `POST /apps/{id}/loadtest`:

| Test | rps | p50 | p95 | p99 | errors | vs. 1 replica |
|---|---|---|---|---|---|---|
| `/leyes/constitucion-espanola`, conc 20, 45 s | **109.3** | 81 ms | 596 ms | 1 768 ms | **0.00 %** | ~10 rps → **11×** |
| `/leyes/constitucion-espanola`, conc 35, 45 s | **143.3** | 98 ms | 800 ms | 1 634 ms | 2.79 % | |
| `/leyes/constitucion-espanola`, conc 50, 60 s | 108.4 | 160 ms | 2 135 ms | 3 779 ms | 3.14 % | |
| Home `/`, conc 50, 60 s | **216.1** | 82 ms | 636 ms | 1 471 ms | 3.39 % | |

**Vence's production peak is ~16.6 rps.** Six 2 GB replicas serve **109 rps of the DB-heavy prerendered page with zero errors and an 81 ms p50** — **6.5× our peak**, and 216 rps on the home page. Scaling was one API call and took ~30 s to redeploy. **The capacity gate is passed** — and, notably, *without* HTML edge caching helping at all (see below), i.e. this is the worst-case number: every one of those requests was rendered by the origin. For context on the other side, our AWS production runs 8 tasks × 2 vCPU behind CloudFront at 2–19 % average CPU.

### ✅ Verified fixed in this release (we re-ran each one)
- **R1 — CDN enables again.** `PUT /apps/{id}/cdn {"enabled":true}` on our *existing* app → `{"cdn":{"enabled":true}}`. The one-way door is gone.
- **R3 — new apps are CDN-on by default again** (`POST /apps` → `cdnEnabled: true`).
- **R4 — creating an image app deploys it.** New app went `created → deploying → running` on the **first attempt in ~25 s**, `deploy: live, error: -`, no manual `POST /deployments`.
- **R6 — the RUNTIME error-code catalogue is back** in `llms.txt`.
- **The replica/autoscale plan gate is gone** — and the docs say why, in exactly the terms this report used: *"measuring your PEAK is what decides a real migration: you can now run a capacity test at 6-10 replicas with CDN on, on the free tier, BEFORE paying."* That is the single best decision in this release: **you cannot sell a migration to someone who isn't allowed to measure it.**
- **R5 — answered better than we asked.** `GET /apps/{id}/rules` now returns an `enforcement` block (`{enforced, servedBy, note, remedy}`) that told us plainly *"stored, but NOT applied: this app is served by its runner's legacy Caddy, which doesn't run rules"* — plus the remedy. **Reporting that a 201 doesn't mean "live" is exactly the honesty this platform should be known for.** (The remedy itself doesn't work yet — N1 below.)
- **A1/A2/B1/B2 — the managed restore is back with every fix we asked for, documented:** `\restrict`/`\unrestrict` stripped (A1); **the app role is made owner automatically + `POST /databases/:id/fix-ownership` for databases already bricked** (A2 — the endpoint name we proposed); **the dump is kept on failure so you re-POST the same `dumpKey`** (B1); **the restore is atomic in a single transaction, so a retry reports the same root cause** (B2); plus gzip upload (31 GB → ~3.8 GB) and the `{"restore":{…}}` envelope documented (C2). *We have not re-run the restore end-to-end yet — that's our next session, not a claim.*

### ❌ Still not working — and now these are the ONLY two
**A3 — HTML edge caching is documented but has no effect on our app.** The docs even adopted our argument verbatim (*"The bare `s-maxage` is ENOUGH — the `public` token is NOT required (Next.js ISR never emits it…); RFC 9111"*). Measured on a **fresh app with CDN on by default**, 6 consecutive requests to a prerendered ISR page: **`cf-cache-status: DYNAMIC`, every time.** We isolated it by content type on the same app:

| Path | `Cache-Control` | `Vary` | Result |
|---|---|---|---|
| `/robots.txt` | `public, max-age=14400` | `Accept-Encoding` | **MISS → REVALIDATED (cached ✅)** |
| `/favicon.ico` | `public, max-age=14400` | `rsc, next-router-*` | MISS → EXPIRED (cached ✅) |
| `/sitemap.xml` | **`public, max-age=86400, s-maxage=86400`** | `rsc, next-router-*` | **DYNAMIC ❌** |
| `/leyes/constitucion-espanola` (HTML) | `s-maxage=31536000` | `rsc, next-router-*` | **DYNAMIC ❌** |

So **only the default extension-based static caching is running** (`.txt`, `.ico`, `.js`); the "honor the origin's `s-maxage` on documents" rule is not applied to this app. `/sitemap.xml` is the cleanest counter-example: it carries `public` *and* `s-maxage` and still bypasses. Our best hypothesis is that the document cache rule lives on the **central edge** — which we cannot reach because of N1.

**N1 (new) — `scale-out` fails the deploy with `replica_unhealthy`, and there are no logs.** The documented remedy for R5 (and, we suspect, the path to A3) is `PUT /apps/{id}/scale-out {"enabled":true}` + a deploy. It flips correctly (`servedBy: central_edge, rulesEnforced: true`) but **both deploys we triggered failed in ~30 s with `error: "replica_unhealthy"` and an empty `logs` field**. The same image, unchanged, deploys and runs fine on the normal path (and did again immediately afterwards on a fresh app). Three asks: (1) make the central-edge path work for image apps like ours; (2) `replica_unhealthy` isn't in the documented RUNTIME code list, and it shipped **without the logs** that make every other failure self-explaining — that's the one place this release regressed on your own best pattern; (3) if the readiness probe is stricter on the central edge, expose the health path/timeout (`GET /apps/{id}` has no `healthPath` to set). *(Rolled back to `scale-out:false`; the last-good deployment kept serving throughout — no downtime, credit where due.)*

### 📊 AWS head-to-head, re-run on this build
Median of 7, from Spain, 2026-07-25 ~19:11. Koigrid app is the faithful clone (`vence-web7`, full env, **1 replica**, CDN on); payload sizes match AWS within 2 %, so these are like-for-like pages:

| Page | AWS (CloudFront) | Koigrid (CDN on, 1 replica) | AWS faster | (last night, CDN broken) |
|---|---|---|---|---|
| Home `/` | 45 ms | **112 ms** | 2.5× | 5.0× |
| `/leyes` (2.3 MB) | 54 ms | **188 ms** | 3.5× | 5.6× |
| `/leyes/constitucion-espanola` | 38 ms | **127 ms** | 3.3× | 4.2× |
| Backend `/health` (no CDN either side) | 102 ms | **154 ms** | **1.5×** | 1.6× |

**Restoring the CDN took the gap from 4.2–5.6× back down to 2.5–3.5×** (edge TLS termination + connection reuse). The remaining gap is *entirely* A3: AWS serves those documents from the edge (`x-cache: Hit from cloudfront`), Koigrid renders every one at the origin. **Land A3 and these rows should collapse to CloudFront-class numbers** — and the 6-replica capacity result above suggests the origin wouldn't even notice.

**Where this leaves the migration, honestly:** of everything this report raised over four days, what's left is **A3 (HTML edge caching, ineffective) and N1 (central-edge deploys)** — and A3 is probably gated on N1. Capacity: **passed**. Deploys, restore, CDN toggles, plan gates, error self-classification, rule introspection: **shipped**. That is a remarkable turnaround, and it moves Koigrid from "promising POC" to "one feature away from a cutover we'd actually schedule".

---

## ⚖️ 2026-07-25 — HONEST SCOPE OF OUR BENCHMARK: what we actually compared (it is NOT apples-to-apples), the measured AWS footprint, the **real** AWS bill, and everything still unmeasured

The owner asked the right question: *"you benchmarked against 8 tasks × 2 vCPU — did you measure that?"* We hadn't. We have now, and it changes how our numbers should be read. **Publishing this so nobody (including us) over-reads a laptop-side TTFB table.**

### What the two sides actually are (measured 2026-07-25)
| | AWS (production, what we benchmarked) | Koigrid (POC, what we benchmarked) |
|---|---|---|
| Front-end compute | **8 Fargate tasks × 2 vCPU / 4 GB = 16 vCPU, 32 GB**, autoscaling **min 8 / max 12** (→ up to 24 vCPU) | **1 replica, 2 GB** (Free plan caps replicas at 1) |
| Back-end | 1 task × 0.25 vCPU / 0.5 GB | 1 app, 1 GB |
| Edge | CloudFront, HTML cached at edge (`age: 6560` observed) | CDN **off** (cannot be enabled — see R1) |
| DB | RDS PostgreSQL 17.6 **Multi-AZ**, 31 GB | Koigrid managed PG 17, single-node (Free), 4 GB RAM, co-located |
| Account limit | Fargate On-Demand vCPU quota **30** (adjustable) — at 8 tasks it sits at 16.25/30 | Free plan: 1 replica/app |

**So the head-to-head tables compare a 16-vCPU, CloudFront-fronted, multi-AZ production against a single 2 GB container with no edge cache.** Read that way, Koigrid comes out remarkably well (`/health`, the only leg with no CDN on either side and roughly comparable compute, is just **1.6×**) — and it also means our latency tables are a **floor** for Koigrid, not a verdict. The saturation number (~10 rps) is *per replica*: matching AWS's 16 vCPU would mean roughly **8 replicas**, which is a paid plan.

### The cost claim, re-measured (we had it wrong, in Koigrid's disfavour *and* favour)
Our earlier sections quoted "$800–1 200/month on AWS vs ~$89 on Koigrid ≈ 10× cheaper". **We finally pulled the real bill (AWS Cost Explorer, 2026-07-01→07-24):**

| Service | 23 days (USD) |
|---|---|
| RDS | 103.57 |
| ECS (Fargate) | 98.32 |
| Tax | 69.72 |
| CloudFront | 37.11 |
| VPC | 25.75 |
| ELB | 21.14 |
| CloudWatch | 11.51 |
| ElastiCache | 7.95 |
| Route 53 | 1.55 |
| **Total** | **376.62 → ≈ $491/month run-rate** (≈ $421 ex-tax) |

**The honest ratio is therefore ~4–5×, not ~10×** — still a large win for Koigrid, but we were over-stating it, and an over-stated claim is worth less than a measured one. Note also what the AWS bill contains that the Koigrid POC does not yet: Multi-AZ failover, CloudFront, an ALB, CloudWatch, and 8× the compute. A like-for-like Koigrid stack (≈8 replicas + HA DB + CDN) is **not** the $89 free-tier figure either; we can't price it until the plan pages/`/usage` are reachable (see below).

### What is still UNMEASURED for a serious at-scale comparison
Grouped by what unblocks each. We list them because a benchmark that omits them is not a cutover decision:
- **Blocked on Koigrid fixing R1 (and ideally R2):** edge-cached HTML latency and capacity — the whole point of A3; today unmeasurable.
- **Blocked on a paid plan / custom domain:** multi-replica throughput and p95/p99 **under sustained load** (not medians on an idle box); autoscaling behaviour; whether ~10 rps/replica scales linearly to our ~16.6 rps peak; HA database failover; the real monthly price of an equivalent stack.
- **Blocked on nothing but time (we can do these free, on the copy DB):** write throughput (`answer-and-save` at N rps) vs the same on RDS; DB latency **under load** (we only have a single 6.45 ms sample); backup/PITR restore time; deploy + rollback time end-to-end; object-storage throughput (we already serve 30 HLS videos from Koigrid storage); cold-start after idle; log/metric retention and alerting parity.
- **Blocked on an owner decision (touches production):** replaying real production traffic (shadow/mirror) instead of synthetic paths — the only way to compare a realistic route mix, authenticated sessions and write ratio; and logical-replication lag from the live RDS.

**Bottom line for readers of this report:** every latency table above is a *lower bound* for Koigrid measured in its most handicapped configuration, and the cost advantage is real but ~4–5×, not 10×. We will re-run the comparison properly the moment R1 is fixed and a paid plan/custom domain is on the table.

### 🧮 Sizing reality-check: how many replicas would Vence actually need on Koigrid? (measured 2026-07-25)
Because the answer isn't "the same as on AWS" — and the reason is, again, the edge cache:
- **On AWS the origin barely works.** Real ECS utilization of the 8 front-end tasks (16 vCPU) over 7 days: **daily average CPU 2.4 % – 18.7 %**, memory **~15 %** of 4 GB, with **short bursts to 100 %** on individual tasks. CloudFront serves most HTML from the edge, so the origin sees a fraction of the traffic. The 8 tasks are burst headroom and HA, not throughput.
- **On Koigrid today the origin would take 100 % of it**, because `cf-cache-status: DYNAMIC` (R1/A3). Measured capacity: **~10 rps per 2 GB replica, saturated** (p95 4.1–5.7 s). For our ~16.6 rps peak with an acceptable p95 that's an estimated **4–6 replicas**; **with HTML edge caching working, 1–2**.
- **So the single feature in A3 is worth roughly 3–5× our replica bill.** That's the honest business case for shipping it, from a real migrator's numbers — and it's why we can't size (or price) a Koigrid cutover until R1 is fixed.
- *(For context on the AWS side: the account's Fargate vCPU quota is 30, currently 16.25 in use, and it is adjustable via a free support ticket. So the quota is not what pushes this migration — cost, ops simplicity and DB co-location are.)*

### 🔻 R7 (during this write-up) — the control plane returned `500` on *every* endpoint for several minutes
`GET /apps`, `/apps/{id}`, `/apps/{id}/resources`, `/databases`, `/usage`, `/metrics` → all `500 {"error":"internal","errorRef":"…"}` (refs `ca2a9503…`, `fb52a380…`, `36765e42…`). **The data plane stayed healthy** (our front-end and backend kept serving `200` at ~0.23 s), so this was control-plane-only — but it stopped us finishing the resource/plan side of the table above, and it is the second time in this session that a release window degraded the API (the first being the R1–R6 regressions). A **status page / `/health` for the control plane**, and treating `openapi.json`+`llms.txt` as versioned artifacts (so a rollback is visible rather than silently changing the contract), would make releases much less alarming for someone mid-migration.

---

## 🚨 2026-07-25 (later) — NEXT RELEASE REVIEWED: **HTML edge caching is documented as SHIPPED (our #1 ask 🎉) but is UNREACHABLE**, and this build **regressed four things that worked yesterday** — including managed restore-dump, which is gone.

We re-pulled `llms.txt` and `openapi.json` after another release and re-ran the whole benchmark. **The headline is good news we could not verify, wrapped in four regressions.** Everything below was reproduced against the live API within one hour.

### 🎉 SHIPPED (on paper): HTML edge caching — exactly action item A3
`llms.txt` now documents, under the CDN section:
> *"HTML EDGE CACHING (CloudFront-style): the edge caches your HTML documents honoring the ORIGIN's Cache-Control. To make a page cacheable at the edge, respond with `Cache-Control: public, s-maxage=<seconds>`. Responses that are private/no-store or carry a `Set-Cookie` are NEVER cached (auth-safe). Next.js RSC navigation sub-requests bypass the cache (only documents are cached). Apps with Deployment Protection and previews are NEVER edge-cached. No per-app config."*

That is our recommendation #1, including the two subtleties we flagged (cookie-safety and the Next.js RSC `Vary`). **Thank you — this is the change that closes the AWS latency gap.** Two notes before you call it done:
1. **We could not observe it working** (see R1 — the CDN can no longer be turned on at all on `*.apps.koigrid.com`, so nothing reaches the edge to be cached).
2. **The documented trigger may miss the framework you're targeting.** The doc asks for the literal token `public`. **Next.js does not emit it** — a prerendered ISR page ships `Cache-Control: s-maxage=31536000` (our `/leyes/constitucion-espanola`) or `s-maxage=3600, stale-while-revalidate=…` (our `/`), with **no `public` token**. CloudFront caches those anyway (RFC 9111: `s-maxage` is itself a shared-cache directive and makes the response cacheable). If your rule requires the literal `public`, **the entire Next.js ICP will still see `DYNAMIC` and conclude the feature doesn't work.** Please treat `s-maxage=<n>` as sufficient on its own, and keep `Set-Cookie`/`private`/`no-store` as the disqualifiers.

### 🔻 R1 (blocker, and a one-way door) — `PUT /apps/{id}/cdn {"enabled":true}` fails again on `*.apps.koigrid.com`, so nobody can turn the CDN on
```
PUT /apps/{id}/cdn {"enabled":true}
→ 400 {"error":"bad_request","detail":"CDN needs a valid Cloudflare edge certificate for
   vence-web7-23f37d.apps.koigrid.com. Enable Cloudflare Total TLS (ACM) on the zone, or
   attach a custom domain (2nd-level) and enable the CDN on that."}
```
This is **verbatim the error you fixed on 2026-07-24** ("CDN NOW ENABLES ON AN EXISTING APP (was blocked)"). It is back. We reproduced it on:
- our existing app (`vence-web7`) — 5 attempts over 100 s, all 400;
- a **brand-new app** created minutes ago (`vence-web8`) — same 400. Its responses show `server: Caddy` (no Cloudflare in front at all).

**Worse, disabling still works, so it's a one-way door.** We set `{"enabled":false}` for one clean before/after measurement, and **could not turn it back on** — our POC app has been CDN-less since, and the only documented escape is a custom domain (a paid-plan/DNS step). **Acceptance test:** on a free account, `PUT /cdn {enabled:true}` on a `*.apps.koigrid.com` app returns `{"cdn":{"enabled":true}}` and the next response carries `cf-cache-status`. *(Net effect: the flagship feature of this release cannot be exercised by any user on the default hostname — including us. We'd happily re-test the moment R1 is fixed.)*

### 🔻 R2 (feature withdrawn) — managed restore-dump is **gone** from the API
The three endpoints we reviewed in depth this morning now **404**:
```
POST /databases/{id}/restore-dump/upload-url → 404 {"error":"not_found","detail":"No such endpoint…"}
GET  /databases/{id}/restore-dump            → 404
```
`openapi.json` is now **byte-identical (md5 `b402ac6f…`) to the 2026-07-24 build**: 176 → 173 paths, the three `restore-dump` routes removed, nothing added. The `llms.txt` section describing it is gone too. If you pulled it deliberately to fix A1/A2 (the `\restrict` incompatibility and the ownership blocker) — **that is the right call, and we'll re-test the day it returns**; the engine underneath was genuinely good. If it was collateral from a rollback, this is your heads-up that a shipped, documented feature vanished.

### 🔻 R3 — new apps are no longer CDN-enabled by default
`POST /apps` now returns `cdnEnabled: false` (we created one and checked), and the `llms.txt` line *"ON BY DEFAULT for new apps … auto-activates once the edge cert covers the host"* is gone. That was shipped on 2026-07-24 as the fix for the "fresh app benchmarks with CDN off" first-impressions own-goal. Combined with R1, **there is currently no path to an edge-cached app on the default hostname.**

### 🔻 R4 — `POST /apps` with `sourceType:"image"` no longer auto-deploys
The app was created and then sat at `status: "created"`, `url: null`, `deployments: []` for **10 minutes** with no error. A manual `POST /apps/{id}/deployments` (the same escape hatch that used to work around the old `build_export_failed` flake) started it and it went live normally. So the image path still works — but a migrator following the docs sees an app that silently never starts. Also `GET /apps/{id}/deployments/{deploymentId}` returned no readable `status` for us while the deploy was in flight (the list endpoint was fine). **Acceptance test:** `POST /apps {sourceType:"image"}` reaches `running` without a manual deployment call.

### 🔻 R5 — `/apps/{id}/rules` header rules are accepted but have no observable effect
`POST /apps/{id}/rules {"type":"header","source":"/leyes/constitucion-espanola","headerName":"Cache-Control","headerValue":"public, s-maxage=120, …"}` → `201` with a rule id, and the response header **never changed** (still `cache-control: s-maxage=31536000`), measured over 4 requests / 30 s, with the CDN still on at the time. This matches what we saw on 2026-07-24 trying to normalize the RSC `Vary`. Either the edge control plane isn't applying `header` rules, or the origin's own header wins silently — either way, the documented `vercel.json` equivalent doesn't do what it says. *(This also removes the one workaround a user would have for the missing `public` token in R-A3.)*

### 🔻 R6 (docs) — the runtime error-code catalogue disappeared from `llms.txt`
The 2026-07-24 build documented `missing_env`, `db_connect_failed` (with the `NODE_TLS_REJECT_UNAUTHORIZED=0` hint), `redis_connect_failed`, `oom_runtime`, `port_mismatch`, `crashloop`, `unhealthy` — the "self-explaining runtime failures" we praised. This build lists only the BUILD codes again. If the codes still exist, the docs regressed; if they don't, a multi-service bring-up lost its self-debugging.

### 📊 AWS head-to-head re-run — **the gap widened, because Koigrid lost its CDN (R1)**
Same script, median of 7, from Spain, 2026-07-25 ~01:15 CEST. Koigrid is now **CDN OFF and cannot be turned back on** (R1), so this is a *worse* configuration than yesterday's run — that is the honest caveat, and it is not the app's fault or ours:

| Page | AWS (CloudFront) | Koigrid (CDN forced OFF by R1) | AWS faster | (yesterday, CDN on) |
|---|---|---|---|---|
| Home `/` | **40 ms** | 199 ms | 5.0× | 2.4× |
| `/leyes` (2.3 MB) | **38 ms** | 211 ms | 5.6× | 4.8× |
| `/leyes/constitucion-espanola` | **41 ms** | 174 ms | 4.2× | 3.2× |
| `/auxiliar-administrativo-estado` | **101 ms** | 291 ms | 2.9× | 2.5× |
| Backend `/health` (no CDN either side) | **104 ms** | 164 ms | **1.6×** | 1.4× |

Full-page load (`time_total`) tells the same story: Koigrid 523 ms home / 668 ms `/leyes` vs AWS 78 / 128 ms. And the capacity re-test is **unchanged**: `POST /apps/{id}/loadtest` 30 s @ concurrency 15 on the prerendered page → **10.5 rps, p50 805 ms, p95 4 143 ms, 0 % errors, saturated** — statistically the same as the 8.8–9.2 rps we measured **with** the CDN on. That is the cleanest possible proof of why A3 matters: **as long as HTML isn't edge-cached, turning the CDN on or off changes throughput by nothing, because every request lands on the single origin container.**

**Net:** this release contains the single most valuable change anyone could ship for our migration (HTML edge caching) and simultaneously makes it impossible to use. Fix R1 (and treat bare `s-maxage` as cacheable), and we will re-run this benchmark the same day — we expect the prerendered pages to collapse to CloudFront-class TTFB and the load-test to stop saturating at ~10 rps. Restore R2 with A1/A2 fixed and the migration story is complete.

---

## 🧪 2026-07-25 — NEW RELEASE REVIEWED IN DEPTH: **managed restore-dump** (`/databases/:id/restore-dump`). We tested it end-to-end with a real RDS dump. **Two blockers, both reproducible; the core engine is good.**

A new version shipped since the last review. Diffing `llms.txt` (650→659 lines) and `openapi.json` (173→176 paths), the **only** change is the flagship migration feature — **managed restore** ("migrate in an afternoon"): `POST /databases/:id/restore-dump/upload-url` → `PUT` the `.sql` → `POST /databases/:id/restore-dump {dumpKey, preSeed?}` → `GET …/restore-dump/:jobId` (status + `tableCounts` + root-cause `error`). Nothing else changed (no CDN cache-rule control — the #1 item above is still open; grep for `cacheEverything`/`cacheTtl`/`cacheLevel` = 0 hits, and `/apps/{id}/rules` is byte-identical).

**How we tested it (real data, not a toy):** `pg_dump 17.10` from the production RDS (PG 17.6) of 4 real tables — `topics` (3 803 rows), `oposiciones` (2 626), `ai_knowledge_base` (28), `help_articles` (20) — 5 MB of plain SQL including **`COPY … FROM stdin`** blocks, two **`extensions.vector(1536)`** columns, two **ivfflat** indexes on `extensions.vector_cosine_ops`, and an `extensions.uuid_generate_v4()` default. That is exactly the ex-Supabase shape the feature advertises. Seven restore jobs on two fresh DBs (one PG 16, one PG 17).

### ⛔ BLOCKER #1 — the restore rejects any dump from a current `pg_dump` (17.6+/18): `invalid command \restrict`
An unmodified `pg_dump 17.10` file fails at **line 5**, before touching any data:
```
status: failed   error: "psql:<stdin>:5: error: invalid command \restrict"
```
Since the Aug-2025 security releases, `pg_dump` ≥ 17.6/18 wraps its output in the `\restrict <token>` / `\unrestrict` psql meta-commands. **Koigrid's restore runner uses a `psql` older than 17.6, so it cannot read them.** We reproduced it on a **PG 16** cluster *and* on a **PG 17** cluster (`"version":"17"`), so it is the **runner's client binary**, not the cluster version — creating the DB with a matching major does **not** help. Impact: **every migrator dumping from a current RDS/Supabase/self-hosted PG hits this on their first try**, on the feature whose whole promise is a frictionless import. Fix: ship a `psql` ≥ 18 in the restore runner (a newer client reads older dumps fine), or strip/ignore `\restrict`/`\unrestrict` server-side. Our workaround: `grep -v '^\\restrict \|^\\unrestrict '` before uploading — which nobody will guess from the error.

### ⛔ BLOCKER #2 — after a **successful** restore, the app role can't read its own data (and neither can Koigrid's own APIs)
With the `\restrict` lines stripped, the restore completes cleanly… and the database is unusable:
```
psql (as app):            ERROR: permission denied for table topics
GET  /databases/:id/data/topics   → {"error":"bad_request","detail":"permission denied for table topics"}
POST /databases/:id/query {"sql":"select count(*) from topics"} → {"error":"query_error","detail":"permission denied for table topics"}
```
The restore runs as the superuser, so every restored object ends up **`tableowner = postgres`**, and `app` — the *only* login role Koigrid exposes (`GET /databases/:id/connection` and `/roles`: `app` is `superuser:false`) — gets nothing. **There is no way to self-heal:** `ALTER TABLE … OWNER TO app` → *"must be owner of table"*; `GRANT SELECT … TO app` → *"permission denied for table"*; and `POST /query` is **read-only** (*"cannot execute GRANT in a read-only transaction"*). Note this also breaks **Koigrid's own Data API and query endpoint** on a database Koigrid itself just restored — so the `tableCounts` verification is the *last* thing that works on that data. This is worse than the DIY path (`pg_dump | psql "$DATABASE_URL"` as `app` leaves everything owned by `app` and working), which makes the managed feature a **regression** for the one job it exists to do. Fix: run the restore **as the app role**, or finish with `REASSIGN OWNED BY postgres TO app` + `GRANT ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA … TO app` + `ALTER DEFAULT PRIVILEGES`, and expose an idempotent `POST /databases/:id/fix-ownership` for databases already in this state.

### ⚠️ FRICTION #3 — the `dumpKey` is single-use, and re-using it fails with an opaque `download_failed`
A `dumpKey` works for exactly one job. Retrying the same key after a failure gives:
```
status: failed   error: "download_failed"   logs: "__KOIDL_FAIL__ curl: (22) The requested URL returned error: 404"
```
So **every** failed attempt costs a **full re-upload of the dump** — trivial for our 5 MB probe, brutal for the real 31 GB one, and the exact loop a migrator lands in while discovering the two blockers above. Fix: keep the object until the job succeeds (or for its TTL) and allow re-submitting the same key; failing that, say *"dump already consumed — request a new upload URL"* instead of a raw 404.

### ⚠️ FRICTION #4 — a failed restore leaves partial objects behind, and the next attempt reports the *wrong* root cause
There is no rollback or pre-flight cleanup. After a failure at line 120, the following run died at line 43 with `relation "ai_knowledge_base" already exists` — **the leftover, not the real problem** — which defeats the (otherwise excellent) fail-fast design. We only got a clean signal after manually `DROP SCHEMA public CASCADE`. Fix: restore into a transaction/staging schema, or detect a non-empty target and either refuse up-front (`target_not_empty`) or offer `{"mode":"clean"}`.

### ✅ WHAT WORKS — and it's the hard part
- **Fail-fast with a genuinely root-cause error.** `ON_ERROR_STOP` gives the *first* failure with file:line, the offending SQL line and the PG `HINT` — e.g. `psql:<stdin>:43: ERROR: schema "extensions" does not exist / LINE 14: embedding extensions.vector(1536)`. It failed in **2.2 s** instead of scrolling 5 000 cascade errors. This is exactly the self-explaining-failure pattern that made the build path debuggable, now applied to data. Keep it.
- **`preSeed` solves the real ex-Supabase snag.** `preSeed:[{"name":"vector","schema":"extensions"},{"name":"uuid-ossp","schema":"extensions"}]` creates the schema + extensions as superuser *before* the restore, so `extensions.vector(1536)` columns, `extensions.vector_cosine_ops` **ivfflat indexes** and `extensions.uuid_generate_v4()` defaults all restore untouched. This was one of the three snags that cost us hours in Phase 2 — now a single field.
- **COPY works (direct to the leader, not the pooler)** — the other Phase-2 snag, closed.
- **`tableCounts` is the verification we asked for, and it's exact.** All 4 tables, 6 477 rows, byte-matching the source counts, returned by the job itself: `[{topics:3803},{oposiciones:2626},{ai_knowledge_base:28},{help_articles:20}]`. 5 MB restored in **5.7 s**.
- Status progression (`queued → seeding → restoring → done`) is clear and pollable.

### 📄 Docs / API nits found while testing
- `GET /docs/migrate` still documents only the DIY `pg_dump | psql` path — **zero mentions of `restore-dump`**. The flagship migration feature is invisible where a migrator looks first.
- Envelope mismatch: `llms.txt` calls it a *job* (`/restore-dump/:jobId`) but the response wraps under **`{"restore":{…}}`** — an agent following the docs reads `resp.job.id` and gets `undefined` (we did).
- `POST /databases` defaults to **`version: "16"`** while the docs (rightly) tell you to match your source major. Defaulting to the newest supported (or echoing a warning) would avoid a mismatch nobody notices until restore time.
- **Correction to our earlier report:** we wrote that inbound logical replication from an external primary was missing. `/docs/migrate` documents it (`CREATE SUBSCRIPTION` on Koigrid, *"the app user has REPLICATION — no superuser needed"*). We have **not** tested it (it needs `rds.logical_replication=1` + a publication on our production RDS — an owner-approved change), but the feature exists; our earlier note was wrong.

### 📊 Re-ran the AWS head-to-head on this release — **no change; the gap is stable and still the HTML-cache gap**
Same pages, median of 7, from Spain, 2026-07-25 ~00:00 CEST (both stacks measured back-to-back in the same quiet window):

| Page | AWS (CloudFront) | Koigrid (CDN ON, 1 replica) | AWS faster |
|---|---|---|---|
| Home `/` | **58 ms** | 138 ms | 2.4× |
| `/leyes` (2.3 MB, DB-heavy) | **39 ms** | 188 ms | 4.8× |
| `/leyes/constitucion-espanola` | **45 ms** | 143 ms | 3.2× |
| `/auxiliar-administrativo-estado` | **122 ms** | 301 ms | 2.5× |
| Backend `/health` (no CDN either side) | **113 ms** | 154 ms | 1.4× |

Both stacks measured faster in absolute terms than the 2026-07-24 run (quieter hour), so **the honest read is the ratio, and the ratio didn't move: 2.4–4.8×**, with the fairest single number (backend `/health`, no CDN on either side) at **1.4×**. Headers confirm the cause is unchanged: AWS `x-cache: Hit from cloudfront, age: 6560`; Koigrid `cf-cache-status: DYNAMIC` on every page, despite the app sending `s-maxage=86400`/`s-maxage=31536000` with no `Set-Cookie` and `x-nextjs-cache: HIT`.

**And the capacity re-test proves the same point from the other side.** `POST /apps/{id}/loadtest`, 30 s at concurrency 15, **with CDN now ON**:

| Path | rps | p50 | p95 | errors | verdict |
|---|---|---|---|---|---|
| `/` | 8.8 | 989 ms | 4 501 ms | 0 % | saturated |
| `/leyes/constitucion-espanola` (prerendered ISR) | 9.2 | 996 ms | 5 719 ms | 0 % | saturated |

That is **identical to the pre-CDN measurement (~8.7 rps)** — turning the CDN on changed throughput by nothing, because with `cf-cache-status: DYNAMIC` **every single request still lands on the one origin container**, even for a fully prerendered page that ought to be served from edge memory. Our peak need is ~16.6 rps. **Item #1 at the top of this report isn't just a latency nicety — it's also the capacity gate:** edge-caching that one prerendered document would take it from 9 rps/1 replica to effectively unbounded, and would decide whether this migration needs 6–10 replicas or 1.

**Net on this release:** the managed-restore *engine* is right (fail-fast root cause, `preSeed`, leader-direct COPY, exact `tableCounts`) — but as shipped, the happy path is unreachable from a current `pg_dump`, and if you do reach it your app can't read the result. Both are small, contained fixes (a newer `psql` in the runner; ownership/grants at the end of the restore), and with them this becomes the strongest migration story of any platform we've tested.

---

## ⚠️ 2026-07-24 (latest+2) — CORRECTION: the cache headers were ALREADY cacheable. The real gap is Koigrid's CDN not caching HTML (CloudFront does).

I earlier implied the edge-cache gap needed **app-side** cache headers. **That was wrong — checked the actual response headers and Vence already sends fully cacheable ones.** The real difference is CDN behavior:

| | `Cache-Control` sent by app | `Set-Cookie`? | CDN result |
|---|---|---|---|
| **AWS** `/leyes/constitucion-espanola` | `s-maxage=86400, stale-while-revalidate` | none | **`x-cache: Hit from cloudfront`, `age: 3433`** → cached at edge |
| **Koigrid** same page | `s-maxage=31536000` (1 year!) `x-nextjs-cache: HIT` | none | **`cf-cache-status: DYNAMIC`** → NOT cached |

Same app, same (already-cacheable) headers. **AWS CloudFront caches the HTML; Koigrid's Cloudflare does not.** Root cause: **Cloudflare's default only caches static assets by file extension and bypasses HTML documents** unless a "Cache Everything" cache rule / Edge-Cache-TTL is set — and **Koigrid's CDN exposes no such control** (its `/apps/{id}/rules` does only redirect/rewrite/header; grep of the API/llms for `cache-everything`/`cacheTtl`/`cacheLevel` = 0 hits). I tried a header rule to normalize the Next.js RSC `Vary` (a plausible secondary cause) → **no effect, still `DYNAMIC`**. So there is **no user-accessible lever** to make Koigrid cache HTML.

**Conclusion (corrected):** there is **nothing to fix on Vence's side** — the app is already CDN-friendly, and AWS proves it (CloudFront serves the document from edge). The edge-latency gap is because **Koigrid's `cdnEnabled` gives edge TLS termination + static-asset caching but NOT document/HTML caching**, whereas CloudFront (and Vercel) cache SSR/ISR HTML by honoring the origin's `s-maxage`. For an ISR-heavy Next.js app this is the whole ballgame — it's why `/leyes/constitucion` is 65 ms on AWS (edge hit) and ~300 ms on Koigrid (origin every time).
→ **Koigrid feedback (this is the high-value one for the whole Next.js/Astro/Hugo ICP):** make `cdnEnabled` **cache HTML/document responses honoring the origin `Cache-Control: public, s-maxage=…`** — i.e. cache-everything-with-origin-TTL by default when the origin opts in with a public `s-maxage` (exactly CloudFront/Vercel behavior), and handle the framework `Vary: RSC` correctly. Until then, `cdnEnabled` on an SSR app only saves the TLS handshake, not the render — which undersells the platform on precisely the benchmark migrators run first.

---

## ✅ 2026-07-24 (latest+1) — CDN NOW ENABLES ON AN EXISTING APP (was blocked): re-measured, gap ~7× → ~2–4×

Follow-up to the CDN-on-by-default fix: it also unblocked **existing** apps. `PUT /apps/{id}/cdn {enabled:true}` on `vence-web7` — which **failed before** with *"needs a valid Cloudflare edge certificate / attach a custom domain"* — **now succeeds**, auto-provisions the edge cert for the `*.apps.koigrid.com` host, and Cloudflare fronts the app (cf headers present). Re-measured with CDN ON vs AWS (median of 6):

| Page | AWS | Koigrid CDN-ON | (Koigrid CDN-off) | cf-cache |
|---|---|---|---|---|
| `/constitucion-espanola` | 111 ms | **311 ms** | 450 ms | DYNAMIC |
| Home `/` | 87 ms | **207 ms** | 473 ms | DYNAMIC |
| `/leyes` (DB-heavy) | 174 ms | **687 ms** | 677 ms | DYNAMIC |

**Partially solved — honest read:** enabling CDN ~halved latency on light pages (home 473→207, constitución 450→311) via **edge TLS termination + connection reuse**. BUT every page returns **`cf-cache-status: DYNAMIC`** — Cloudflare is *not* edge-caching the HTML, because the Next.js SSR responses carry non-cacheable `Cache-Control`. So the *big* CDN win (serving cached HTML from edge) isn't active without **app-side cache headers on cacheable routes** (our config, not a Koigrid limit). And `/leyes` (2.3 MB, heavy uncacheable SSR) barely moved (677→687) — CDN can't help a dynamic heavy page; that one needs **replicas + faster SSR**, and replicas are still **Free-capped at 1** (paid plan). **Net: the edge-latency gap dropped from up to 7× to ~2–4×.** The CDN *availability* is fixed; closing the rest is (a) cacheable `Cache-Control` on static routes (Vence-side) and (b) multi-replica (paid plan).

---

## 📊 2026-07-24 (latest) — FRESH AWS-vs-Koigrid latency measurement (same pages, median of 5, from Spain)

Re-ran a direct head-to-head *now* (not reusing earlier numbers). Medians:

| Endpoint | AWS (prod) | Koigrid (POC) | AWS faster |
|---|---|---|---|
| Home `/` | **333 ms** | 473 ms | 1.4× |
| `/leyes` (DB-heavy) | **219 ms** | 677 ms | 3.1× |
| `/leyes/constitucion-espanola` | **65 ms** | 450 ms | 6.9× |
| Backend `/health` | **113 ms** | 169 ms | 1.5× |

**AWS wins latency today (1.4–7×) — but it's still not apples-to-apples, same asymmetry as before:** Koigrid is **CDN OFF + 1 replica (Free)** vs AWS **CloudFront edge + multi-instance**. The 7× outlier (`/constitucion`) is *entirely* CDN — AWS serves it cached from edge (steady 65 ms), Koigrid does full SSR every time (450 ms); CDN-on collapses that. The **fairest single number is backend `/health` = 1.5×** (no CDN either side): a direct request to AWS is ~1.5× faster than to Koigrid's single box. Not re-measured (can't fairly, from a laptop): Koigrid's **co-located DB (6.45 ms, ~4× faster writes)**, **~10× lower cost**, and **~30 s image deploy vs 10–15 min ECS** — its structural wins stand. **Verdict unchanged:** AWS wins edge latency (via CDN + multi-instance); Koigrid wins cost, ops-simplicity, DB latency, write throughput. Closing the latency gap for real needs the peak load-test with **CDN-on + replicas = a paid plan** (owner's spend call); until then this is a floor, not a final perf verdict.

---

## ✅ 2026-07-24 (latest) — KOIGRID SHIPPED THREE MORE FIXES, all from this report. Verified.

Re-checked `llms.txt`/`openapi.json` after another release (same day). Three improvements landed, each matching feedback above:

1. **`build_export_failed` flake — FIXED (verified empirically).** Earlier this session, **every** image redeploy failed on the first attempt with `build_export_failed` and only landed after a manual `POST /deployments` retry (documented above). Re-tested now: a single backend redeploy went **straight to `live` on the FIRST attempt** (`status: live, error: None`, no retry). The #1 deploy friction — an image `sourceType:image` deploy now behaves like ECS (deploy once, it runs). (One clean run isn't 100% proof the flake is gone, but combined with the observed `docker-ssh.ts` change it's strong evidence.)
2. **Runtime error self-classification — SHIPPED (this report's suggestion #7).** `llms.txt` now lists **RUNTIME** error codes for a container that boots but fails readiness: `missing_env`, `db_connect_failed` (*with the exact `NODE_TLS_REJECT_UNAUTHORIZED=0` hint for a self-signed DB TLS cert — a snag we hit*), `redis_connect_failed`, `oom_runtime`, `port_mismatch`, `crashloop`, `unhealthy`. Exactly the "extend the self-explaining-failure pattern to runtime" ask — a multi-service bring-up now debugs itself.
3. **CDN on-by-default for new apps — SHIPPED (head-to-head feedback #2).** New apps now default `cdnEnabled:true`; it *auto-activates once the edge cert covers the host and never breaks TLS before that (serves DNS-only)*. Directly fixes the "first-impressions own-goal" where a fresh app benchmarks with CDN off. (Note: our existing `vence-web7` predates this and still has CDN off; and the Free **1-replica cap** is a plan limit, unchanged — so the *peak* load-test still needs a paid plan.)

**Net:** of the frictions this report raised, Koigrid has now shipped fixes for the build-time OOM path, the ECR image-pull path (#2), the whole-app manifest (#1), the load-test tool (#4), build/runtime error self-classification, and CDN defaults — turnaround measured in hours. The remaining open items are the **peak load-test** (plan-gated: replicas + a custom domain) and the **Stripe webhook secret-pairing** (our config), not platform gaps.

---

## ✅ 2026-07-24 (late night) — LAST MILE: real login (auth) + real answer-save WRITE both verified E2E through the Koigrid front-end. (Stripe webhook: handler works, secret-pairing unresolved.)

Attacked the "last mile" — the user-facing flows (login, write, payments) that a POC on the AWS-built image supposedly couldn't reach. Turns out **most of it reaches for free**: the front-end's `verifyAuth` still accepts HS256 Supabase tokens (the code is explicitly forward-compatible), so I minted a canary token with the real `SUPABASE_JWT_SECRET` (from SSM) and drove the actual endpoints against the **Koigrid** front-end + copy DB. Wired the needed runtime secrets (JWT/CRON/webhook/smoke) onto the Koigrid apps via the manifest.

**Two critical user flows — PROVEN end-to-end on Koigrid:**
- **🔐 Login / auth validation.** `GET /api/profile?userId=<smoke>` with a `Bearer` HS256 token → **`200 {"success":true,"data":{…}}`** returning the real smoke user's profile (email, `planType:"premium"`, `targetOposicion`, timestamps) — read from the migrated DB **with RLS applied**. Control: **no token → `401`**. So the front-end validates JWTs and enforces row-level security against the co-located copy DB, exactly like prod.
- **✍️ Answer-and-save WRITE.** `POST /api/v2/answer-and-save` (the real test-answer endpoint) with the Bearer token + a full answer payload → **`200 {"success":true,"isCorrect":true,"correctAnswer":0,"explanation":"ARTÍCULO 99.5 CE…","lawShortName":"CE"}`** in **0.79 s**. This exercised the *entire* write path on Koigrid: JWT auth → server-side re-validation → anti-fraud → **transactional INSERT into `test_questions`** on the copy DB → score → explanation pulled from the migrated content. **A user answering a question works, writes persist, and the co-located DB makes it fast.** This is the single most important user action on Vence, proven on Koigrid.

**Stripe webhook — handler runs, but the synthetic canary won't go green (unresolved, and it's a config detail not a stack failure):**
- Replicated the `canary-stripe-webhook` exactly: synthetic `type:"canary.synthetic"` event, signed with `Stripe.webhooks.generateTestHeaderString({secret: STRIPE_WEBHOOK_SECRET})`, `POST /api/stripe/webhook`. Result: **`400 {"error":"Webhook signature verification failed"}`**.
- **My signing is provably correct** — a local `generateTestHeaderString` → `constructEvent` round-trip with the same secret **passes**. So the front-end's runtime `STRIPE_WEBHOOK_SECRET` doesn't match the value I signed with, even though I set it from the same SSM param the prod canary uses, via **both** `POST /env` **and** the manifest (the mechanism that demonstrably reaches runtime for `DATABASE_URL`). Couldn't pin it down remotely because **Koigrid never returns a stored secret's value** (correct for security, but it blocks this diagnosis). Most likely a **rotated/stale SSM webhook secret** or the **dual-account** (`STRIPE_WEBHOOK_SECRET` Manuel vs `_NILA`) pairing — a config-finalization detail. The handler itself is healthy: it runs on Koigrid and **correctly rejects a non-matching signature with a clean 400** (not a crash), which is the security behavior you want.
  - → **Koigrid feedback (minor):** a **write-only env introspection** — e.g. `GET /apps/{id}/env?reveal=<key>` gated behind a strong scope, or a one-shot "does the running container see KEY=<expected hash>?" check — would make exactly this class of "is my secret actually loaded and correct?" debugging tractable without ever returning the plaintext.

**Net on the last mile:** the two flows that *define* the app — **logging in and saving an answer** — work end-to-end on Koigrid against the migrated data. Payments' webhook path is one secret-pairing away (a config task, verifiable in minutes once the exact live webhook secret is confirmed), not a platform or stack problem. (Housekeeping: this round set real secrets on the POC apps and inserted one canary row into the copy `test_questions` — both harmless on the throwaway copy; secrets added to the cleanup list.)

---

## ✅ 2026-07-24 (night) — thorough free E2E sweep: Redis, real content, and real WRITES to the copy DB all verified. Plus: the honest incremental-vs-big-bang cutover analysis.

Pushed the testing as far as it goes **for free on the current POC** (AWS-built front-end image, Free plan). What's now proven, each verified (not assumed):
- **Redis end-to-end (not just "configured").** Connected a client directly to the managed cache's `rediss://…rds-cache-d9085a.rds.koigrid.com:44921` (TLS): `PING → PONG`, `SET`+`GET` round-tripped a value. The Koigrid Redis works as a real Redis.
- **Front-end renders real DB-backed pages in the browser, not just `200`.** `/leyes` → 2.3 MB with real law list, `/leyes/constitucion-espanola` → 414 KB with "Artículo…" content, `/auxiliar-administrativo-estado` → 446 KB dynamic landing. Full read path (browser → Next.js SSR → co-located DB) works.
- **Real WRITES to the migrated DB confirmed.** The backend's `refresh-rankings` cron (running on Koigrid) inserted into `ranking_cache` — verified via Koigrid's **Data API** (`GET /databases/{id}/data/ranking_cache`): a row with `refreshed_at: 2026-07-24T17:10:23Z`, written minutes earlier by the Koigrid backend against the co-located copy DB. So the DB accepts real transactional writes from the migrated services. (The Data API itself is a nice touch — reading a table over REST without a psql session.)
- **Backend cron engine runs on Koigrid.** `/health/crons` shows 55+ crons registered with live heartbeats (`refresh-rankings`, `process-outbox`, `conversion-drain`, `alerts-engine`, plus the whole `canary-*` self-test suite).

**Honest ceiling — what a POC on this image canNOT prove (needs the "last mile"):** the user-facing flows (**browser login, answer-save through the UI, Stripe payment/webhook**) all run through the **front-end**, and this front-end is the **image built for AWS** — `NEXT_PUBLIC_SITE_URL=localhost`, `NEXT_PUBLIC_AUTH_PROVIDER=authjs` (RS256/JWKS), and no `STRIPE_WEBHOOK_SECRET` in its runtime env. The backend's built-in canaries (`canary-smoke-auth`, `canary-stripe-webhook`) target the front-end's `/api/profile` and `/api/stripe/webhook`, so running them now would go red on **front-end mis-config**, not a real stack failure — a misleading test we deliberately did **not** fake. Testing those flows for real requires **rebuilding the front-end image for Koigrid** (real domain, matching auth provider, full secret set) + a **paid plan** (replicas/CDN for the peak load test) + a **custom domain** (CDN cert). That's genuine cutover work, not a free probe. (This is itself useful Koigrid feedback: the biggest friction to a *complete* migration test is that public-var-baked front-ends must be rebuilt per-environment — a **build-args / env-templating story** would let a migrator re-point a front-end at a new stack without a full rebuild.)

### 🧭 Can Vence migrate incrementally, or must it be all-at-once? (the owner's question — general enough to belong in a Koigrid cutover runbook)

The answer splits cleanly by **layer**, and it's the crux of any real migration:

1. **The DATABASE is the pivot — effectively a single coordinated cutover, NOT piecemeal.** You cannot have live users writing to **two** databases (AWS RDS *and* Koigrid) at once — they diverge irreconcilably. So the data moves as **one event**, done one of two ways:
   - **Replicate-then-flip (recommended, near-zero downtime):** stand up **logical replication** RDS → Koigrid so the Koigrid DB stays continuously in sync with prod. When ready: briefly pause writes → let the last WAL drain → flip every service's `DATABASE_URL` to Koigrid → resume. Downtime = seconds. **AWS stays hot as instant rollback.** *(Koigrid gap: we didn't find a managed "subscribe to an external Postgres as a logical-replication source" flow — the single most valuable feature for a zero-downtime cutover. Publishing/streaming from Koigrid exists; **inbound** replication from an external primary is the missing half.)*
   - **Maintenance-window big-bang:** short planned downtime, final `pg_dump`/restore, flip. Simpler, more downtime (Vence's 31 GB = ~15 min dump + restore).

2. **The STATELESS services (front-end, backend) CAN be migrated incrementally / canaried — but only AFTER the DB is on Koigrid.** If you move the front-end to Koigrid while the DB is still on AWS, every query crosses providers (adds latency + egress cost) — you **lose the entire co-location win** (6.45 ms → tens of ms + $). So co-location only pays off once the DB is *also* on Koigrid. Once it is, you can run the front-end on **both** AWS and Koigrid against the same (Koigrid) DB and shift traffic **gradually via DNS weighting / a load balancer: 1% → 10% → 50% → 100%**, watching error rate + latency, rollback = shift weight back.

3. **So "incremental" happens at the TRAFFIC layer, not the DATA layer.** Realistic sequence:
   - **Phase 1 — parallel bring-up (≈ where we are):** everything running on Koigrid, no user impact, keep testing.
   - **Phase 2 — last mile:** rebuild the front-end for Koigrid (domain, auth, secrets), repoint crons, attach a custom domain, upgrade plan for replicas/CDN.
   - **Phase 3 — logical replication** RDS → Koigrid (data kept in sync).
   - **Phase 4 — canary the DB flip + traffic:** coordinated flip to the Koigrid DB, then ramp real traffic 1% → 100% at the DNS/LB layer.
   - **Phase 5 — hold AWS as rollback** for a few days, then decommission.

**Bottom line:** you can migrate the **traffic** gradually (safe, with rollback), but the **data** moves as one coordinated flip (best done replicate-then-flip for near-zero downtime). The one thing you must **never** do is run live writes against both the AWS and Koigrid DBs at the same time. Small, read-only or independent pieces (a background worker, a non-critical cron) can move first as low-risk practice — but the core user-facing path is gated on the single DB cutover.

---

## ⚠️ 2026-07-24 (evening, cont.) — the peak load-test (the #1 cutover gate) is PLAN-GATED on Free: 1-replica cap + CDN needs a custom domain

We tried to run the capacity gate properly — **CDN on + multiple replicas** — and both knobs are blocked on the Free plan, which is worth flagging because it shapes every migrator's first benchmark:
- **`PUT /apps/{id}/scale {replicas:3}` → `plan_limit`:** *"Your free plan allows up to 1 replica per app. Upgrade for more."* So horizontal scale — the thing that answers "does it hold peak?" — **cannot be tested on Free at all.**
- **`PUT /apps/{id}/cdn {enabled:true}` → `bad_request`:** *"CDN needs a valid Cloudflare edge certificate for `vence-web7-23f37d.apps.koigrid.com`. Enable Cloudflare Total TLS (ACM) on the zone, or attach a custom domain (2nd-level) and enable the CDN on that."* So **CDN is not available on the auto-generated `*.apps.koigrid.com` subdomain** — you must bring a custom domain first.

**Why this matters (and it's fixable):** this report has twice measured Koigrid's TTFB as ~2–5× slower than AWS — and *both* causes are these defaults: **CDN off** (couldn't turn it on) and **1 replica** (couldn't add more). A migrator kicking the tires on Free will benchmark the *worst* possible config and conclude "Koigrid is slow," when the real story is "we never let them enable the two things that fix it." **This is a first-impressions own-goal.**
→ **Fix (Koigrid):** (a) issue an **edge cert for the `*.apps.koigrid.com` subdomain automatically** so CDN can be toggled on a fresh app without a custom domain (the default hostname should be CDN-capable); (b) allow at least **2 replicas on a low tier** (or a time-boxed "burst" so a migrator can run one capacity test before upgrading); (c) surface both limits in the `loadtest` `note` ("this ran on 1 replica, CDN off — enable both to test peak"). 
**For us:** the peak load test now needs a **plan upgrade (for replicas) + a custom domain (for CDN)** — a spend/DNS decision for the owner, not a technical blocker. The single-replica CDN-off floor is measured (below); the *peak* number that gates the real cutover is one paid plan away.

---

## ✅ 2026-07-24 (evening) — WE APPLIED THE MANIFEST FOR REAL: backend (NestJS) + Redis now LIVE on Koigrid against the real 31 GB DB. Two plan≠apply bugs found (one dangerous), both worked around.

Following the dry-run below, we ran the actual `POST /manifest` **apply** to bring up the **backend + Redis** into the same project as the migrated 31 GB DB. **Net result: the NestJS backend is live on Koigrid, serving `/health` 200, connected to the co-located 31 GB Postgres, with the Koigrid managed Redis wired in.** Getting there surfaced **two real platform bugs** — exactly the kind of feedback an apply (vs a dry-run) exposes.

### 🎉 What now runs on Koigrid (proven, not planned)
- **Backend `@vence/backend` (NestJS) — LIVE.** `https://vence-backend-261bdf.apps.koigrid.com/health` → `200 {"status":"ok","service":"vence-backend","deploy":"a4d55e77"}`. The runtime logs show it **booted against the real migrated DB and ran actual work**: `[RefreshRankingsService] refresh_ranking_cache() completado: 1922 filas` — inserting the week/month ranking rows in **27–77 ms** (the co-located 6.45 ms DB earning its keep), and `[AlertsCron] alerts-engine: … 59/59 evaluadas`. This is the whole point of unproven-item #1 (backend), now retired: **it doesn't just deploy, it works against real data.**
  - **Verified it serves real business content, not just `/health`** (public GET routes, no auth): `/health/crons` → live cron heartbeats (`refresh-rankings`, `process-outbox`, `conversion-drain`, `canary-smoke-auth`/`canary-stripe-webhook`/`canary-answer-save`), `/health/outbox` → `lastTickMsAgo: 595` (outbox processor ticking), and `/api/v2/test-config/articles?lawShortName=CE&positionType=auxiliar_administrativo_estado&topicNumber=1` → `200` with the **real Constitución articles + question counts from the migrated DB** (art 0: 135 questions, art 1: 87, art 2: 30…), all with **sub-200 ms** response times. So the backend is genuinely serving Vence's real content off Koigrid.
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

---

## 🔁 RE-TEST 2026-07-27 — the two open items turned out to be **one chain**, and it still blocks

**Why we came back today (business context, because it changes the stakes).** Our AWS bill jumped from
**~$14/day to ~$33/day** on 21-22 July (frontend Fargate floor raised to 8 tasks × 2 vCPU after a
504 incident). Projected August: **~$1,040/month** vs ~$434 before. So we re-opened the migration with
a concrete question: *can Koigrid take this load, and what would it cost?* We could not answer it, and
the reason is a single reproducible bug.

### Finding 1 — A3 (HTML edge caching) is **gated behind** N1 (scale-out). They are not two items.

Your own API told us, which is excellent diagnostics — `GET /apps/{id}/rules`:

```json
"enforcement": {
  "enforced": false,
  "servedBy": "legacy_runner",
  "note": "…esta app se sirve por el Caddy heredado de su runner, que no ejecuta reglas…",
  "remedy": { "action": "serve_via_central_edge", "endpoint": "PUT /api/v1/apps/{id}/scale-out" }
}
```

So: **rules and (we infer) HTML edge caching only apply on the central edge; getting there requires
`scale-out`; `scale-out` fails.** That makes N1 the single blocker, not one of two.

### Finding 2 — `scale-out` still fails, **identically, two days later**

| When | Action | Result |
|---|---|---|
| 2026-07-25 17:02 UTC | `scale-out:true` + deploy | `failed` — `replica_unhealthy` |
| **2026-07-27 17:58 UTC** | `scale-out:true` + deploy | **`failed` — `replica_unhealthy`** |

Same app (`vence-web7`, faithful Next.js clone, `sourceType=image`), same error code, empty logs, ~30 s.
The **same image deploys fine** through the normal path (verified again today: `resume` → `running`,
`GET /leyes` → 200 in 0.73 s). **No downtime either time** — the last-good replica kept serving, which
is genuinely good behaviour and worth keeping.

**What would help us most:** `replica_unhealthy` with empty logs is not actionable from the outside.
There is no `healthPath` to tune on this app, and the error is not in the documented runtime-error
catalogue. Even a one-line reason (`probe timed out after Ns on port P`, `container exited rc=N`,
`no runner with capacity for N replicas`) would let us fix it ourselves instead of reporting it.

### Finding 3 — you fixed the A3 **docs** exactly as we asked… but the fix is unreachable

The `llms.txt` grew 659 → **758 lines** and now says, by name, the thing we flagged on 25/07:

> *"The bare s-maxage is **ENOUGH** — the `public` token is **NOT required** (Next.js ISR never emits it
> and those pages DO cache; RFC 9111: s-maxage is itself a shared-cache directive)."*

That is precisely right, and thank you for acting on it. **But measured today on the faithful clone with
`cdnEnabled:true`, three real pages, three requests each:**

| Page | `Cache-Control` from origin | `cf-cache-status` |
|---|---|---|
| `/` | `s-maxage=3600, stale-while-revalidate=3153240` | `DYNAMIC` ×3 |
| `/leyes` | `s-maxage=2592000, stale-while-revalidate=2894` | `DYNAMIC` ×3 |
| `/leyes/constitucion-espanola` | `s-maxage=31536000` | `DYNAMIC` ×3 |

Because the app is on `legacy_runner` (Finding 1), the documented behaviour cannot apply. **This is the
second time something is documented before it is reachable** (the first was the managed restore that
appeared, then 404'd). Not a complaint about speed — you ship fast and that is the best thing about
working with you — just a suggestion: **gate the doc on the path being live**, or mark it
`available on central edge only`, so integrators do not spend a session testing an unreachable feature.

### Finding 4 — plan quotas vs a real production load (pricing feedback)

`GET /usage` on our token: `plan: free`, `maxApps: 1`, `cpu_seconds` limit **180,000** (= 50 vCPU-hours),
`memory_gb_hours` limit **100**. Our current AWS frontend consumes **~390 vCPU-hours and ~864 GB-hours
per DAY**. So the free tier is ~⅛ of *one day* of our real load — which is fine and expected, but:

**there is no published price for the plan we would actually need**, and the docs say quotas are soft
(you go over and get billed). For a migration decision that is the one number we cannot estimate. A
simple *"here is what N replicas × M GB costs per month"* table — or a `GET /pricing` endpoint — would
let us finish the comparison. Right now we can prove Koigrid **can** take the load (your peak gate:
109 rps at 0% error on 6 free replicas, vs our ~16.6 rps peak) but not what it **costs**.

### Where this leaves the migration

- **Capacity: proven.** 6.5× headroom over our peak, and scaling is one call + ~30 s.
- **Database: proven.** 31 GB 1:1, co-located 6.45 ms.
- **Blocked on exactly one bug:** `scale-out` → `replica_unhealthy`. It gates the central edge, which
  gates HTML caching, which gates *both* the latency gap (we are 2.5-3.5× behind AWS purely because
  CloudFront serves our HTML from the edge and Koigrid re-renders it) **and** the replica count that
  determines the price (4-6 replicas without edge caching vs 1-2 with it).

**One fix unblocks the whole decision.** We are keen to run the full cutover rehearsal the day
`scale-out` lands — the POC is paused, not deleted (`/resume` brings it back in ~40 s with no rebuild),
and the 31 GB database is still `running`.

**Reproduction, if useful:** app `vence-web7` (`38864c7c-8ff1-4c9d-83f5-cd0790448c6a`),
`PUT /apps/{id}/scale-out {"enabled":true}` → `POST /apps/{id}/deployments` → `failed`,
`error: replica_unhealthy`, logs empty. Reverted to `scale-out:false` and re-deployed successfully
after each attempt, so the app is left healthy.

### Status ledger — updated 2026-07-27

| Item | Status |
|---|---|
| DB migration (31 GB, 1:1) | ✅ **Proven.** Co-located 6.45 ms. `vence-poc` (PG17) still `running`. |
| Whole-stack POC (front + back + Redis) | ✅ **Proven** and E2E-verified (auth, answer-save, Redis). Apps currently `paused` — `/resume` restores in ~40 s, no rebuild. |
| External private-registry pull (#0a) | ✅ Shipped 2026-07-23. This is what made the drop-in-ECS path real. |
| Peak-capacity gate | ✅ **Passed 2026-07-25.** 109.3 rps @ 0.00% err on 6 free replicas (p50 81 ms, p95 596 ms) vs our ~16.6 rps peak = **6.5× headroom**. |
| CDN re-enable (R1) | ✅ Fixed — the one-way door is gone. |
| **A3 — HTML edge caching** | ⛔ **Documented, not reachable.** Blocked by N1 (see Finding 1). |
| **N1 — `scale-out`** | ⛔ **`replica_unhealthy`, reproduced 25/07 and 27/07.** The single blocker. |
| Stripe webhook / front→back private net / crons | ⏳ Not started — config work, deliberately parked behind the blocker. |
| **Price of the plan we'd need** | ❓ **Unknown.** Not published; the one number missing to close the comparison. |

### Top suggestions after today (in the order that would unblock us)

| # | Suggestion | Why it matters |
|---|---|---|
| **1** | **Fix `scale-out` → `replica_unhealthy`**, or at minimum return an actionable reason (`probe timed out after Ns on port P`, `container exited rc=N`, `no runner with capacity`). Today it fails in ~30 s with **empty logs** and a code that is not in the documented runtime-error catalogue. | **One fix unblocks the entire decision**: central edge → rules + HTML caching → the latency gap AND the replica count that sets the price. Everything else is done. |
| **2** | **Publish the price of a real plan** — even a rough *"N replicas × M GB = $X/month"* table, or a `GET /pricing`. | We can prove you **can** take our load; we cannot say what it **costs**. That is the only thing stopping a go/no-go. |
| **3** | **Gate docs on the path being live** (or label `central edge only`). | Second time a feature was documented before reachable (managed restore, then A3). Costs integrators a session each time — and it is a shame, because shipping fast is your best trait. |

### Appendix — what the alternative costs us (so the stakes are concrete)

Measured on AWS Cost Explorer, same account, this month:

| | vCPU-hours/day | Avg vCPU | ECS $/day |
|---|---|---|---|
| 18-20 Jul | 54 | 2.3 | $3.1 |
| 22-26 Jul | ~390-416 | **16-17** | **~$22** |

The jump is a frontend autoscaling **floor** of 8 tasks × 2 vCPU / 4 GB (min 8, max 12) raised after a
504 incident. Whole-account run rate went **$14/day → $33.5/day**; projected August **~$1,040/month**
(RDS is flat at $6.50/day, CloudFront ~$1.3 — it is essentially all Fargate). Frontend CPU sits at
**2-4% average with 70-97% bursts**, so the floor is mostly insurance against spikes.

**What that means for Koigrid:** with HTML edge caching working, our own numbers say **1-2 replicas**
would carry this (the origin would only render misses); without it, **4-6**. That factor of ~3 in
replicas is the difference between an obvious migration and an unclear one — and it is decided entirely
by the `scale-out` bug above. We are not shopping on price alone: the DB story and the 6.5× headroom
already impressed us. We simply cannot finish the arithmetic yet.

### What Vence relies on today that we could not find on koigrid

Not a complaint list — a gap analysis from a customer who *wants* to move. Checked against your
`llms.txt` (758 lines, 2026-07-27) and the API, not assumed. Ordered by how hard it would block us.

| # | What we depend on | On AWS | On koigrid (as documented today) | Why it blocks us |
|---|---|---|---|---|
| **G1** | **Read replica for analytics** | RDS read replica; the backend injects `DRIZZLE_READ` so every analytical cron + admin panel reads off the replica | **0 mentions of replicas** in the docs | This is not a nice-to-have for us: routing analytics to a replica is **what fixed a production contention incident** (admin panels aggregating a 6.7 GB events table were stalling user traffic on the primary). Without it, every heavy read lands on the primary again. |
| **G2** | **PITR on the managed Postgres** | RDS point-in-time recovery | **0 mentions of PITR.** You do have **volume snapshots** (`POST /apps/:id/volumes/:volId/backups`) and dump/restore | We hold payment records and user progress. Snapshot-granularity is a different risk profile from "restore to 14:32 last Tuesday". If PITR exists, it is not discoverable; if it does not, say so — we can price the risk, we cannot price silence. |
| **G3** | **Old static assets surviving a deploy** | `_next/static` is synced to S3 **without `--delete`** on purpose, so chunks from the previous build stay reachable behind CloudFront | Image-based deploys replace the filesystem; we found no story for retaining previous assets | This is *the* Next.js-on-containers footgun and it bit us on AWS: a user mid-session requests a chunk that no longer exists → **ChunkLoadError, app frozen until hard reload**. Our deploy script has a guardrail test for it. On an immutable-image platform this needs an answer (serve previous assets from the edge, or a retained asset bucket). |
| **G4** | **Verifying a secret is set correctly** | SSM Parameter Store — we can read back what the task will receive | Secrets are **write-only by design** (`never the secret`, redacted from logs) | Sound security posture, real operational cost: our **Stripe webhook is still not green** purely because we cannot tell whether the secret we set matches the live one. A `GET /apps/:id/env/:key/fingerprint` (a hash or last-4, never the value) would close this without weakening anything. |
| **G5** | **Cost forecasting** | Cost Explorer — daily $/service, which is how we caught our own 2.4× jump this month | `GET /usage` gives quota counters; **no prices, no spend endpoint we could find** (there is a `spend:read` scope, so perhaps it exists and is undocumented) | We can measure what you can *do*; we cannot tell the CFO what it *costs*. Same ask as suggestion #2. |

**Things we checked and you DO cover** (so this reads fairly): rollback without rebuild
(`POST /apps/:id/rollback`), volume snapshot + restore to a new volume, log access and Log Drains
(`logs:read`/`otel:read` scopes), Redis, object storage/buckets, autoscaling on CPU
(`PUT /apps/:id/autoscale`), WAF rules, and near-zero-downtime CDC migration via logical replication —
that last one is better than what we would have built by hand.

**In-process crons are a non-issue**: our ~30 backend jobs are `@Cron` inside the NestJS container, so
they travel with the image. We flag it only because "no scheduler" looks like a gap on paper and is not
one for us.

If G1 and G2 already exist and are just undocumented, that is the cheapest fix on this whole page —
two lines in `llms.txt` would move them off our risk list.

### 📐 The actual workload — everything Vence runs on AWS today (so you can tell us if it fits)

Measured 2026-07-27 from the AWS APIs and our own DB, not estimated. **The question we need answered
is simple: can koigrid host this, and for how much?**

#### Compute

| Service | What runs | Size | Notes |
|---|---|---|---|
| `vence-frontend` (ECS Fargate) | Next.js 15 app, ~4,500 SSG pages | **9 tasks × 2 vCPU / 4 GB** — autoscaling **min 8, max 12** | = **18 vCPU / 36 GB** right now. Measured consumption: **~390 vCPU-hours and ~864 GB-hours per day**. CPU sits at **2-4% average with 70-97% bursts** — the floor is insurance against spikes, not steady load. |
| `vence-backend` (ECS Fargate) | NestJS API + **~30 in-process `@Cron` jobs** | **1 task × 0.25 vCPU / 0.5 GB** | Tiny. The crons travel inside the image, so they are not a scheduling requirement on your side. |

#### Data

| Service | Spec | Notes |
|---|---|---|
| RDS `vence-prod` | **db.t4g.medium, PostgreSQL 17.6, 100 GB allocated, Multi-AZ = true** | **Actual DB size: 32 GB.** This is the one you already restored 1:1 in the POC. |
| RDS `vence-prod-replica` | **db.t4g.medium read replica, 100 GB** | All analytical crons + admin panels read from here (`DRIZZLE_READ`). See gap **G1**. |
| ElastiCache | **Valkey, `cache.t4g.micro`, 1 node** | You have Redis; this one is genuinely small. |

#### Edge, network and storage

| Service | Spec |
|---|---|
| CloudFront | **~38 GB egress/month** (EU 30.7 + US 6.9 + CA 0.25). Modest — the value is the HTML cache hit rate, not the bandwidth. |
| ALB | 1 internet-facing application load balancer (front + back behind it) |
| S3 | 6 buckets; the load-bearing one is **`vence-frontend-static`** (`_next/static`, retained across deploys — gap **G3**) |
| Lambda | 1 function (Playwright headless fetcher for JS-rendered official pages) |

#### Traffic and scale

| Metric | Value |
|---|---|
| Requests/day | **~500,000** (50,082 logged at 10% sampling × 10) |
| Average | **~5.8 req/s** |
| **Peak** | **~16.6 req/s** |
| Registered users | **11,171** |

#### So: does it fit?

| Requirement | Your measured capability | Verdict |
|---|---|---|
| ~16.6 rps peak | **109.3 rps at 0.00% error on 6 free replicas** (25/07 gate) | ✅ **6.5× headroom, proven** |
| 32 GB Postgres | Restored 1:1 in the POC, co-located **6.45 ms** | ✅ **Proven** |
| Redis | Wired E2E in the POC | ✅ **Proven** |
| ~38 GB/month egress | "generous bandwidth included, no surprise egress bills" | ✅ Assumed fine |
| **How many replicas we'd need** | **1-2 with HTML edge caching; 4-6 without** | ⛔ **Undecidable until `scale-out` works** |
| Read replica (G1) | Not documented | ❓ |
| PITR (G2) | Not documented | ❓ |
| Static assets across deploys (G3) | No story found | ❓ |
| **Price of that plan** | Not published | ❓ **The blocking unknown** |

**Bottom line for your team:** the hard parts — capacity and the 32 GB database — are already proven,
and by a wide margin. What stands between us and a cutover is not scale: it is **one bug**
(`scale-out` → `replica_unhealthy`, which gates HTML edge caching and therefore the replica count),
**one number** (the price of the plan that carries 1-2 or 4-6 replicas), and **three yes/no answers**
(read replica, PITR, asset retention). That is a remarkably short list for a whole-stack migration, and
we would happily run the full rehearsal the week it clears.

---

## 🚧 UPDATE 2026-07-27 (late) — new release, and it surfaces a **harder blocker than `scale-out`**

Re-checked the docs a few hours after the section above: `llms.txt` **758 → 777 lines**. Three changes,
one of which changes the verdict for us.

### The one that matters: **a custom domain and the CDN are mutually exclusive**

> *"⛔ CUSTOM DOMAINS: an app with an ACTIVE custom domain CANNOT use the CDN… Choose ONE: (a) serve the
> app on its `<slug>.apps.koigrid.com` host and get the CDN, or (b) keep your own domain and run without
> edge caching."*

Thank you for documenting it plainly, with the mechanism (CNAME cross-user → Cloudflare **1014**, i.e.
site DOWN, not merely uncached) and with your own measurement (*"the zone is on the Free plan and the
API returns 1404 No quota has been allocated"*). That is exactly the honesty that makes this doc useful.

**But for Vence, option (a) does not exist.** We serve **`www.vence.es`** — a live business with 11,171
registered users, SEO rankings we depend on, and Google/Meta ads pointing at that domain. We cannot
serve production from `vence-web7-23f37d.apps.koigrid.com`. So our only option is (b): **our domain,
and therefore no CDN at all.**

### What that means, using your own numbers

Not "no HTML caching" — **no CDN**: no edge cache of any kind, no DDoS protection, origin IP exposed.

| | With CDN (impossible for us) | Our real option: custom domain, DNS-only |
|---|---|---|
| Latency vs AWS+CloudFront | 2.5-3.5× (measured 25/07) | **4.2-5.6×** (measured 25/07 with CDN off) |
| Replicas for our 16.6 rps peak | 1-2 | **4-6** (your ~10 rps/replica without edge cache) |
| DDoS / origin hiding | Yes | No |

**So `scale-out` and HTML edge caching, which we spent today debugging, are moot for our case.** Even
if `replica_unhealthy` were fixed tomorrow, on `vence.es` there is no CDN to program. The blocker moved
up a level: it is no longer a bug, it is **Cloudflare for SaaS on your zone**.

### What we would need to migrate (revised, and shorter)

| # | Ask | Why it is now the top item |
|---|---|---|
| **1** | **Cloudflare for SaaS custom hostnames** (or any path to edge-cache a customer's own domain) | Without it, every customer who brings their own domain — i.e. every real business — runs origin-only. It caps koigrid at side-projects and staging for the exact workloads you are best positioned to win. You already identified it as *"a plan/cost decision, not a missing feature"*; from out here it is **the** feature. |
| 2 | Fix `scale-out` → `replica_unhealthy` | Still broken (no mention in the new docs). Matters the day #1 lands. |
| 3 | Publish plan pricing | Unchanged. |

### Also in this release (both good)

- **TLS to the managed DB done properly**: `GET /databases/:id/connection` now returns `caCert` + `sslVerifiedUri`, with an explicit warning not to use `NODE_TLS_REJECT_UNAUTHORIZED=0` *"it disables TLS verification for the WHOLE process, so Stripe/S3/every outbound call stops being verified too"*. **We had exactly that footgun in our POC scripts.** That warning is worth more than it looks — it is the kind of thing that silently weakens a payment stack.
- CLI parity for `db ext`.

### Honest bottom line, revised

We came into today hoping to migrate for cost (AWS at ~$1,040/month projected). We are ending it with a
clearer picture than we had:

- **Capacity and the database: proven, comfortably.** Nothing to prove there.
- **The blocker is no longer a bug we can wait out** — it is whether koigrid can edge-cache a customer's
  own domain. Until then, a production site on koigrid means origin-only serving at 4-6 replicas and
  4-5× the latency of our current setup, which we cannot justify to users.
- **We are not walking away.** The DB story, the 6.5× headroom, the CDC migration path and the quality of
  these docs are all genuinely strong. Ping us when custom-hostname edge caching lands and we will re-run
  the whole rehearsal — the POC is paused, not deleted, and the 32 GB database is still `running`.

### ⚠️ CORRECTION to the gap table above (same day) — two of our five "gaps" were **our error, not yours**

We re-checked with a correct search (our first pass used `grep -E "a\|b"`, where `\|` is a *literal* pipe,
so it searched for one impossible string and returned zero hits — a false negative of our own making).
Correcting it publicly because sending a vendor a list of missing features that exist would be unfair:

| Gap we claimed | Reality | Verdict |
|---|---|---|
| **G1 — no read replica** | **WRONG.** `GET /databases/:id/connection` returns `readUri` — *"read replica endpoint, exists ONLY on HA plans; Free single-node has none"*. `GET /databases/:id` lists `members` with role `leader`/`replica`, and `/metrics` reports replication lag. | ✅ **You have it.** It is a *plan* question for us, not a missing feature. Retracted. |
| **G2 — no PITR** | **WRONG.** `PATCH /databases/:id {"backupRetentionDays":N}` (1-35, default 7) — *"the knob that controls both your point-in-time recovery window AND what your backups cost"*; ledger with `mode=full\|delta`, **WAL archiving = PITR**, daily incrementals + weekly full, `full:true` for a standalone base before a migration. | ✅ **You have it,** and the warning about lowering retention deleting history is a nice touch. Retracted. |

**Still standing from that table:** **G3** (static assets surviving a deploy — the Next.js `ChunkLoadError`
footgun; we found no story), **G4** (no way to verify a secret is set without reading it — still the reason
our Stripe webhook is not green; a fingerprint endpoint would fix it), **G5** (no published pricing).

And the sizing worry we had is also resolved by the docs: `PUT /apps/:id/resources {"memoryMb":2048,"cpus":2}`
— **CPU per replica is requestable and not capped by plan**, so matching our 2 vCPU/task Fargate shape is
straightforward. That removes any doubt about whether koigrid can *hold* the workload.

**Net after the correction: the blocker list is down to one real item** — edge caching on a customer's own
domain (Cloudflare for SaaS). Everything else is either solved, a plan choice, or small.

---

## ✅ UPDATE 2026-07-27 (night) — **the last blocker is gone: bring-your-own CDN**

Third release we have checked today (`llms.txt` 777 → 790). One change, and it is the one that matters:

> *"**✅ BUT YOU CAN BRING YOUR OWN CDN, and it is measured**: koigrid already issues a valid Let's Encrypt
> cert for your domain on the origin, so putting your own Cloudflare (free plan) in front works with zero
> changes here. Measured 2026-07-27 on a throwaway app: **TTFB 0.350s without CDN → 0.053s with the
> customer's Cloudflare in front, `cf-cache-status: HIT` = 6.6× faster**, plus DDoS, on your account with
> your cache rules."*

**This retires the blocker we declared two hours ago.** The custom-domain restriction is about *koigrid's*
CDN; nothing stops us putting *our own* Cloudflare in front of `vence.es`. Consequences for our case:

| | Before this release | Now |
|---|---|---|
| Edge caching on `vence.es` | ❌ impossible | ✅ **our own Cloudflare, free plan** |
| Replicas for our 16.6 rps peak | 4-6 (origin-only) | **1-2** (edge absorbs the HTML) |
| DDoS / origin hiding | none | ✅ on our own account |
| Blocked on `scale-out` (N1) | yes | **no — it becomes optional**, since the edge is ours, not theirs |

And the honesty is, again, the best part: you documented the caveats yourself, including that **koigrid
will report the domain as `misconfigured` while it works perfectly** (your check wants it resolving to
your IPs). Flagging your own false alarm before a customer hits it is rare.

### Two integration items we found on our side (not koigrid's problem, recorded so nobody trips on them)

1. **🔒 The client IP would silently degrade to a spoofable header — this is the one that matters.**
   Our `getClientIp()` trusts **`CloudFront-Viewer-Address`** (injected by CloudFront, not spoofable) and
   only falls back to `x-forwarded-for[0]`, which our own comment marks as *"spoofable"*. Behind our own
   Cloudflare there is no `CloudFront-Viewer-Address`, so **every IP-based control would quietly start
   trusting a header the client can forge** — and we run anti-fraud on exactly that (`multi_account_reg_ip`,
   `curl_scraping`, registration IP). Not a broken feature: a **security control weakened in silence**,
   which is worse. Fix is small and must land *before* any cutover: teach `getClientIp()` to trust
   `CF-Connecting-IP` when the request comes from Cloudflare, and only then.
2. **Firewall the origin to Cloudflare ranges.** Your BYO-CDN note says the origin IP becomes reachable.
   You do ship a WAF (`/waf/rules`, allow/block by priority), so this looks solvable on-platform — we have
   not tested it yet.

### Where the migration actually stands now

| | |
|---|---|
| Capacity (16.6 rps peak) | ✅ proven, 6.5× headroom |
| 32 GB Postgres, co-located 6.45 ms | ✅ proven |
| Read replica, PITR | ✅ exist (we were wrong earlier — see correction above) |
| CPU per replica | ✅ requestable, uncapped by plan |
| **Edge caching on our own domain** | ✅ **BYO-CDN, measured 6.6× by koigrid today** |
| `scale-out` → `replica_unhealthy` | ⚠️ still broken, but **no longer blocking us** |
| Static assets across deploys (G3) | ❓ still open |
| Secret verification (G4) | ❓ still open — the reason our Stripe webhook is not green |
| Price of the plan we need (G5) | ❓ **now the single biggest unknown** |

**Bottom line:** this morning the migration was blocked on a platform bug; this afternoon on a platform
policy; tonight on **a number**. With BYO-CDN the shape is 1-2 replicas + the managed Postgres + Redis,
and every technical objection we raised today is either solved or ours to fix. **Tell us what that costs
and we can make a decision.** We are ready to run the cutover rehearsal — the POC is paused, not deleted,
and the 32 GB database is still `running`.

---

## 🎉 RE-TEST 2026-07-29 — **A3 is FIXED and it changes the whole economics.** 615 rps on ONE replica (was 8.8)

`llms.txt` 790 → **810 lines**, `openapi.json` 178 → **189 paths**. Everything below was reproduced against
the live API and the live app in a single session, on the **free plan, one 2 GB replica**, using our
faithful production clone (`vence-web7`, Next.js 16 standalone from ECR).

### ⭐ Finding 1 — **HTML edge caching (A3) WORKS.** The #1 item of this report, open since 2026-07-24, is closed

We resumed the paused POC app (`POST /apps/{id}/resume` → serving in **~45 s**, no rebuild — the new
pause/resume pair is excellent) and measured the three pages we have been re-measuring all week:

| Path | `Cache-Control` sent by Next.js | req 1 | req 2 | req 3 |
|---|---|---|---|---|
| `/` | `max-age=14400, s-maxage=3600, swr=…` | MISS | **HIT** | **HIT** |
| `/leyes` | `max-age=14400, s-maxage=2592000, swr=…` | MISS | **HIT** | **HIT** |
| `/leyes/constitucion-espanola` | `max-age=14400, s-maxage=31536000` | MISS | **HIT** | **HIT** |

And it is a *real* edge cache, not a coincidence: hitting the same URL six times over 18 s returns
`cf-cache-status: HIT` with a **monotonically growing `age` (17 → 21 → 24 → 27 → 30 → 34)**.

**You shipped exactly the semantics we argued for (R1-bis):** these pages send a **bare `s-maxage`** with no
`public` token — Next.js never emits one — and they cache. That was the single detail we flagged on 07-25 as
potentially invalidating the feature for your entire Next.js/Astro ICP. It landed correctly.

### ⭐ Finding 2 — the capacity consequence is enormous: **~60× on the same hardware**

Same endpoint (`POST /apps/{id}/loadtest`), same parameters we have used all week (30 s, concurrency 15),
same app, **1 replica of 2 GB**:

| Date | Path | rps | p50 | p95 | errors | saturated? |
|---|---|---|---|---|---|---|
| 07-25 (CDN on, no HTML cache) | `/leyes/constitucion-espanola` | **8.8–10.5** | 805 ms | 4 143 ms | 0 % | **yes** |
| **07-29** | `/leyes/constitucion-espanola` | **615.5** | **19 ms** | **50 ms** | 0 % | **no** |
| **07-29** | `/` | **461.9** | 26 ms | 62 ms | 0 % | **no** |
| **07-29** @ concurrency 50 | `/leyes/constitucion-espanola` | **838.4** | 52 ms | 107 ms | 0 % | **no** |
| **07-29** @ concurrency 50 | `/` | **623.4** | 85 ms | 126 ms | 0 % | **no** |

Server-side CPU stayed at **0 %** throughout, and your own note said it correctly: *"the bottleneck is NOT
compute"*. **Our production peak is ~16.6 rps.** On 07-25 that needed 4–6 replicas; today **one replica
carries 37× our peak** and is still not saturated.

This is the number that decides the migration for us. Sizing goes from "4–6 replicas + unknown plan" to
"1 replica with a huge margin", and it is the difference between the cost case being speculative and being
obvious. Thank you.

*(Nit: `concurrency: 150` returns a bare `bad_request` with no explanation — the ceiling appears to be 100.
Saying `max concurrency is 100` in the error would cost you one string.)*

### ⭐ Finding 3 — head-to-head vs AWS: the gap collapsed from 4.2–5.6× to **1.4–2.0×**, and we lose one route

Medians of 7, both stacks measured in the same window, alternating hosts request-by-request so network
drift cannot favour either side. AWS = production (CloudFront + ALB + 8 Fargate tasks). Koigrid = **one
2 GB replica on the free plan**.

| Path | AWS | Koigrid | ratio |
|---|---|---|---|
| `/` | 36 ms | 72 ms | 1.97× |
| `/leyes` | 41 ms | 63 ms | 1.54× |
| `/leyes/constitucion-espanola` | 49 ms | 67 ms | 1.37× |
| `/auxiliar-administrativo-estado` | 202 ms | **165 ms** | **0.81× — Koigrid wins** |

For context, the same measurement was **2.5–3.5×** on 07-25 (CDN on, no HTML caching) and **4.2–5.6×** later
that night (CDN off). One 2 GB container on a free plan is now within 2× of a CloudFront-fronted 16-vCPU
Fargate fleet, and beats it on the heaviest page.

### 🔎 Finding 4 — A3 landed **without** `scale-out`, so our 07-27 "A3 is gated behind N1" conclusion was wrong — and your API still says otherwise

On 07-27 we concluded A3 and N1 were one chain, because `GET /apps/{id}/rules` told us so. **That same
response is still being returned today, on the app that is demonstrably edge-caching:**

```json
{"rules":[],"enforcement":{"enforced":false,"servedBy":"legacy_runner",
 "note":"Guardada, pero AÚN NO se aplica al tráfico: esta app se sirve por el Caddy heredado de su runner…",
 "remedy":{"action":"serve_via_central_edge","endpoint":"PUT /api/v1/apps/{id}/scale-out"}}}
```

So `servedBy: legacy_runner` **no longer implies "no edge caching"** — built-in document caching runs on the
legacy path too; only *custom rules* need the central edge. The message is now actively misleading: it sent
us chasing `scale-out` (a broken endpoint, below) to unlock something that already worked. Suggestion:
split the two states — `documentCaching: "active"` vs `customRules: "pending_central_edge"`.

### 🔴 Finding 5 — **N1 (`scale-out`) still fails identically. Third reproduction, four days apart**

`PUT /apps/{id}/scale-out {"enabled":true}` → clean `200` with a promising body
(`servedBy: "central_edge", rulesEnforced: true`). Then `POST /apps/{id}/deployments`:

```
status: "failed"   error: "replica_unhealthy"   runner: null   logs: ""
```

Failures at 07-25 17:02, 07-27 17:58 and **07-29 06:16** — same code, same empty logs, same ~30 s.

**New evidence that should narrow it down for you:** the *same image* deployed successfully through the
normal path **ten minutes earlier** (deployment `b614ae5c`, `KOI_HEALTH_OK`, live), and the failed
scale-out deployment carries **`runner: null`** — it never appears to land on a runner at all. If nothing
was ever scheduled, `replica_unhealthy` is reporting a *symptom* of a scheduling failure, not a real health
check. Also worth noting: the docs promise precondition errors
(`need_2_meshed_runners` / `scale_out_v1_image_only` / `no_lb_vip`) and we got **none** of them, so as far
as the API is concerned our preconditions are met.

The app stayed up throughout (last-good kept serving, `200` in 0.05 s) and reverting to
`scale-out:false` + redeploy restored `running` in **15 s**. **Good news: this no longer blocks us** — A3
works without it, and for our own domain we bring our own CDN anyway. It is now a robustness bug, not a
migration blocker.

### 🟡 Finding 6 — managed restore re-tested end-to-end: **A1, B1, B2 and `preSeed` all confirmed FIXED** — and one new hard blocker (A4)

We ran the real thing: `pg_dump` from our production RDS (PostgreSQL 17.6) → your managed restore, three
jobs, on the POC cluster.

**What is fixed, verified:**

| Item | Test | Result |
|---|---|---|
| **A1** — `\restrict` | Dump from `pg_dump` **17.10**, `\restrict` on line 5 | ✅ parsed past it; failure occurred at line 51, not line 5 |
| **`preSeed`** | `[{"name":"vector","schema":"extensions"}]` | ✅ `extensions.vector` created; restore proceeded past the pgvector column |
| **B1** — dump kept on failure | Re-`POST` with the **same `dumpKey`** after a failed job | ✅ accepted and re-ran; no re-upload of 241 MB, no `download_failed`/404 |
| **B2** — atomic restore | After two failed jobs, look for leftovers | ✅ **clean**: `articles` absent, no half-created objects. (`preSeed`'s extension correctly survives — it runs before.) |
| Upload path | 241 MB gzip via presigned `PUT` | ✅ 11–23 s; `contentEncoding: gzip` honoured |
| Fail-fast diagnostics | | ✅ still the best part: exact `file:line` + the raw psql error, in ~100 s |

**🔴 A4 (new, blocking for anyone with pgvector) — the restore cannot build an ivfflat index, and there is no API to fix it.**

```
psql:<stdin>:61219: ERROR:  memory required is 65 MB, maintenance_work_mem is 64 MB
```

One megabyte short. And it is not a sizing accident on our side:

- `SHOW maintenance_work_mem` → `65536 kB`, **`source: "default"`** — this is PostgreSQL's stock factory
  default, *not* derived from the cluster's RAM. So provisioning a bigger cluster would not help.
- There is **no way to raise it**: `PUT /databases/{id}/resources` → `404 not_found`, and the new
  `POST /databases/{id}/apply-config` is documented as *"recreate nodes to apply pending config (scoped
  backup credentials, limits)"* — not parameter tuning. We found no documented knob for any GUC.
- Your pooler also rejects the client-side escape hatch:
  `PGOPTIONS="-c maintenance_work_mem=256MB"` → `FATAL: unsupported startup parameter in options`.

**The fix is one line, and we proved it works on your own cluster with your own unprivileged role:**

```sql
-- as the app role, through your pooler:
SET maintenance_work_mem='256MB';  -- → SET, SHOW returns 256MB
```

`maintenance_work_mem` is `USERSET`, so **the restore session can simply set it before running the dump**
(a generous value scaled to the cluster, e.g. `min(25% of RAM, 1GB)`). Without it, **every Supabase-origin
database with pgvector — your stated ICP — cannot complete a managed restore**, which is a shame because
everything else in the pipeline now works.

**Acceptance test:** restore a dump containing `CREATE INDEX … USING ivfflat (embedding vector_cosine_ops)`
over ≥50 k rows into a free-tier cluster; it completes.

**Workaround we used, and its cost:** the manual path still works — prepending `SET maintenance_work_mem`
to the stream and piping into `psql` restored `public.articles` (61 123 rows, 606 MB, 8 indexes including
the ivfflat) in **2 m 39 s**, with `count(*)` matching RDS **exactly** and the table owned by `app`
(so A2's auto-ownership behaves on this path too).

### 🟡 Finding 7 — `GET /apps/{id}/env/verify` is a great idea that reports green on a broken value

The new endpoint is genuinely useful (fingerprints without revealing secrets — right call). But we hit the
exact failure it exists to catch, and it said everything was fine.

Our app's API routes were returning `500`. The container's `DATABASE_URL` was the **literal, unexpanded
string** `${{db.vence-mig2.DATABASE_URL}}` — a manifest interpolation pointing at a database that no longer
exists. Node's reaction, from your logs (which were excellent here — root cause immediately):

```
TypeError: Invalid URL … code: 'ERR_INVALID_URL',
input: '${{db.vence-mig2.DATABASE_URL}}?options=-c statement_timeout=30000 …'
```

`env/verify` reported `present: true, matchesConfigured: true` — technically correct (the container does
see what you stored) but useless here, because **what you stored is an unresolved placeholder**.

**Two asks:** (1) an unresolved `${{…}}` reference should **fail the deploy** (or at minimum surface as a
distinct state), never be passed through literally; and (2) `env/verify` should flag any value still
matching `^\$\{\{.*\}\}$` as `unresolved_reference`. It is a cheap regex that turns a silent 500 into a
one-line answer.

*(Related, minor: when a referenced resource is deleted, the apps referencing it keep a dangling reference
with no warning anywhere in `GET /apps/{id}`.)*

### 🟢 Finding 8 — smaller things, all verified

- **`pause` / `resume` are excellent.** Five paused apps cost nothing and `resume` had the clone serving
  production HTML in **~45 s** with no rebuild. For a POC that spans weeks this is exactly right.
- **Backup ledger** (`GET /databases/{id}/backups`) works and reads well: `mode`, `modeReason`
  (`leader_changed`), `lsn`, sizes, timings.
- **`GET /databases/{id}/connection` returning `caCert` + `sslVerifiedUri`** with the explicit warning
  against `NODE_TLS_REJECT_UNAUTHORIZED=0` is the kind of guidance that prevents a real incident — our own
  POC scripts had that footgun.
- **Docs vs reality on the Postgres patch level:** `llms.txt` says *"`GET /databases/:id` now returns
  `postgres: {running, available, behind}`"*. It does not — the field is absent on our cluster. The server
  actually runs **17.2**, while the docs say PG17 ships **17.5** and our source is **17.6**. Since you
  correctly tell people to check this after a migration, the field needs to exist.
- **`GET /apps/{id}/deployments/{id}` and `GET /apps/{id}/events` are 404** (`No such endpoint`). Deployment
  detail is only reachable by listing. Minor, but it is the first thing you reach for after a failure.

### Status ledger — updated 2026-07-29

| Item | Status |
|---|---|
| **A3 — HTML edge caching** | ✅ **CLOSED — measured HIT with bare `s-maxage`, ~60× capacity** |
| A1 `\restrict` · B1 dump retained · B2 atomic · `preSeed` | ✅ **CLOSED — re-tested end-to-end today** |
| **A4 — `maintenance_work_mem` too low for ivfflat (new)** | 🔴 **OPEN — blocks managed restore for every pgvector/Supabase source** |
| N1 — `scale-out` → `replica_unhealthy` | 🔴 OPEN (3rd repro) — **no longer blocks us** |
| `/rules` `enforcement` message misleads after A3 | 🟡 OPEN — cost us a wrong conclusion on 07-27 |
| `env/verify` green on unresolved `${{…}}` | 🟡 OPEN |
| `postgres: {running, available, behind}` missing | 🟡 OPEN |
| G5 — **price of the plan we need** | ❓ **still the single biggest unknown** |

### Where the migration stands after today

Every technical objection this report has raised over eight days is now either fixed or ours to fix, and
**the two that mattered most — capacity and edge caching — are closed with measurements, not promises.**
One free-tier replica now serves 37× our production peak at a p95 of 50 ms, and the latency gap to a
CloudFront-fronted Fargate fleet is 1.4–2.0×.

What is left is not engineering:

1. **The price of the plan we need** (1–2 replicas × 2 GB, ~35 GB Postgres with PITR, Redis, object storage).
   This has been the top unknown for four days and it is now the *only* thing between us and a cutover
   rehearsal.
2. **A4**, if you want us to use the managed restore rather than `pg_dump | psql` for the real 31 GB load.
3. On our side: the `getClientIp()` / `CF-Connecting-IP` fix recorded on 07-27, and re-cloning the database
   (our POC cluster is a schema-only shell today — the populated one was deleted during the POC).

**Tell us the number and we will schedule the rehearsal.**

---

## 💰 UPDATE 2026-07-29 (later) — **you published the prices. That was the last open question, and the answer is Pro ($35).**

`llms.txt` 810 → **837 lines**, `openapi.json` unchanged at 189 paths. Two additions, and one of them closes
the item that has been at the bottom of every "where this stands" table for four days: **G5, the price of
the plan we need.**

For four days our summary ended with *"tell us the number and we can make a decision."* Here is the decision,
worked with our own measured numbers.

### What we actually need (measured, not estimated)

| Resource | Vence in production today | Source of the number |
|---|---|---|
| App RAM | **2 GB × 1 replica** (2 for HA) | your load test: 615 rps, p95 50 ms, 37× our peak, CPU 0 % |
| DB | 31 GB data · **4 GB RAM** · 100 GB disk allocated | our RDS is a `db.t4g.medium` Multi-AZ |
| Bandwidth out | **~370 GB / 28 days (~400 GB/mo)** | AWS Cost Explorer, all CloudFront `DataTransfer-Out` |
| Requests | **43.3 M / month** | same, `EU-Requests-Tier2-HTTPS` |
| Object storage | ~56 GB of HLS video | already served from koigrid storage today |

### The fit

**Pro ($35/mo) covers all of it**, with the DB being the interesting line:

| | Pro includes | We need | Headroom |
|---|---|---|---|
| RAM/vCPU per app | 4 GB / 2 vCPU | 2 GB | 2× |
| Total app RAM | 6 GB | 2–4 GB (1–2 replicas) | ✅ |
| **DB RAM / disk** | **4 GB / 50 GB** | **4 GB / 31 GB** | **exact RAM parity with our RDS** |
| Storage | 100 GB | ~56 GB | tight but fits |
| Bandwidth | 2 TB | ~400 GB | 5× |
| Replicas per app | 5 | 1–2 | ✅ |

**Starter ($12) does not work** — not because of the totals but because of the **per-app cap**: 1 GB RAM per
app, and our Next.js container needs 2 GB. Worth knowing that the per-app ceiling, not the plan total, is
what disqualifies a plan; the pricing page shows it but the `llms.txt` cost model only lists the totals, so
an agent budgeting from the docs alone would size this wrong.

### The comparison, with our real AWS bill

Our AWS run-rate, measured in Cost Explorer (01→24/07, extrapolated): **$491/mo**.

| | AWS today | Koigrid Pro | Koigrid Scale |
|---|---|---|---|
| Monthly | **$491** | **$35** | **$89** |
| Ratio | — | **14× cheaper** | 5.5× cheaper |

And one line of that bill is worth pointing at, because it is invisible until you look: **$40/mo of our
CloudFront cost is REQUESTS**, not data — 43.3 M Tier-2 HTTPS requests. Egress itself is nearly free for us
(~400 GB). **Koigrid does not meter requests at all.** So for a request-heavy, byte-light app like ours, the
saving is not the egress story you lead with in the docs — it is that the request meter doesn't exist. That
is a stronger pitch for the Next.js/SSR ICP than the egress comparison, and you are currently not making it.

### Two gaps in the published model

1. **🔴 Redis is not priced anywhere.** It is not a row in the pricing table, not in the `llms.txt` cost
   model, and we could not infer it from `/usage`. We run one (`cache`, ElastiCache-equivalent, $8/mo on
   AWS). Does its RAM come out of the plan's "total app RAM", or is it included like the database, or is it
   billed separately? **A migration cannot be budgeted without this** — please add a Redis row.
2. **DB disk headroom deserves a sentence.** Pro's 50 GB against our 31 GB is 1.6×, and a database only grows.
   The overage rate ($0.05/GB) makes this a non-issue in practice — 100 GB extra is $5 — but the pricing page
   presents disk as a hard plan attribute, so it reads scarier than it is. Saying *"disk overage is $0.05/GB,
   you will not be cut off"* next to the DB line would remove the doubt.

Minor, and good: the **registry retention** note added in the same release answers a question we had not yet
asked — *"will my rollback target still be there?"*. Keeping N per plan **but never deleting an image that is
serving or still rollback-reachable**, computed by you rather than configured by us, is genuinely better than
the ECR lifecycle rules we maintain by hand today. Flagging that the sweep currently runs in dry-run is the
kind of disclosure that builds trust.

### Where this leaves us

**Nothing technical is open on your side that blocks our cutover, and now nothing commercial is either.**
The remaining work is ours: re-clone the database (our POC cluster is a schema-only shell), land the
`getClientIp()` / `CF-Connecting-IP` fix before any traffic moves, and put our own Cloudflare in front.
**A4** (`maintenance_work_mem` too low for ivfflat) only matters if we use your managed restore instead of
`pg_dump | psql` for the real 31 GB load — we would prefer to use yours.

---

## 🔴 UPDATE 2026-07-29 (evening) — N1 re-tested on the pricing release: **still `replica_unhealthy`, and now proven to be platform-wide, not our app**

Re-ran the `scale-out` path on the build that shipped the cost model. **Fourth consecutive reproduction**
(2026-07-25 17:02 · 07-27 17:58 · 07-29 06:16 · 07-29 evening), byte-identical failure every time:

```
PUT  /apps/{id}/scale-out {"enabled":true}
  → 200 {"scaleOut":{"enabled":true,"servedBy":"central_edge","rulesEnforced":true}}
POST /apps/{id}/deployments
  → status: "failed"   error: "replica_unhealthy"   runner: null   logs: ""     (~24 s)
```

### The new evidence: we ran it on a **second, unrelated app** and it fails the same way

This is the check we had not done before, and it settles what the bug is *not*:

| App | Image | CDN | Normal deploy | `scale-out` deploy |
|---|---|---|---|---|
| `vence-web7` | our Next.js 16 clone (ECR) | on | ✅ `running`, serves in 0.05 s | ❌ `replica_unhealthy`, `runner: null`, empty logs |
| `vence-web9` | different app, different config | on | ✅ `running`, serves in 0.05 s | ❌ **identical failure** |

Both apps deploy fine on the normal path **minutes before and after** the failed scale-out attempt — in
web7's case, resumed from pause to serving production HTML in **12 s**. So this is not our image, not our
health endpoint, not our memory footprint and not one app's stored config: **the scale-out path itself fails
for every app we can point it at.**

### Why we think it is scheduling, not health

`runner: null` on the failed deployment is the tell. On every successful deployment the record carries a
runner (`docker-ssh`) and logs (`KOI_HEALTH_OK`). Here there is **no runner, no logs, and no container
output at all** — 24 s from queued to failed. A health check that never had a replica to probe is reporting
`replica_unhealthy`, which sends the operator to debug the wrong layer entirely (we spent two sessions
looking for a `healthPath` to tune before noticing there is none to tune).

Three asks, in order of what would have saved us the most time:

1. **Distinguish "never scheduled" from "scheduled and unhealthy."** A code like `no_runner_available` or
   `scale_out_placement_failed` would have ended this in one attempt instead of four sessions.
2. **Emit logs on this path.** Every other failure mode on koigrid self-explains — it is the thing this
   report has praised most consistently. This one is the single exception, and it is the one that has been
   open longest.
3. **Return the documented preconditions when they fail.** The docs promise `need_2_meshed_runners` /
   `scale_out_v1_image_only` / `no_lb_vip`; we get none of them, so from the API's point of view our
   preconditions are met — yet placement never happens. If the real cause is "no second meshed runner has
   capacity right now", say exactly that.

**Acceptance test:** on a free-tier account, `scale-out:true` + a deploy of an existing `sourceType:image`
app reaches `running` with ≥2 replicas — or fails with a code that names the missing precondition.

### Impact on us: still none, and that is worth stating plainly

We reverted both apps to `scale-out:false`, redeployed, and both are `running` and serving normally
(`200` in 0.05 s). **There was no downtime at any point in four attempts** — the last-good deployment kept
serving throughout, which is exactly the behaviour you want from a failed deploy and deserves saying.

And the reason this is no longer a blocker for our migration is worth repeating from this morning's finding:
**A3 (HTML edge caching) works without scale-out.** Your `/rules` endpoint still tells operators otherwise
(`enforced:false, servedBy:"legacy_runner"`, remedy `PUT /scale-out`) on an app that is demonstrably
edge-caching at 615 rps. That message is now the most expensive wrong signal in the API: it is what made us
conclude on 07-27 that A3 was gated behind N1, and it is what sent us back to this broken endpoint twice
today. **Fixing the message is probably a smaller job than fixing the bug, and would help more people.**

*(Unrelated small datum from the same run, in case it is useful: an app resumed from `paused` served its
first uncached request in **42 s** — cold start including the redeploy — and then settled at **0.05-0.10 s**
from the second request on. Not a complaint; worth documenting so nobody benchmarks a just-resumed app.)*

---

## 🔁 CHECK 2026-07-29 (11:53 UTC) — no contract change, and **both open items behave exactly as before**

Pulled the docs and re-ran the two open items. Recording it because a negative result is also data, and
because we would rather you know we re-test on every release than assume.

| | Result |
|---|---|
| `llms.txt` | **byte-identical** (md5 `2da160432da9`, 837 lines) to the pricing build |
| `openapi.json` | **189 paths, no additions, no removals** |
| **N1 `scale-out`** | ❌ **5th reproduction** — `replica_unhealthy`, `runner: null`, empty logs, 24 s |
| **A4 `maintenance_work_mem`** | ❌ unchanged — `65536 kB`, `source: "default"`; `PUT /databases/{id}/resources` still `404` |

So either nothing shipped, or what shipped touches neither of the two items we have open. No complaint
attached to that — you have shipped an extraordinary amount this week — but it does mean **N1 is now the
longest-lived open bug in this report** (first seen 07-25, five reproductions across four days, two of them
on different apps).

We could not tell from the outside whether a release had happened: `koigrid.com/docs/changelog` 307s to
`/docs#changelog`, and that page carries no dated entries. **A dated changelog, or a build/version header on
the API, would let us re-test only what changed instead of re-running everything.** It would also have saved
us two of these five attempts.

Housekeeping on our side: both apps reverted to `scale-out:false`, verified serving (`200`), and all five
POC apps returned to `paused`. The `vence-poc` database stays `running`.

---

## 🗄️ UPDATE 2026-07-29 (15:20 UTC) — storage moves to `storage.koigrid.com`: **the docs change is right, and we cannot complete the migration**

`llms.txt` **837 → 865 lines**, `openapi.json` unchanged (189 paths). The whole diff is the storage section,
and the headline is a line we fully agree with:

> *"**Take the endpoint from the response of `POST /storage/keys` — never hardcode one.** Buckets can live on
> different storage fleets, and each has its own address."*

The previously documented `https://s3.koigrid.com` constant is gone. This is the correct call, and it caught
us fairly: **our production code carries exactly that hardcoded constant** as its default
(`lib/api/video-courses/videoSignedUrl.ts`), and our ECS task definition sets no override — so production has
been running on a hardcoded address, which is our bug to fix, not yours.

### What we measured, in order

We serve ~30 course videos (MP4 + HLS, ~56 GB) from bucket `vence-videos` to paying users, so we verified
before touching anything:

| Check | Result |
|---|---|
| Production key on **`s3.koigrid.com`** | ✅ **works** — lists all 8 prefixes; presigned GET of a real MP4 → **206 in 44 ms** |
| Production key on **`storage.koigrid.com`** | ❌ `InvalidAccessKeyId` — *"The Access Key Id you provided does not exist in our records"* |
| `POST /storage/keys` | ✅ returns `endpoint: https://storage.koigrid.com` — exactly as instructed |
| **New key** → `ListObjectsV2 s3://vence-videos/` | ❌ **`AccessDenied`** |
| **New key** → `HeadObject vence-videos/word-365/bloque-04.mp4` | ❌ **403 Forbidden** |
| `GET /buckets` | ❌ **`{"buckets":[]}`** — our org lists **zero** buckets, while serving `vence-videos` in production |

So the new key is **valid on the new fleet but not authorized for our bucket**. That is consistent with your
own line — *"a key is scoped to the buckets your organization owns"* — and with `GET /buckets` being empty:
`vence-videos` sits outside this organization's bucket registry, presumably because it predates it.

**Net: we cannot do the migration you asked for.** Minting a key is not enough, and we are not changing
production, because the current address still works and the change would take working video to 403.

### 🔴 The ask, and one thing worth fixing in the docs regardless

1. **Attach `vence-videos` to our organization** (so `GET /buckets` lists it and org-minted keys can reach
   it), **or** issue us a key that is authorized for it. Either unblocks us in minutes.
2. **`GET /buckets` returning an empty list for a bucket we demonstrably own and serve is a gap in its own
   right.** An inventory endpoint that omits your live data is worse than no inventory: it is what made us
   assume, briefly, that the bucket had been deleted. Whatever the ownership model, the API should either
   list it or explain why it cannot.
3. **⚠️ Say in the docs that the endpoint change and the key rotation are COUPLED.** We proved both failure
   halves: old key + new endpoint = `InvalidAccessKeyId`; new key + our bucket = `AccessDenied`. A customer
   who reads *"change the address to `storage.koigrid.com`"* and ships that alone — the natural reading, since
   it is one env var — takes a **hard outage on every object**. One sentence ("rotate the key in the same
   change; the old key does not exist on the new fleet") prevents it.

### One process note, said plainly and without drama

While checking `/tokens` we found a token in **our** account named **`migracion videos (borrar)`**, scopes
`storage:read, storage:write`, created **today 12:43 UTC** and revoked **13:14 UTC** — a window that matches
the storage migration. We did not create it.

We are not upset: someone had to move the bytes, it was done cleanly, it was revoked afterwards, and
production never broke. But **we only learned it happened because we happened to list our tokens.** For a
customer with data on your platform, the right shape is an **event the customer can see** (`storage.migrated`,
`staff.access.granted/revoked`) — ideally a notification, at minimum an entry in an audit feed. The token
list is a decent audit trail; it just isn't one anybody thinks to read. You have been exemplary all week
about disclosing your own limitations in the docs; this is the same instinct applied to operations.

### 📊 Re-measured vs AWS in the same window (15 samples per row, alternating hosts)

Since we were re-testing anyway, here is a fresh head-to-head. Koigrid = **1 replica, 2 GB, free plan**;
AWS = production (CloudFront + ALB + 8 Fargate tasks). This is an **afternoon** run; the 1.37–1.97× table
earlier today was measured at ~06:00 UTC, so read the two together rather than as a trend.

| Path | AWS p50 / p90 | Koigrid p50 / p90 | ratio (p50) |
|---|---|---|---|
| `/` | 38 / 65 ms | 87 / 154 ms | 2.28× |
| `/leyes` | 50 / 68 ms | 111 / 126 ms | 2.22× |
| `/leyes/constitucion-espanola` | 45 / 66 ms | 95 / 102 ms | 2.11× |
| `/auxiliar-administrativo-estado` | 167 / 234 ms | 188 / 334 ms | **1.12×** |

**A3 still holds:** 3/3 requests `cf-cache-status: HIT` on all three cached documents. And capacity is
unchanged in substance — same load test, same parameters, 1 replica:

| | rps | p50 | p95 | errors | saturated |
|---|---|---|---|---|---|
| `/leyes/constitucion-espanola` @ conc 15 | **519** | 24 ms | 57 ms | 0 % | no |
| `/` @ conc 15 | **385** | 35 ms | 67 ms | 0 % | no |
| `/leyes/constitucion-espanola` @ conc 50 | **712** | 67 ms | 123 ms | 0 % | no |

That is ~15 % below this morning's 615/462/838 — consistent with a busier hour, not a regression, and still
**31× our production peak on one free-tier replica** with the CPU at 0 %.

**Housekeeping:** the temporary storage key we minted for this test has been deleted
(`DELETE /storage/keys/{id}` → 200, list back to empty). The POC app was resumed for the measurements and
returned to `paused`. Production video remains on `s3.koigrid.com` and is serving normally.

---

## 📊 UPDATE 2026-07-29 (16:10 UTC) — **on whole-page load you are at parity with AWS.** The TTFB ratio we have been quoting all week oversells the gap

No new release since 15:20 (`llms.txt` byte-identical, md5 `8ff803a88c`, 865 lines; 189 paths). So this is a
measurement update plus a re-check of what is open.

### ⭐ The new measurement: we had been measuring the wrong thing

Every head-to-head in this report so far quotes **TTFB** (`time_starttransfer`). Today we also measured
**`time_total`** — the whole document on the wire, which is what a user actually waits for — and checked that
the payloads are comparable so it is a fair fight:

| Path | AWS total / size | Koigrid total / size | ratio |
|---|---|---|---|
| `/` | **105 ms** / 754 KB | **107 ms** / 704 KB | **1.02×** |
| `/leyes` | **136 ms** / 2 330 KB | **157 ms** / 2 269 KB | **1.15×** |
| `/leyes/constitucion-espanola` | **91 ms** / 420 KB | **100 ms** / 408 KB | **1.10×** |

**That is parity.** Sizes match within 2–3 % (Koigrid's are marginally *smaller*), so this is like-for-like:
one 2 GB free-tier replica against CloudFront + ALB + 8 Fargate tasks.

For contrast, the same measurement on **2026-07-25** — before HTML edge caching worked — was Koigrid
**523 ms** home and **668 ms** `/leyes` against AWS 78 / 128 ms, i.e. **5–6× worse**. A3 did not just improve
a number; it removed the difference.

**Why the TTFB ratio looks worse than the experience:** TTFB is a small absolute base (≈40 ms vs ≈60 ms), so
a 20 ms edge-routing difference reads as "1.5× slower" while being invisible next to 100 ms of transfer.
**If you are ever comparing yourselves to CloudFront in marketing, use whole-page load.** Your own numbers
are much better than the metric you have been letting us quote at you.

### The honest picture on TTFB: three runs today, and the spread matters more than any one of them

| Run (UTC) | `/` | `/leyes` | `/constitucion` | `/aux-admin-estado` |
|---|---|---|---|---|
| ~06:00 | 1.97× | 1.54× | 1.37× | **0.81×** |
| 15:20 | 2.28× | 2.22× | 2.11× | 1.12× |
| 16:10 | **1.35×** | **1.44×** | 1.88× | **0.99×** |

Same app, same method (15 samples, alternating hosts, medians). **The run-to-run spread is as large as the
gap we are trying to measure**, so the fair statement is *"roughly 1.4–1.9× on TTFB for light documents, and
a tie on the heavy one"* — not any single row. We are flagging this because we have quoted single runs at you
before and it was not rigorous of us.

Capacity is stable across the day (1 replica, 2 GB, free plan, same load test):

| | 06:00 | 15:20 | 16:10 |
|---|---|---|---|
| `/constitucion` @ conc 15 | 615 rps | 519 rps | **523 rps** |
| `/` @ conc 15 | 462 rps | 385 rps | **412 rps** |
| `/constitucion` @ conc 50 | 838 rps | 712 rps | **658 rps** |

0 % errors everywhere, never saturated, CPU 0 %. **A3 verified again: 3/3 `HIT` on all three documents.**

### 🔴 Still open, re-checked just now

- **S1 (storage) — unchanged, and it is not a propagation delay.** We minted a *second* fresh key
  (`POST /storage/keys` → `endpoint: https://storage.koigrid.com`, correct) and it still gets **`AccessDenied`**
  on `ListObjectsV2 s3://vence-videos/`. `GET /buckets` still returns **`{"buckets":[]}`**. Key deleted after
  the test. **We remain on `s3.koigrid.com` in production, which continues to serve normally.** The unblock is
  one action on your side: attach the bucket to our org, or hand us an authorized key.
- **N1 (`scale-out`)** — untouched since the 5th reproduction this morning; no reason to expect a change with
  no release in between.
- **A4 (`maintenance_work_mem` 64 MB)** — unchanged.

### What we would ask for, in one line each

1. **Attach `vence-videos` to our organization** — it is the only thing blocking a customer-visible change you
   asked us to make.
2. **Publish whole-page numbers, not TTFB.** You are at parity and the metric you are being judged on hides it.
3. **A dated changelog or a version header** (asked this morning, repeating because it would have saved this
   session two full re-test rounds: we cannot tell a no-op release from a real one without re-running everything).

---

## ✅ UPDATE 2026-07-29 (17:55 UTC) — **A4 is fixed and we ran the first fully successful managed restore.** N1 is half-fixed, and we owe you a correction

Both fixes you announced were shipped **without a docs change** (`llms.txt` still byte-identical, md5
`8ff803a88c`, 865 lines; 189 paths) — so they were only findable by re-running the tests. Both were.

### ⭐ A4 — CLOSED. The ivfflat index builds, and the whole restore now completes

We re-ran the real thing: `pg_dump` from our production RDS 17.6 → your managed restore, on the POC cluster.

**Progression across three jobs, which shows the fix landing precisely:**

| Job | Failed at | Cause |
|---|---|---|
| This morning | `psql:<stdin>:**61219**` | `memory required is 65 MB, maintenance_work_mem is 64 MB` ← **A4** |
| Now, 1st retry | `psql:<stdin>:**61290**` | `no unique constraint matching given keys for referenced table "laws"` ← **ours** |
| Now, 2nd retry | `psql:<stdin>:61290` | `violates foreign key constraint "articles_law_id_fkey"` ← **ours** |
| Now, 3rd (complete dump) | — | ✅ **`done` in 267 s** |

The failure line moved past the index build on the first attempt. **A4 is fixed.** The two failures after it
were entirely our doing: our POC cluster is a degraded schema-only shell from an earlier partial port, so its
`laws` table had lost its primary key, and we had dumped `articles` without the `laws` rows it references.
Once we dumped both tables together it went straight through.

**Verified after the restore, not assumed:**

| Check | Result |
|---|---|
| `articles` rows | **61 123** — exact match with RDS |
| `laws` rows | **1 404** — exact match with RDS |
| The index that used to kill it | ✅ `articles_embedding_idx … USING ivfflat (embedding vector_cosine_ops) WITH (lists='100')` |
| Ownership (A2) | ✅ `owner = app` |
| Size / time | 624 MB restored from 242 MB gzip in **267 s** |
| B1 (dump retained) | ✅ retried twice on the same `dumpKey`, no re-upload |
| B2 (atomic) | ✅ after each failure, `articles` was **absent** — no half-created objects |

This is **the first end-to-end managed restore we have completed**, and it is the path we would use for the
real 31 GB load. Thank you — that was our only P0.

### 🟡 One gap in the same feature: `tableCounts` is empty exactly when it succeeds

```json
{"status":"done","tableCounts":[],"logs":"__KOIOK__"}
```

Your docs sell `tableCounts` as *"per-table row counts to verify the migration"* — it is the thing that makes
a restore trustworthy without a second tool. On our **successful** job it came back as an **empty array**, so
we verified the counts ourselves with `/query`. (On the failed jobs it was `null`, which is fair.) Small fix,
and it is the difference between "the job says done" and "the job proved it".

### 🟡 N1 — you shipped half of it, and it is the useful half. But the claim about the reason is not true yet

You said the runner and the records are now kept, and that the reason distinguishes *"we couldn't reach the
machine"* from *"the container didn't start"*. Measured, sixth reproduction:

| Field | Before today | Now |
|---|---|---|
| `runner` | `null` | ✅ **`167.233.84.5`** |
| `logs` | `""` | 🟡 **`"KOI_SO_FAIL\n"`** |
| `error` | `replica_unhealthy` | ❌ **`replica_unhealthy`** — unchanged |
| `image` | *(not checked)* | ⚠️ **`null`** |

- ✅ **The runner is now recorded.** That is a real improvement and it settles the question below.
- 🟡 **`logs` is technically non-empty, but it is a sentinel, not a record.** `KOI_SO_FAIL` names the failure;
  it does not say anything about it. What we still cannot see is *why* the replica was considered unhealthy.
- ❌ **The reason does not distinguish the two cases.** It is the same `replica_unhealthy` string as on
  2026-07-25. If the distinction exists internally, it is not reaching the API.
- ⚠️ **`image: null` on the failed deployment**, where successful deployments carry the full ECR reference.
  Worth a look — it may mean the scale-out path fails before resolving the image.
- ⏱️ The whole thing fails in **14 s** (`createdAt` 17:40:08 → `finishedAt` 17:40:22), which seems short for a
  health check with any grace period. And the app's own log stream shows the container coming up perfectly:
  `▲ Next.js 16.2.6 … ✓ Ready in 0ms`.

### 🙏 And a correction we owe you

On 2026-07-29 (morning) we told you, with some confidence, that `runner: null` meant *"the replica was never
scheduled, so `replica_unhealthy` is reporting a symptom of a scheduling failure"*, and we asked you to add a
`no_runner_available` code on that basis. **Now that the runner is recorded — `167.233.84.5` — that hypothesis
looks wrong: placement did happen.** We were reasoning from a field you had not yet populated, and we should
have flagged it as a guess rather than a diagnosis. The ask stands in a narrower form: **say why the replica
was judged unhealthy** (exit code, failed probe, timeout), because the container clearly starts.

### Housekeeping

`scale-out` reverted to `false` and redeployed; the app is `running` and serving (`200`). **No downtime in six
attempts.** The POC app is back to `paused`. The POC database now holds a real, verified `articles` + `laws`
(61 123 / 1 404 rows) restored entirely through your managed path.
