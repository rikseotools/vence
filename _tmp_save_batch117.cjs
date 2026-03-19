require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.22 derecho asociacion judicial no administrativa
  const exp1 = `**Articulo 22.4 de la Constitucion Espanola:**

> "Las asociaciones solo podran ser disueltas o suspendidas en sus actividades en virtud de **resolucion judicial** motivada."

**Por que C es la INCORRECTA (y por tanto la respuesta):**
La opcion C dice "resolucion **administrativa** motivada", pero el art. 22.4 CE dice "resolucion **judicial** motivada". Esta es una garantia fundamental: solo un **juez** puede disolver o suspender una asociacion, nunca la Administracion. La trampa consiste en sustituir "judicial" por "administrativa", un cambio de una sola palabra que altera completamente el sentido.

**Por que las demas SI son correctas (reproducen fielmente el art. 22):**

- **A)** "Las asociaciones que persigan fines o utilicen medios tipificados como delito son ilegales". **SI**: art. 22.2 CE. Es la definicion de asociacion ilegal.

- **B)** "Se recoge en el articulo 22". **SI**: el derecho de asociacion esta en el art. 22 CE, dentro de la Seccion 1a del Capitulo II del Titulo I (derechos fundamentales protegidos por recurso de amparo).

- **D)** "Se prohiben las asociaciones secretas". **SI**: art. 22.5 CE. Se prohiben las asociaciones secretas y las de caracter paramilitar.

**Contenido completo del art. 22 CE:**
1. Se reconoce el derecho de asociacion
2. Asociaciones con fines/medios delictivos = **ilegales**
3. Inscripcion en registro a los solos efectos de **publicidad**
4. Disolucion/suspension solo por resolucion **judicial** motivada
5. Se prohiben asociaciones **secretas** y **paramilitares**

**Clave:** Judicial, no administrativa. Solo un juez disuelve o suspende asociaciones.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "27290fdb-3be5-4405-b666-8955e680d972");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.22 asociacion judicial (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.14 obligados medios electronicos personas fisicas
  const exp2 = `**Articulo 14 de la Ley 39/2015:**

> Art. 14.1: "Las **personas fisicas** podran **elegir** en todo momento si se comunican con las Administraciones Publicas [...] a traves de medios electronicos o no [...]"

> Art. 14.2: "En todo caso, estaran **obligados** a relacionarse a traves de medios electronicos: a) Las personas juridicas. b) Las entidades sin personalidad juridica. c) Quienes ejerzan una actividad profesional para la que se requiera colegiacion obligatoria [...]. d) Quienes representen a un interesado que este obligado a relacionarse electronicamente [...]"

**Por que D es la INCORRECTA (y por tanto la respuesta):**
Las **personas fisicas** no estan obligadas a usar medios electronicos. Segun el art. 14.1, pueden **elegir** libremente entre via electronica o presencial. Este es un derecho, no una obligacion. La ley protege a las personas fisicas que puedan tener dificultades con la tecnologia (personas mayores, zonas rurales sin acceso, etc.).

**Por que las demas SI son correctas (obligados del art. 14.2):**

- **A)** "Quienes representen a un interesado que este obligado a relacionarse electronicamente". **SI**: art. 14.2.d). Si el representado esta obligado, el representante tambien lo esta.

- **B)** "Las entidades sin personalidad juridica". **SI**: art. 14.2.b). Comunidades de bienes, herencias yacentes, sociedades civiles sin inscribir, etc.

- **C)** "Quienes ejerzan una actividad profesional para la que se requiera colegiacion obligatoria, para los tramites en ejercicio de dicha actividad profesional". **SI**: art. 14.2.c). Abogados, medicos, arquitectos, etc., cuando actuan en ejercicio profesional.

**Obligados a via electronica (art. 14.2):**
- Personas **juridicas** (sociedades, fundaciones, etc.)
- Entidades **sin personalidad juridica**
- Profesionales **colegiados** (en ejercicio profesional)
- **Representantes** de obligados
- Empleados de las AAPP (para tramites con su Administracion)

**Clave:** Personas fisicas = eligen libremente. Personas juridicas, entidades, colegiados y representantes = obligados.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a5864751-8d90-4a49-a409-0a2b5098032f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.14 electronicos (" + exp2.length + " chars)");

  // #3 - CE art.55 derechos suspendibles libertad art.17
  const exp3 = `**Articulo 55.1 de la Constitucion Espanola:**

> "Los derechos reconocidos en los articulos **17** [libertad], **18** apartados 2 y 3 [inviolabilidad domicilio y secreto comunicaciones], **19** [libre circulacion], **20** apartados 1.a) y d) y 5 [expresion e informacion], **21** [reunion], **28** apartado 2 [huelga] y **37** apartado 2 [medidas de conflicto colectivo] podran ser suspendidos cuando se acuerde la declaracion del estado de excepcion o de sitio."

**Por que C es correcta (derecho a la libertad):**
El derecho a la libertad esta en el **art. 17 CE**, que aparece expresamente en la lista del art. 55.1 como derecho suspendible en estados de excepcion o sitio. Al suspenderse, se permite la detencion por plazos mas amplios que los ordinarios.

**Por que las demas NO son suspendibles:**

- **A)** "El derecho de asociacion" (art. 22 CE). Falso: el art. 22 **no aparece** en la lista del art. 55.1. Las asociaciones no se pueden disolver ni suspender por estado de excepcion; solo por resolucion judicial (art. 22.4).

- **B)** "El derecho a la tutela judicial efectiva" (art. 24 CE). Falso: el art. 24 **no aparece** en la lista del art. 55.1. La tutela judicial efectiva es un derecho que **nunca** se suspende, ni en estado de sitio. Es la garantia ultima del Estado de Derecho.

- **D)** "El derecho a la intimidad personal y familiar" (art. 18.1 CE). Falso: del art. 18, solo se suspenden los **apartados 2 y 3** (inviolabilidad del domicilio y secreto de las comunicaciones). El **apartado 1** (intimidad, honor, propia imagen) **no se suspende**.

**Derechos suspendibles (art. 55.1 CE) - memorizacion:**

| Articulo | Derecho |
|----------|---------|
| **17** | Libertad y seguridad |
| **18.2 y 18.3** | Inviolabilidad domicilio + secreto comunicaciones |
| **19** | Libre circulacion |
| **20.1.a), d) y 5** | Expresion, informacion y secuestro publicaciones |
| **21** | Reunion y manifestacion |
| **28.2** | Huelga |
| **37.2** | Medidas de conflicto colectivo |

**Clave:** Intimidad (18.1) NO se suspende; domicilio (18.2) y comunicaciones (18.3) SI. Asociacion (22) y tutela judicial (24) NUNCA se suspenden.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "5b0fbeff-75f0-4c63-8bb1-ba54c157a449");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.55 derechos suspendibles (" + exp3.length + " chars)");
})();
