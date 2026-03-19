require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TREBEP art.16.3.c promocion interna vertical
  const exp1 = `**Articulo 16.3.c) del RDL 5/2015 (TREBEP):**

> "Promocion interna vertical, que consiste en el **ascenso desde un cuerpo o escala de un Subgrupo**, o Grupo de clasificacion profesional en el supuesto de que este no tenga Subgrupo, **a otro superior**, de acuerdo con lo establecido en el articulo 18."

**Por que A es correcta (promocion interna vertical):**
La promocion interna vertical es la unica modalidad que implica **cambiar de Subgrupo a uno superior** (ej: de C1 a A2). Requiere superar los procesos selectivos correspondientes (art. 18 TREBEP).

**Por que las demas son incorrectas:**

- **B)** "Promocion interna horizontal". Falso: la promocion interna horizontal (art. 16.3.d) consiste en acceder a cuerpos o escalas **del mismo Subgrupo**, no a uno superior. Es un movimiento lateral, no ascendente.

- **C)** "Carrera vertical". Falso: la carrera vertical (art. 16.3.b) consiste en el ascenso en la **estructura de puestos de trabajo** (ej: pasar de un puesto de nivel 18 a uno de nivel 22). No implica cambiar de Subgrupo ni de cuerpo.

- **D)** "Carrera horizontal". Falso: la carrera horizontal (art. 16.3.a) es la progresion de grado/escalon **sin cambiar de puesto de trabajo**. No implica ningun ascenso de Subgrupo.

**Las 4 modalidades y sus claves:**

| Modalidad | Clave | Sube de Subgrupo? |
|-----------|-------|-------------------|
| **Promocion interna vertical** | Subgrupo inferior a **superior** | **SI** |
| Promocion interna horizontal | Cuerpo del **mismo** Subgrupo | NO |
| Carrera vertical | Ascenso en **puestos de trabajo** | NO |
| Carrera horizontal | Progresion **sin cambiar de puesto** | NO |

**Clave:** "Ascenso de un Subgrupo a otro superior" = **promocion interna vertical**. Es la unica que implica subir de grupo de clasificacion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a12f044c-3131-4ef6-aafe-fec6c83ddfd9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP prom. interna vertical (" + exp1.length + " chars)");

  // #2 - Ley 19/2013 art.18 inadmision solicitudes (senale incorrecta)
  const exp2 = `**Articulo 18.1 de la Ley 19/2013** (Causas de inadmision de solicitudes de acceso):

**Por que C es la incorrecta (y por tanto la respuesta correcta):**

La opcion C dice: "Cuando se dirijan a un organo en cuyo poder no obre la informacion **cuando se conozca el competente**."

Pero el art. 18.1.d) dice exactamente lo contrario:

> "Dirigidas a un organo en cuyo poder no obre la informacion **cuando se DESCONOZCA el competente** para la resolucion."

Si se **conoce** el organo competente, la solicitud NO se inadmite sino que se **remite** a ese organo (art. 18.2). La opcion C cambia "desconozca" por "conozca", invirtiendo el sentido de la norma.

**Por que las demas SI son causas validas de inadmision (y por tanto no son la respuesta):**

- **A)** "Repetitivas o abusivas". **Correcto como causa de inadmision**: art. 18.1.e) "Que sean manifiestamente repetitivas o tengan un caracter abusivo no justificado con la finalidad de transparencia de esta Ley."

- **B)** "Informacion auxiliar o de apoyo". **Correcto como causa de inadmision**: art. 18.1.b) "Referidas a informacion que tenga caracter auxiliar o de apoyo como la contenida en notas, borradores, opiniones, resumenes, comunicaciones e informes internos."

- **D)** "Informacion en curso de elaboracion o publicacion". **Correcto como causa de inadmision**: art. 18.1.a) "Que se refieran a informacion que este en curso de elaboracion o de publicacion general."

**Causas de inadmision del art. 18.1:**
a) En curso de elaboracion/publicacion
b) Auxiliar o de apoyo (notas, borradores...)
c) Que requiera reelaboracion previa
d) Organo sin la informacion y **se desconozca** el competente
e) Repetitivas o abusivas

**Clave:** La trampa esta en cambiar **"desconozca"** por "conozca". Si se conoce el competente, se remite; si se desconoce, se inadmite.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7e267a49-1bee-4c1d-a165-73be458abeeb");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 19/2013 inadmision (" + exp2.length + " chars)");

  // #3 - CE art.167 vs 168 reforma constitucional
  const exp3 = `**Articulos 167 y 168 de la Constitucion Espanola** (Reforma constitucional):

El art. **168** (procedimiento agravado) se aplica cuando la reforma afecta a:
- **Titulo Preliminar** (arts. 1-9)
- **Seccion 1a, Capitulo 2o, Titulo I** (derechos fundamentales, arts. 15-29)
- **Titulo II** (la Corona, arts. 56-65)
- **Revision total** de la CE

Todo lo demas se reforma por el art. **167** (procedimiento ordinario).

**Por que D es correcta (sistema de CCAA = art. 167):**
El sistema de Comunidades Autonomas esta en el **Titulo VIII** (arts. 137-158), que NO esta protegido por el art. 168. Por tanto, su modificacion se tramita por el procedimiento **ordinario** del art. 167.

**Por que las demas son incorrectas (todas requieren art. 168):**

- **A)** "La bandera de Espana". Requiere art. **168**: la bandera se regula en el **art. 4 CE**, que pertenece al **Titulo Preliminar** (protegido por art. 168).

- **B)** "El orden de sucesion a la Corona". Requiere art. **168**: la sucesion se regula en el **art. 57 CE**, que pertenece al **Titulo II** (la Corona, protegido por art. 168).

- **C)** "La aconfesionalidad del Estado". Requiere art. **168**: la aconfesionalidad se regula en el **art. 16.3 CE**, que pertenece a la **Seccion 1a del Capitulo 2o del Titulo I** (derechos fundamentales, protegida por art. 168).

**Procedimientos de reforma:**

| Procedimiento | Art. CE | Que protege | Mayoria |
|---------------|---------|-------------|---------|
| **Agravado** | 168 | T. Preliminar + Sec.1a Cap.2o T.I + T.II | 2/3 + disolucion + referendum obligatorio |
| **Ordinario** | 167 | Todo lo demas | 3/5 + referendum facultativo |

**Clave:** CCAA (Titulo VIII) = art. **167** (ordinario). Bandera (T.Preliminar), Corona (T.II), derechos fundamentales (Sec.1a) = art. **168** (agravado).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "3fb8b8ce-8859-4b8a-9dd8-13517d742943");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE 167 vs 168 reforma (" + exp3.length + " chars)");
})();
