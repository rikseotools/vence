require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.162 Presidente Gobierno recurso inconstitucionalidad
  const exp1 = `**Articulo 162.1.a) de la Constitucion Espanola - Recurso de inconstitucionalidad:**

> "Estan legitimados para interponer el **recurso de inconstitucionalidad**: el **Presidente del Gobierno**, el Defensor del Pueblo, 50 Diputados, 50 Senadores, los organos colegiados ejecutivos de las Comunidades Autonomas y, en su caso, las Asambleas de las mismas."

**Por que B es correcta (recurso de inconstitucionalidad):**
El art. 162.1.a) CE legitima al Presidente del Gobierno para interponer el recurso de inconstitucionalidad ante el Tribunal Constitucional. Es una de las funciones propias del Presidente, no del Rey ni de otros organos.

**Por que las demas son incorrectas (funciones del Rey, no del Presidente):**

- **A)** "La **mas alta representacion** del Estado." Falso: la mas alta representacion del Estado corresponde al **Rey** (art. 56.1 CE: "El Rey es el Jefe del Estado, simbolo de su unidad y permanencia, arbitra y modera el funcionamiento regular de las instituciones, asume la mas alta representacion del Estado"). El Presidente del Gobierno dirige la politica y la Administracion, pero no es la "mas alta representacion".

- **C)** "**Convocar a referendum** en los casos previstos en la Constitucion." Falso: convocar referendums corresponde al **Rey** (art. 62.c CE: "Convocar a referendum en los casos previstos en la Constitucion"). El Presidente propone, pero es el Rey quien convoca formalmente.

- **D)** "**Nombrar y separar** a los miembros del Gobierno." Falso: nombrar y separar a los miembros del Gobierno corresponde al **Rey** (art. 62.e CE: "Nombrar y separar a los miembros del Gobierno, a propuesta de su Presidente"). El Presidente **propone**, pero quien formalmente nombra y separa es el Rey.

**Funciones - Presidente del Gobierno vs Rey:**

| Funcion | Corresponde a |
|---------|--------------|
| **Recurso de inconstitucionalidad** | **Presidente del Gobierno** (art. 162.1.a) |
| Mas alta representacion del Estado | Rey (art. 56.1) |
| Convocar referendum | Rey (art. 62.c) |
| Nombrar/separar miembros Gobierno | Rey, a propuesta del Presidente (art. 62.e) |

**Clave:** Las opciones A, C y D son funciones del Rey (art. 56 y 62 CE). Solo B es funcion propia del Presidente del Gobierno (art. 162.1.a CE).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "de0a6fbf-c619-4cec-aabf-ceb61249d43c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.162 Presidente recurso inconstitucionalidad (" + exp1.length + " chars)");

  // #2 - CE art.55 derechos suspendibles excepción/sitio
  const exp2 = `**Articulo 55.1 de la Constitucion Espanola - Suspension de derechos:**

> "Los derechos reconocidos en los articulos **17** [libertad], **18.2 y 3** [inviolabilidad domicilio y secreto comunicaciones], **19** [circulacion], **20.1.a y d, y 5** [expresion e informacion], **21** [reunion], **28.2** [huelga] y **37.2** [conflicto colectivo] podran ser suspendidos cuando se acuerde la declaracion del estado de **excepcion** o de **sitio**."

**Por que C es correcta (circulacion, expresion, reunion y huelga):**
La opcion C enumera cuatro derechos suspendibles segun el art. 55.1 CE:
- **Libertad de circulacion** (art. 19) - Si, suspendible
- **Libertad de expresion** (art. 20) - Si, suspendible
- **Derecho de reunion** (art. 21) - Si, suspendible
- **Derecho de huelga** (art. 28.2) - Si, suspendible

Los cuatro estan expresamente mencionados en el art. 55.1 CE.

**Por que las demas son incorrectas:**

- **A)** Incluye "derecho de **asociacion**" en lugar de "reunion". Falso: el derecho de asociacion (art. 22 CE) **no** es suspendible. El art. 55.1 menciona el art. 21 (reunion), no el art. 22 (asociacion). No confundir reunion con asociacion.

