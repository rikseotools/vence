require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.124 reposicion 1 mes
  const exp1 = `**Articulo 124.1 de la Ley 39/2015 (LPAC) - Recurso de reposicion:**

> "El plazo para la interposicion del recurso de reposicion sera de **un mes**, si el acto fuera expreso. Transcurrido dicho plazo, unicamente podra interponerse recurso contencioso-administrativo."

**Por que B es correcta (un mes desde el dia siguiente a la notificacion):**
El art. 124.1 LPAC establece un plazo de **un mes** para interponer el recurso potestativo de reposicion contra actos expresos. El computo comienza el dia siguiente a la notificacion del acto (regla general del art. 30 LPAC).

**Por que las demas son incorrectas:**

- **A)** "Quince dias habiles". Falso: 15 dias no es el plazo de interposicion de ningun recurso administrativo ordinario. En la LPAC, los plazos se expresan en dias habiles, meses o anos, pero el recurso de reposicion es siempre de un mes, no de quince dias.

- **C)** "Tres meses en todos los casos". Falso: tres meses es el plazo de **resolucion** del recurso de **alzada** (art. 122.2), no el de interposicion de la reposicion. La trampa mezcla el plazo de resolucion de un recurso con el de interposicion de otro.

- **D)** "No hay plazo establecido". Falso: el plazo existe y es de un mes (art. 124.1). Si el acto no fuera expreso, el recurso puede interponerse "en cualquier momento" a partir del dia siguiente al silencio, pero eso no significa que no haya plazo, sino que es indefinido para actos presuntos.

**Plazos de interposicion de recursos (LPAC):**

| Recurso | Interposicion | Resolucion |
|---------|---------------|------------|
| Alzada (art. 122) | 1 mes | 3 meses |
| **Reposicion (art. 124)** | **1 mes** | **1 mes** |
| Revision extraordinaria (art. 125) | 4 anos / 3 meses | 3 meses |

**Clave:** Reposicion = 1 mes para interponer (art. 124.1). No confundir con los 3 meses de resolucion de la alzada.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f23bee62-4fb3-4ee6-88e3-c2de2c416f8e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.124 reposicion 1 mes (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.77 valoracion prueba segun LEC
  const exp2 = `**Articulo 77.1 de la Ley 39/2015 (LPAC) - Medios de prueba:**

> "Los hechos relevantes para la decision de un procedimiento podran acreditarse por cualquier medio de prueba admisible en Derecho, cuya valoracion se realizara de acuerdo con los criterios establecidos en la **Ley 1/2000, de 7 de enero, de Enjuiciamiento Civil**."

**Por que D es correcta (Ley de Enjuiciamiento Civil):**
El art. 77.1 LPAC remite expresamente a la **LEC** (Ley 1/2000) para los criterios de valoracion de la prueba en el procedimiento administrativo. La LEC establece reglas como la valoracion libre de la prueba pericial, la fuerza probatoria de los documentos publicos, etc. Esta remision es logica: la LEC es la norma procesal general que contiene el sistema de valoracion de pruebas mas desarrollado.

**Por que las demas son incorrectas:**

- **A)** "Ley 40/2015 de Regimen Juridico del Sector Publico". Falso: la Ley 40/2015 regula la organizacion y funcionamiento de las Administraciones Publicas (organos, relaciones interadministrativas, sector publico institucional), no los criterios de valoracion de la prueba.

- **B)** "El Codigo Civil". Falso: aunque el Codigo Civil contiene algunas normas sobre prueba (como la carga de la prueba en obligaciones), el art. 77.1 LPAC remite a la **LEC**, no al CC. La remision es expresa y no admite interpretacion.

- **C)** "LO 13/2015 de Enjuiciamiento Criminal (LECrim)". Falso: la LECrim regula la prueba en el proceso penal, no en el procedimiento administrativo. La remision del art. 77.1 es a la LEC (procesal civil), no a la LECrim (procesal penal).

**Clave:** Valoracion de prueba en procedimiento administrativo = criterios de la **LEC** (Ley 1/2000). No confundir con Ley 40/2015 (organizacion), Codigo Civil (derecho sustantivo) ni LECrim (proceso penal).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "8c56b6e8-743e-46fd-a872-9b8b3662ba6f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.77 prueba LEC (" + exp2.length + " chars)");

  // #3 - CE art.167.3 referendum reforma 1/10 miembros 15 dias
  const exp3 = `**Articulo 167.3 de la Constitucion Espanola:**

> "Aprobada la reforma por las Cortes Generales, sera sometida a referendum para su ratificacion cuando asi lo soliciten, dentro de los **quince dias** siguientes a su aprobacion, **una decima parte** de los miembros de cualquiera de las Camaras."

**Por que D es correcta (15 dias, 1/10 de los miembros):**
En el procedimiento ordinario de reforma constitucional (art. 167), el referendum NO es obligatorio: solo se celebra si lo solicita una **decima parte** (1/10) de los miembros de cualquiera de las Camaras, dentro de los **15 dias** siguientes a la aprobacion. Sin solicitud, la reforma se promulga directamente.

**Por que las demas son incorrectas:**

- **A)** "En todos los casos". Falso: el referendum obligatorio en todos los casos es propio de la **reforma agravada** del art. **168** CE (que afecta al Titulo Preliminar, derechos fundamentales o la Corona). En la reforma ordinaria (art. 167), el referendum es **potestativo**: solo si lo piden 1/10 de los miembros.

- **B)** "20 dias, 50 diputados o 50 senadores". Doblemente falso: (1) el plazo es **15 dias**, no 20; (2) el requisito es una **decima parte de los miembros** de cualquiera de las Camaras (35 diputados o ~26 senadores), no un numero fijo de 50. La trampa cambia tanto el plazo como la forma de expresar el quorum.

- **C)** "15 dias, dos quintos de los miembros". Falso: el plazo es correcto (15 dias), pero la proporcion es incorrecta. El art. 167.3 exige **una decima parte** (1/10 = 10%), no **dos quintos** (2/5 = 40%). La trampa cuadruplica la proporcion necesaria.

**Reforma ordinaria vs agravada:**

| Aspecto | Art. 167 (ordinaria) | Art. 168 (agravada) |
|---------|---------------------|---------------------|
| Referendum | Potestativo (si lo pide 1/10) | **Obligatorio** siempre |
| Plazo solicitud | 15 dias | No aplica (siempre) |
| Materias | Las no cubiertas por art. 168 | Titulo Preliminar, Seccion 1.a Cap. II Titulo I, Titulo II |

**Clave:** Art. 167.3 = 15 dias + 1/10 de los miembros. Referendum potestativo (no en todos los casos). No confundir con art. 168 (obligatorio).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "98c163d3-fc6f-49a3-bf30-e6e3f63b8826");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.167.3 referendum 1/10 (" + exp3.length + " chars)");
})();
