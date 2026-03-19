require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Reglamento Congreso art.126.3 plazo 30 dias
  const exp1 = `**Articulo 126 del Reglamento del Congreso de los Diputados** (Proposiciones de ley):

> "Transcurridos **treinta dias** sin que el Gobierno hubiera negado expresamente su conformidad a la tramitacion, la proposicion de ley quedara en condiciones de ser incluida en el orden del dia del Pleno para su toma en consideracion."

**Por que C es correcta (30 dias):**
El art. 126.3 RC establece un plazo de **30 dias** para que el Gobierno manifieste su disconformidad a la tramitacion de una proposicion de ley. Si no dice nada en ese plazo, se entiende que no se opone (silencio positivo) y la proposicion puede ser incluida en el orden del dia del Pleno.

**Por que las demas son incorrectas:**

- **A)** "20 dias". Falso: el plazo es de 30 dias, no 20. No hay ninguna referencia a 20 dias en este contexto.

- **B)** "10 dias". Falso: el plazo es de 30 dias, no 10. El plazo de 10 dias aparece en otros contextos (ej: alegaciones en la cuestion de inconstitucionalidad), pero no aqui.

- **D)** "15 dias". Falso: el plazo es de 30 dias, no 15. El plazo de 15 dias es frecuente en procedimientos administrativos, pero no es el que aplica aqui.

**Clave:** Gobierno tiene **30 dias** para oponerse a la tramitacion de proposiciones de ley. Si calla, la proposicion sigue adelante.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c3a0beec-1bea-438a-a100-61044c059da5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Reglamento Congreso art.126 (" + exp1.length + " chars)");

  // #2 - CE art.148.1.2a competencias CCAA terminos municipales
  const exp2 = `**Articulo 148.1.2a de la Constitucion Espanola:**

> "Las Comunidades Autonomas podran asumir competencias en las siguientes materias: [...] 2a Las alteraciones de los terminos municipales comprendidos **en su territorio** y, **en general**, las funciones que correspondan a la Administracion del Estado sobre las Corporaciones locales y cuya transferencia autorice la legislacion sobre Regimen Local."

**Por que A es correcta:**
La opcion A reproduce literalmente el art. 148.1.2a CE. Contiene los dos elementos clave correctos: (1) "**en su territorio**" (sin anadir territorios colindantes) y (2) "**y, en general**" (no "salvo").

**Por que las demas son incorrectas:**
Las opciones cambian sutilmente el texto del articulo en dos puntos clave:

| Opcion | Ambito territorial | Conector | Error |
|--------|-------------------|----------|-------|
| **A** | En su territorio | Y, en general | Correcta |
| B | En su territorio **o colindantes** | Y, en general | Anade "colindantes" |
| C | En su territorio **o colindantes** | **Salvo** | Anade "colindantes" + cambia conector |
| D | En su territorio | **Salvo** | Cambia "y en general" por "salvo" |

- **B)** Anade "o en territorios colindantes con otras CCAA". Falso: el art. 148.1.2a solo dice "**en su territorio**". Las CCAA no tienen competencia sobre terminos municipales de otras CCAA.

- **C)** Tiene dos errores: anade "colindantes" Y cambia "y, en general" por "**salvo**". El "salvo" invertiria el sentido: excluiria las funciones en vez de incluirlas.

- **D)** Cambia "y, en general" por "**salvo**". Falso: el articulo dice que las CCAA pueden asumir **tambien** (en general) las funciones del Estado sobre Corporaciones locales. El "salvo" las excluiria.

**Clave:** Dos trampas: (1) NO incluye territorios colindantes y (2) el conector es "**y, en general**" (inclusion), no "salvo" (exclusion).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7797a633-1806-4934-b2cb-cf90cf6a9608");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.148 competencias CCAA (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 art.103 multas coercitivas
  const exp3 = `**Articulo 103.1 de la Ley 39/2015** (Multas coercitivas - supuestos):

> "Las Administraciones Publicas pueden [...] imponer multas coercitivas [...] en los siguientes supuestos:
> a) Actos **personalisimos** en que **no proceda** la compulsion directa sobre la persona del obligado.
> b) Actos en que, **procediendo** la compulsion, la Administracion **no la estimara conveniente**.
> c) Actos cuya ejecucion **pueda** el obligado encargar a otra persona."

**Por que A es correcta:**
La opcion A reproduce literalmente el art. 103.1.b): cuando la compulsion directa seria posible pero la Administracion no la considera conveniente. Refleja el principio de proporcionalidad: se elige la multa como medio menos lesivo.

**Por que las demas son incorrectas:**
Cada opcion modifica sutilmente el texto del articulo:

- **B)** "Actos personalisimos de **no hacer o soportar**". Falso: el art. 103.1.a) dice "actos personalisimos en que **no proceda la compulsion directa**". La expresion "no hacer o soportar" no aparece. Esta formula ("no hacer, soportar") es propia de otros contextos juridicos pero no del art. 103.

- **C)** "Actos **no personalisimos** en que no proceda la compulsion directa". Falso: el art. 103.1.a) dice "actos **personalisimos**" (con sentido positivo), no "no personalisimos". Anadir el "no" invierte completamente el supuesto. Los actos personalisimos son aquellos que solo puede realizar el propio obligado.

- **D)** "Actos cuya ejecucion **no se pueda** encargar a otra persona". Falso: el art. 103.1.c) dice "actos cuya ejecucion **pueda** el obligado encargar a otra persona". Anadir el "no" invierte el sentido. Las multas coercitivas proceden precisamente cuando SI se puede encargar a otro (ejecucion subsidiaria como alternativa).

**Trampas:** B cambia la descripcion, C anade "no" a "personalisimos", D anade "no" a "pueda encargar".`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "1bd5c6e7-cd1d-449f-ab22-93ede5501e40");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 art.103 multas (" + exp3.length + " chars)");
})();
