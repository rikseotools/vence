require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 47/2003 art.40 clasificacion economica capitulos articulos conceptos subconceptos
  const exp1 = `**Articulo 40.1.b) de la Ley 47/2003 (LGP) - Clasificacion economica:**

> "La clasificacion economica agrupara los creditos por **capitulos** separando las operaciones corrientes, las de capital, las financieras y el Fondo de Contingencia. Los capitulos se desglosaran en **articulos** y estos, a su vez, en **conceptos** que podran dividirse en **subconceptos**."

**Por que C es correcta:**
El orden jerarquico de la clasificacion economica es: **Capitulos > Articulos > Conceptos > Subconceptos**. La opcion C reproduce fielmente esta jerarquia: "capítulos, que se desglosarán en artículos y estos, a su vez, en conceptos que podrán dividirse en subconceptos."

**Por que las demas son incorrectas (alteran el orden jerarquico):**

- **A)** Dice "agrupa por **conceptos** > subconceptos > **capitulos** > articulos". Invierte completamente la jerarquia: pone los conceptos arriba (cuando son el tercer nivel) y los capitulos abajo (cuando son el primer nivel).

- **B)** Dice "agrupa por **conceptos** > subconceptos > **articulos** > capitulos". Tambien invierte la jerarquia, empezando por conceptos en vez de capitulos.

- **D)** Dice "agrupa por **articulos** > capitulos > conceptos > subconceptos". Empieza por articulos (segundo nivel) en vez de capitulos (primer nivel), e invierte los dos primeros escalones.

**Clasificaciones del presupuesto de gastos (art. 40 LGP):**

| Clasificacion | Niveles |
|---------------|---------|
| Organica | Secciones > Servicios |
| Funcional | Areas > Politicas > Grupos > Programas > Subprogramas |
| **Economica** | **Capitulos > Articulos > Conceptos > Subconceptos** |

**Clave:** Capitulos > Articulos > Conceptos > Subconceptos. De mayor a menor. Los capitulos separan operaciones corrientes, de capital, financieras y Fondo de Contingencia.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c04233a9-f048-43e1-bae0-fbf92f21ade9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LGP art.40 clasificacion economica (" + exp1.length + " chars)");

  // #2 - LO 3/1981 Defensor del Pueblo funcion NO atribuida salvo ambito militar
  const exp2 = `**Funciones del Defensor del Pueblo (LO 3/1981):**

El Defensor del Pueblo tiene atribuidas, entre otras, las siguientes funciones:
> - Dirigir al Ministerio Fiscal quejas sobre la Administracion de Justicia (art. 13)
> - Interponer recursos de inconstitucionalidad y de amparo (art. 29)
> - Supervisar la actividad de las CCAA y coordinar con sus homologos (art. 12)
> - Velar por los derechos del Titulo I **incluso en el ambito de la Administracion Militar** (art. 14)

**Por que D es la opcion NO atribuida (y por tanto la respuesta):**
La opcion D dice "la defensa de los derechos del Titulo I, **salvo en el ambito militar**". Esto es falso. El art. **14** de la LO 3/1981 establece expresamente que el Defensor del Pueblo **SI** vela por los derechos en el ambito militar:

> "El Defensor del Pueblo velara por el respeto de los derechos proclamados en el Titulo I de la Constitucion, **en el ambito de la Administracion Militar**, sin que ello pueda entranar una interferencia en el mando de la Defensa Nacional."

La trampa anade "salvo en el ambito militar" cuando la ley dice exactamente lo contrario: el Defensor actua **tambien** en lo militar.

**Por que las demas SI son funciones correctas:**

- **A)** Dirigir quejas al Ministerio Fiscal sobre la Administracion de Justicia: **SI**, art. **13** LO 3/1981. El Defensor no puede investigar directamente a la Justicia, pero traslada las quejas al MF o al CGPJ.

- **B)** Interponer recursos de inconstitucionalidad y amparo: **SI**, art. **29** LO 3/1981 y art. 162 CE. Es una de las legitimaciones mas importantes del Defensor.

- **C)** Supervisar la actividad de las CCAA y coordinar con figuras autonomicas: **SI**, art. **12** LO 3/1981. El Defensor puede supervisar de oficio o a instancia de parte.

**Clave:** El Defensor del Pueblo SI actua en el ambito militar (art. 14). La opcion que dice "salvo en el ambito militar" es falsa.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "75ff2ee4-d51f-4e86-ba16-091936df0df0");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 Defensor ambito militar (" + exp2.length + " chars)");

  // #3 - LBRL art.7 delegacion Estado Y CCAA no solo CCAA
  const exp3 = `**Articulo 7.3 de la Ley 7/1985 (LBRL) - Delegacion de competencias:**

> "**El Estado y las Comunidades Autonomas**, en el ejercicio de sus respectivas competencias, podran delegar en las Entidades Locales el ejercicio de sus competencias."

**Por que C es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion C dice "**Solo las Comunidades Autonomas** [...] podran delegar en las Entidades Locales". Esto es falso porque el art. 7.3 LBRL dice "**El Estado y las Comunidades Autonomas**". Ambas administraciones pueden delegar, no solo las CCAA. La trampa elimina al Estado como delegante.

**Por que las demas SI son correctas:**

- **A)** Las Entidades Locales pueden ejercer competencias distintas de las propias y delegadas cuando no pongan en riesgo la sostenibilidad financiera ni supongan ejecucion simultanea del mismo servicio. **SI**: esto reproduce el art. 7.**4** LBRL, que regula las competencias "distintas de las propias" (antes llamadas "impropias").

- **B)** Las competencias delegadas prevén tecnicas de direccion y control de oportunidad y eficiencia. **SI**: el art. 7.**3** LBRL establece que la delegacion "debera prever tecnicas de direccion y control de oportunidad y eficiencia".

- **D)** Las competencias propias solo podran ser determinadas por Ley. **SI**: el art. 7.**2** LBRL establece que las competencias propias "solo podran ser determinadas por Ley" y se ejercen en regimen de autonomia y bajo la propia responsabilidad.

**Tipos de competencias locales (art. 7 LBRL):**

| Tipo | Regulacion |
|------|------------|
| Propias | Determinadas por **Ley** (art. 7.2) |
| Delegadas | Por **Estado y CCAA** con control (art. 7.3) |
| Distintas | Con sostenibilidad financiera y sin duplicidad (art. 7.4) |

**Clave:** Delegacion = Estado **Y** CCAA (no solo CCAA). La trampa elimina al Estado del art. 7.3.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2cdf78f0-c743-48cb-b05a-880c5a64be82");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LBRL art.7 delegacion Estado y CCAA (" + exp3.length + " chars)");
})();
