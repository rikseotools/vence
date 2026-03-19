require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.9.3 garantias constitucionales
  const exp1 = `**Articulo 9.3 de la Constitucion Espanola:**

> "La Constitucion garantiza el principio de legalidad, la jerarquia normativa, la publicidad de las normas, la **irretroactividad** de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad juridica, la **responsabilidad** y la interdiccion de la arbitrariedad de los poderes publicos."

**Por que C es correcta:**
La opcion C reproduce fielmente las **7 garantias** del art. 9.3 con la redaccion correcta, incluyendo "**irretroactividad**" y "**responsabilidad**".

**Por que las demas son incorrectas (cada una tiene una trampa diferente):**

- **A)** Cambia "**irretroactividad**" por "**retroactividad**". Trampa clasica: el art. 9.3 garantiza la **irretroactividad** (que las normas desfavorables NO se apliquen hacia atras), no la "retroactividad". Una sola letra cambia completamente el sentido.

- **B)** Describe el contenido del art. **9.2**, no del 9.3. El art. 9.2 habla de "promover las condiciones para que la libertad y la igualdad sean reales y efectivas". Mezclar los apartados del art. 9 es una trampa habitual.

- **D)** Omite "la **responsabilidad**" de la lista. Las 7 garantias del art. 9.3 incluyen la responsabilidad (de los poderes publicos), pero esta opcion la elimina, dejando solo 6 garantias.

**Las 7 garantias del art. 9.3 CE:**
1. Principio de **legalidad**
2. **Jerarquia** normativa
3. **Publicidad** de las normas
4. **Irretroactividad** de disposiciones sancionadoras desfavorables/restrictivas
5. **Seguridad** juridica
6. **Responsabilidad**
7. **Interdiccion** de la arbitrariedad de los poderes publicos

**Trampas frecuentes:** cambiar "irretroactividad" por "retroactividad" (A), mezclar con el art. 9.2 (B), u omitir una garantia como "responsabilidad" (D).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9a2d6463-6919-4ebc-a3e7-89743c5cee8b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.9.3 garantias (" + exp1.length + " chars)");
})();
