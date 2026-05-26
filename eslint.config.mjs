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
      ],
    },
  },
];

export default eslintConfig;
