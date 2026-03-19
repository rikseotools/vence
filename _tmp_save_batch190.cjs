require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/2018 derecho de reposición NO existe en protección de datos
  const exp1 = `**Derechos reconocidos en la LO 3/2018 (LOPDGDD) y el RGPD:**

**Por que A es la respuesta (derecho de reposicion NO existe):**
El "derecho de **reposicion**" no existe en la normativa de proteccion de datos. "Reposicion" es un termino del Derecho Administrativo (recurso de reposicion, art. 123 Ley 39/2015), no de proteccion de datos. La LO 3/2018 y el RGPD no reconocen ningun derecho con este nombre.

**Por que las demas SI son derechos reconocidos:**

- **B)** "Derecho de **rectificacion**." **Correcto**: el art. 14 LO 3/2018 desarrolla el derecho de rectificacion del art. 16 RGPD. Permite al interesado que se corrijan datos personales inexactos o se completen los incompletos.

- **C)** "Derecho a la **portabilidad**." **Correcto**: el art. 17 LO 3/2018 desarrolla el derecho a la portabilidad del art. 20 RGPD. Permite al interesado recibir sus datos en formato estructurado y transmitirlos a otro responsable.

- **D)** "Derecho a la **limitacion del tratamiento**." **Correcto**: el art. 16 LO 3/2018 desarrolla el derecho a la limitacion del art. 18 RGPD. Permite que el tratamiento de los datos quede suspendido temporalmente en determinadas circunstancias.

**Derechos ARCOPOL (LO 3/2018 / RGPD):**

| Derecho | Art. LO 3/2018 | Art. RGPD |
|---------|----------------|-----------|
| **A**cceso | Art. 13 | Art. 15 |
| **R**ectificacion | Art. 14 | Art. 16 |
| **C**ancelacion (supresion/olvido) | Art. 15 | Art. 17 |
| **O**posicion | Art. 18 | Art. 21 |
| **P**ortabilidad | Art. 17 | Art. 20 |
| **O**lvido digital | Art. 93-94 | - |
| **L**imitacion del tratamiento | Art. 16 | Art. 18 |

**Clave:** "Reposicion" no existe en proteccion de datos. No confundir con el recurso administrativo de reposicion. Los derechos del interesado son: acceso, rectificacion, supresion, oposicion, portabilidad y limitacion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8a886483-f737-4cdc-be28-d2575a733fde");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/2018 reposicion no existe (" + exp1.length + " chars)");

  // #2 - CE art.167.1 reforma constitucional mayoría 3/5 de cada Cámara
  const exp2 = `**Articulo 167.1 de la Constitucion Espanola - Reforma constitucional ordinaria:**

> "Los proyectos de reforma constitucional deberan ser aprobados por una mayoria de **tres quintos** de **cada una de las Camaras**."

**Por que B es correcta (3/5 de cada Camara):**
El art. 167.1 CE exige una mayoria de **tres quintos** (3/5 = 60%) en **ambas** Camaras (Congreso y Senado) para aprobar una reforma constitucional por el procedimiento ordinario. Este procedimiento se aplica a los articulos no protegidos por el art. 168.

**Por que las demas son incorrectas:**

- **A)** "Mayoria de **dos tercios** de cada una de las Camaras." Falso: dos tercios (2/3) es la mayoria que exige el art. **168** CE para la reforma agravada (Titulo Preliminar, Seccion 1.a del Capitulo II del Titulo I, y Titulo II). El art. 167 exige tres quintos, no dos tercios. Ademas, 2/3 del Congreso es una mayoria subsidiaria del art. 167.2.

- **C)** "Mayoria de tres quintos del **Congreso de los Diputados**." Falso: acierta en la mayoria (3/5), pero solo menciona el Congreso. El art. 167.1 exige 3/5 de **cada una de las Camaras**, es decir, tanto del Congreso como del Senado. Ambas Camaras deben aprobar.

- **D)** "Mayoria de dos tercios del **Congreso de los Diputados**." Falso por dos razones: (1) la mayoria es 3/5, no 2/3; (2) se exige en ambas Camaras, no solo en el Congreso. Los 2/3 del Congreso solo aparecen como mayoria subsidiaria si el Senado aprobo por mayoria absoluta (art. 167.2).

**Reforma constitucional - Mayorias:**

| Procedimiento | Articulo | Mayoria | Camaras |
|---------------|----------|---------|---------|
| **Ordinario** | **167.1** | **3/5** | **Ambas** |
| Subsidiario | 167.2 | 2/3 Congreso + MA Senado | Ambas |
| **Agravado** | **168** | **2/3** | **Ambas** + disolucion + referendum |

**Clave:** Art. 167 = 3/5 de cada Camara. Art. 168 = 2/3 de cada Camara + disolucion + referendum. No confundir ambos procedimientos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "cef5b550-3752-4774-9aaf-c20fd3d2e673");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.167 reforma 3/5 (" + exp2.length + " chars)");
})();
