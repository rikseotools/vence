require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.151.1 municipios 3/4 para vía especial autonómica
  const exp1 = `**Articulo 151.1 de la Constitucion Espanola - Via rapida de acceso a la autonomia:**

> "No sera preciso dejar transcurrir el plazo de cinco anos [...] cuando la iniciativa del proceso autonomico sea acordada [...] por las **tres cuartas partes** de los municipios de cada una de las provincias afectadas que representen, al menos, la **mayoria del censo electoral** de cada una de ellas y dicha iniciativa sea ratificada mediante **referendum** por el voto afirmativo de la mayoria absoluta de los electores de cada provincia."

**Por que C es correcta (3/4 de los municipios):**
El art. 151.1 CE exige que la iniciativa autonomica por la via rapida cuente con el respaldo de las **tres cuartas partes** (3/4) de los municipios de cada provincia afectada. Ademas, esos municipios deben representar al menos la mayoria del censo electoral. Este doble requisito (3/4 de municipios + mayoria censal) se complementa con un referendum de ratificacion.

**Por que las demas son incorrectas (fracciones equivocadas):**

- **A)** "**3/5** de los municipios." Falso: 3/5 no es la proporcion del art. 151.1. El articulo exige 3/4, una mayoria mas cualificada. 3/5 no aparece en este contexto constitucional.

- **B)** "**1/3** de los municipios." Falso: 1/3 es una fraccion muy inferior a la requerida. El art. 151.1 exige 3/4, mas del doble de 1/3. Con solo un tercio de municipios no se cumpliria el requisito.

- **D)** "**2/3** de los municipios." Falso: aunque 2/3 es una mayoria cualificada, el art. 151.1 exige 3/4 (75%), no 2/3 (66,6%). La diferencia es significativa: 3/4 es un umbral superior a 2/3.

**Requisitos del art. 151.1 CE (via especial):**

| Requisito | Detalle |
|-----------|---------|
| Municipios | **3/4** de cada provincia |
| Censo | Mayoria del censo electoral de cada provincia |
| Referendum | Mayoria absoluta de electores de cada provincia |
| Plazo | No es necesario esperar los 5 anos del art. 148.2 |

**Clave:** Via rapida = **3/4** de los municipios + mayoria del censo + referendum. No confundir con 2/3, 3/5 ni 1/3.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7e47a5d0-51df-45a7-8ed2-39d983a586a7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.151 municipios 3/4 (" + exp1.length + " chars)");

  // #2 - Ley 7/1985 art.32 organización provincial órganos de estudio
  const exp2 = `**Articulo 32 de la Ley 7/1985 (LBRL) - Organizacion provincial:**

> Art. 32.2: "Asimismo, **existiran** en todas las Diputaciones organos que tengan por objeto el estudio, informe o consulta de los asuntos que han de ser sometidos a la decision del Pleno, asi como el seguimiento de la gestion del Presidente, la Junta de Gobierno y los Diputados que ostenten delegaciones, **siempre que la respectiva legislacion autonomica no prevea una forma organizativa distinta** en este ambito."

**Por que C es correcta:**
La opcion C reproduce fielmente el art. 32.2 LBRL: estos organos "**existiran**" (obligatoriamente) en todas las Diputaciones, con la salvedad de que la legislacion autonomica prevea una organizacion distinta. Es una norma imperativa con excepcion autonomica.

**Por que las demas son incorrectas:**

- **A)** "Las Diputaciones **podran establecer y regular** organos [...]" Falso: el art. 32.2 dice "existiran", no "podran establecer". La diferencia es clave: "existiran" es imperativo (deben existir), "podran establecer" es potestativo (pueden o no). Ademas, la coletilla "sin perjuicio de que las CCAA puedan establecer una organizacion provincial complementaria" no corresponde al texto del art. 32.2.

- **B)** "En todas las Diputaciones **podran existir** organos [...]" Falso: "podran existir" convierte la obligacion en facultad. El art. 32.2 dice "existiran" (obligatorio), no "podran existir" (opcional). Aunque el resto del texto coincide, cambiar "existiran" por "podran existir" altera completamente el sentido.

- **D)** "**Cuando la legislacion autonomica asi lo establezca**, existiran organos [...]" Falso: invierte la condicion. El art. 32.2 dice que existiran **siempre que la legislacion autonomica NO prevea** otra forma. La opcion D condiciona su existencia a que la CCAA lo disponga, cuando en realidad existen por defecto y solo desaparecen si la CCAA establece algo distinto.

**Organizacion provincial obligatoria (art. 32 LBRL):**

| Organo | Base legal |
|--------|-----------|
| Presidente | Art. 32.1 |
| Vicepresidentes | Art. 32.1 |
| Junta de Gobierno | Art. 32.1 |
| Pleno | Art. 32.1 |
| Organos de estudio/seguimiento | Art. 32.2 (salvo CCAA en contra) |

**Clave:** "Existiran" (imperativo), no "podran existir" (potestativo). La excepcion es que la CCAA prevea otra organizacion, no que la CCAA lo autorice.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "bc33944e-b03c-4de9-90d6-626993bc6421");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 7/1985 art.32 organizacion provincial (" + exp2.length + " chars)");

  // #3 - Word "Diferente primera página" en Configurar página > Disposición
  const exp3 = `**Word - Casilla "Diferente primera pagina" en Configurar pagina > Disposicion:**

**Por que D es correcta (encabezado y pie distintos solo para la primera pagina de la seccion activa):**
Al activar "Diferente primera pagina" en la pestana Disposicion del cuadro de dialogo Configurar pagina, Word permite definir un **encabezado** y un **pie de pagina** independientes para la primera pagina de la seccion actual. El resto de paginas de esa seccion mantienen su propio encabezado/pie. Esto es util, por ejemplo, para que la portada no muestre numeracion o tenga un diseno diferente.

**Aspecto clave:** El efecto se limita a la **seccion activa**, no a todo el documento. Si el documento tiene varias secciones, cada una puede tener su propia configuracion de primera pagina.

**Por que las demas son incorrectas:**

- **A)** "Crea un **salto de pagina** automatico al inicio del documento." Falso: esta casilla no crea saltos de pagina. Solo afecta a los encabezados y pies de pagina. Los saltos de pagina se insertan desde el menu Insertar o con Ctrl+Intro.

- **B)** "Se suprime la **numeracion** en la primera pagina." Falso: la casilla no suprime automaticamente la numeracion. Lo que hace es permitir un encabezado/pie distinto. Si se quiere quitar la numeracion de la primera pagina, hay que dejar en blanco el pie de esa primera pagina despues de activar la casilla.

- **C)** "Aplica un formato de encabezado distinto en **todo el documento**." Falso: no afecta a "todo el documento", sino solo a la **primera pagina de la seccion activa**. Ademas, no aplica un formato automaticamente; solo habilita la posibilidad de personalizar esa primera pagina de forma independiente.

**Acceso a la opcion:**
- Pestana **Disposicion** > seccion **Encabezados y pies de pagina** > casilla **"Diferente primera pagina"**
- Tambien accesible desde la pestana Diseno de Herramientas de encabezado y pie de pagina

**Clave:** "Diferente primera pagina" = encabezado y pie independientes para la primera pagina de la seccion, no de todo el documento.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "868dbbdb-4dcf-4ed0-83b0-ec727225c1bd");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Word diferente primera pagina (" + exp3.length + " chars)");
})();
