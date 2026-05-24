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
];

export default eslintConfig;
