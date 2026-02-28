import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
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