- **B)** Incluye "libertad de **culto**" en lugar de "circulacion". Falso: la libertad de culto o religiosa (art. 16 CE) **no** es suspendible. El art. 55.1 no menciona el art. 16. Lo que se suspende es la circulacion (art. 19), no el culto.

- **D)** Incluye "derecho de **sindicacion**" en lugar de "huelga". Falso: el derecho de sindicacion (art. 28.1 CE) **no** es suspendible. El art. 55.1 menciona el art. 28 apartado **2** (huelga), no el apartado 1 (sindicacion). Trampa clasica: confundir 28.1 (sindicacion) con 28.2 (huelga).

**Derechos suspendibles (art. 55.1 CE):**

| Articulo | Derecho | Suspendible |
|----------|---------|-------------|
| 17 | Libertad personal | Si |
| 18.2 y 3 | Inviolabilidad domicilio y comunicaciones | Si |
| **19** | **Circulacion** | **Si** |
| **20.1.a,d y 5** | **Expresion e informacion** | **Si** |
| **21** | **Reunion** | **Si** |
| **28.2** | **Huelga** | **Si** |
| 37.2 | Conflicto colectivo | Si |

**Derechos NO suspendibles (trampas habituales):**

| Articulo | Derecho | Suspendible |
|----------|---------|-------------|
| 16 | Libertad religiosa/culto | **No** |
| 22 | Asociacion | **No** |
| 28.1 | Sindicacion | **No** |

**Clave:** Reunion (art. 21) si, asociacion (art. 22) no. Huelga (art. 28.2) si, sindicacion (art. 28.1) no. Circulacion (art. 19) si, culto (art. 16) no.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "08b126e0-ba2a-4885-a585-386c1ec6edf7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.55 derechos suspendibles (" + exp2.length + " chars)");

  // #3 - Excel tabla dinámica formato numérico NO es diseño de informe
  const exp3 = `**Microsoft Excel - Disenos de informe en tablas dinamicas:**

> Excel ofrece **3 disenos de informe** para tablas dinamicas: **Compacto**, **Esquema** y **Tabular**. Los formatos Esquema y Tabular permiten activar "Repetir etiquetas de elementos", generando **5 modos** de visualizacion en total.

**Por que A es la opcion incorrecta (Formato numerico NO es un diseno):**
"Formato numerico" **no es un diseno de informe** de tabla dinamica. El formato numerico es una opcion de **formato de celda** que determina como se muestran los valores (moneda, porcentaje, fecha, numero decimal, etc.). No tiene relacion con la estructura visual del informe.

**Por que las demas SI son disenos de informe:**

- **B)** "Formato **esquema**." **Correcto**: es uno de los 3 disenos. Cada campo de fila aparece en una columna separada con subtotales visibles. Permite activar "Repetir etiquetas de elementos".

- **C)** "Formato **compacto**." **Correcto**: es el diseno **predeterminado** en Excel. Muestra los elementos de diferentes campos de filas en una sola columna. **No** permite repetir etiquetas (de ahi que solo 2 de los 3 formatos generan opciones adicionales).

- **D)** "Formato **tabular**." **Correcto**: es uno de los 3 disenos. Muestra un diseno tradicional de tabla con cada campo en su propia columna. Permite activar "Repetir etiquetas de elementos".

**Los 5 modos de visualizacion:**

| Diseno | Repetir etiquetas | Modo |
|--------|-------------------|------|
| Compacto | No disponible | 1 modo |
| Esquema | Desactivado | 1 modo |
| Esquema | **Activado** | 1 modo |
| Tabular | Desactivado | 1 modo |
| Tabular | **Activado** | 1 modo |
| **Total** | | **5 modos** |

**Acceso:** Herramientas de tabla dinamica > Diseno > Diseno de informe.

**Clave:** Los 3 disenos son Compacto, Esquema y Tabular. "Formato numerico" es formato de celda, no diseno de informe.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "ee5b5647-a903-4374-9660-5b24f70aff56");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Excel tabla dinamica formato numerico (" + exp3.length + " chars)");
})();
