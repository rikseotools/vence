import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/",
      "node_modules/",
      "scripts/",
      "database/",
      "docs/",
      "_tmp_*.cjs",
      "*.cjs",
      "*.json",
    ],
  },
  // Plugin @typescript-eslint cargado SOLO con su definición de reglas
  // (no las habilitamos para no destapar deuda nueva). Esto sirve para que
  // los `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
  // dispersos por código de producción NO disparen "Definition for rule
  // not found" — porque el plugin ahora existe en el config.
  //
  // reportUnusedDisableDirectives: false → evita que --fix elimine los
  // disable directives "huérfanos" (las reglas que ignoran no están
  // habilitadas, pero el comment sigue siendo válido como documentación
  // de intención y no debe tocarse en una limpieza masiva).
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["app/api/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Usa lib/api/shared/auth.ts (getServiceClient) en vez de importar createClient directamente.",
            },
          ],
        },
      ],
    },
  },
  // Anti-patrón: cache singleton in-memory a nivel módulo con `let xxxCache`.
  // En Next.js cada bundle (RSC, API Route, Middleware, ...) crea SU PROPIA
  // copia del `let` → leak de memoria por duplicación bajo carga.
  // Causó el incidente OOM 2026-05-26 14:50-15:10 en `lib/api/laws/queries.ts`.
  // Fix: usar `createGlobalCache` del helper `lib/cache/globalCache.ts`.
  //
  // Severidad WARN porque hay ~7 archivos existentes con el patrón roto que
  // requieren migración gradual (task #118). NUEVOS caches deben usar el
  // helper desde el primer commit.
  {
    files: ["lib/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Program > VariableDeclaration[kind='let'] > VariableDeclarator[id.name=/Cache$/]",
          message:
            "Cache singleton a nivel módulo con `let xxxCache` se duplica por bundle en Next.js (leak de memoria). Usa `createGlobalCache` de lib/cache/globalCache.ts. Ver postmortem #115 + task #118.",
        },
        {
          selector:
            "Program > VariableDeclaration[kind='let'] > VariableDeclarator[id.name=/CacheTime$/]",
          message:
            "Variable de control de cache a nivel módulo se duplica por bundle (leak). Migra el cache asociado a `createGlobalCache` de lib/cache/globalCache.ts.",
        },
        // ─── Antipattern 1: credencial en NEXT_PUBLIC_* ──────────────────
        // process.env.NEXT_PUBLIC_X se INLINA en el bundle JS público en
        // build-time. Cualquier valor con SECRET/KEY/TOKEN/PASSWORD ahí es
        // exposición trivial — visible al abrir DevTools. Origen: incidente
        // 27/05/2026 (NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY leaked durante
        // 11 meses en /admin/feedback bundle). Excepción: NEXT_PUBLIC_SUPABASE_ANON_KEY
        // está diseñada para ser pública (RLS la protege). Ver
        // docs/roadmap/agnosticismo-supabase.md §Antipatterns prohibidos.
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)/i]:not([property.name='NEXT_PUBLIC_SUPABASE_ANON_KEY']):not([property.name='NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']):not([property.name=/NEXT_PUBLIC_STRIPE_PRICE_/])",
          message:
            "NEXT_PUBLIC_* con SECRET/KEY/TOKEN/PASSWORD se inlina en bundle cliente y expone el valor a cualquier visitante. Usa env var server-side (sin prefijo NEXT_PUBLIC_) accedida desde un endpoint API.",
        },
      ],
    },
  },
  // ─── Antipattern 2: createClient(..., SERVICE_ROLE) en CLIENTE ────────
  // Server-side (endpoints API, libs server-only) puede usar SERVICE_ROLE
  // legítimamente. La regla solo aplica al código que se puede ejecutar en
  // browser: componentes React, hooks, contexts, utils compartidos client/server.
  //
  // Excluye explícitamente paths server-only por convención:
  //   - app/api/**: API routes (Node runtime, no browser).
  //   - lib/api/**, lib/db/**, lib/services/server*: helpers backend.
  //   - *.server.ts/.server.tsx: convención Next.js para módulos server-only.
  //   - backend/**: NestJS Fargate (no Next.js cliente).
  //   - middleware.ts: Edge runtime, no browser.
  //
  // Cualquier OTRO archivo (componente, contexto, hook) con createClient +
  // SERVICE_ROLE dispara error. Origen: bug app/admin/feedback/page.tsx que
  // exponía service_role en bundle público durante 11 meses (27/05/2026).
  {
    files: [
      "app/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "contexts/**/*.{ts,tsx,js,jsx}",
      "hooks/**/*.{ts,tsx,js,jsx}",
      "utils/**/*.{ts,tsx,js,jsx}",
    ],
    ignores: [
      "app/api/**",
      "**/*.server.ts",
      "**/*.server.tsx",
      "**/middleware.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='createClient'] Identifier[name=/SERVICE_ROLE/]",
          message:
            "createClient con SERVICE_ROLE bypasea RLS y, en código cliente, expone el JWT en el bundle JS público. Usa un endpoint API server-side con getAdminDb() en su lugar.",
        },
      ],
    },
  },
];

export default eslintConfig;
