require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.113.3 mocion de censura mociones alternativas 2 dias
  const exp1 = `**Articulo 113.3 de la Constitucion Espanola:**

> "La mocion de censura no podra ser votada hasta que transcurran **cinco dias** desde su presentacion. En los **dos primeros dias** de dicho plazo podran presentarse **mociones alternativas**."

**Por que D es correcta:**
El art. 113.3 CE establece un plazo de 5 dias antes de votar la mocion, y durante los **2 primeros dias** de ese plazo se pueden presentar mociones alternativas. Esto permite que otros grupos parlamentarios propongan sus propios candidatos alternativos a Presidente del Gobierno.

**Por que las demas son incorrectas:**

- **A)** "Debera votarse en el plazo maximo de **cinco dias** desde su presentacion". Falso: invierte el sentido del plazo. Los 5 dias son un plazo **minimo** de espera ("no podra ser votada **hasta que** transcurran cinco dias"), no un plazo maximo. La votacion debe celebrarse **despues** de los 5 dias, no antes.

- **B)** "No cabe presentar mociones alternativas hasta que no se resuelva la mocion ya presentada". Falso: es exactamente lo contrario. El art. 113.3 permite presentar mociones alternativas durante los 2 primeros dias. El sistema constitucional permite la competencia entre candidatos alternativos.

- **C)** "Debera votarse una vez transcurridos **diez dias**". Falso: el plazo es de **5 dias**, no de 10. Diez dias es un plazo inventado que no aparece en el art. 113.

**Plazos de la mocion de censura (art. 113 CE):**
- Proponentes: al menos **1/10** de los Diputados
- Debe incluir un **candidato** a Presidente
- Plazo minimo antes de votar: **5 dias**
- Mociones alternativas: en los **2 primeros dias**
- Aprobacion: **mayoria absoluta** del Congreso

**Clave:** 5 dias de espera (minimo, no maximo) + 2 primeros dias para alternativas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "389f6a6e-8b54-4335-b602-c0fcea021a52");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.113.3 mocion censura (" + exp1.length + " chars)");

  // #2 - RD 203/2021 art.6 creacion portal contenido minimo
  const exp2 = `**Articulo 6.2 del RD 203/2021:**

> "El acto o resolucion de creacion de un nuevo portal contendra, al menos: a) La **identificacion** de su direccion electronica, que debera incluir el nombre de dominio de segundo nivel '.gob.es'. b) Su **ambito funcional** y, en su caso, organico. c) La **finalidad** para la que se crea."

**Por que C es la incorrecta (y por tanto la respuesta):**
La opcion C dice "Los requisitos previos necesarios para la **identificacion como usuario**". Esto NO aparece en el art. 6.2 como contenido minimo del acto de creacion de un portal. El art. 6.2 solo exige tres elementos: direccion electronica con .gob.es, ambito funcional/organico y finalidad.

Los requisitos de identificacion de usuarios son propios de las **sedes electronicas** (donde se realizan tramites), no de los portales de internet en general (que son informativos).

**Por que las demas SI estan en el art. 6.2:**

- **A)** "Identificacion de su direccion electronica, con dominio '.gob.es'". **SI**: es la letra a) del art. 6.2. Todos los portales publicos estatales deben tener dominio .gob.es.

- **B)** "Su ambito funcional y, en su caso, organico". **SI**: es la letra b) del art. 6.2. Hay que especificar a que se dedica el portal y que organo lo gestiona.

- **D)** "La finalidad para la que se crea". **SI**: es la letra c) del art. 6.2. Todo portal debe explicar para que se crea.

**Contenido minimo del acto de creacion de un portal (art. 6.2):**
1. **Direccion electronica** con dominio .gob.es
2. **Ambito funcional** (y organico)
3. **Finalidad**

**Clave:** Los requisitos de identificacion de usuarios NO son contenido minimo del acto de creacion de un portal. Eso es propio de sedes electronicas, no de portales.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "76de1af6-7768-4388-91ea-27a8fcea262a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 203/2021 art.6 portal (" + exp2.length + " chars)");

  // #3 - RD 1708/2011 art.11 Archivo General funciones
  const exp3 = `**Articulo 11 del RD 1708/2011** (Funciones del Archivo General de la Administracion):

El Archivo General de la Administracion (AGA) es el **archivo intermedio** de la AGE. Entre sus funciones esta "aplicar, en su caso, las resoluciones adoptadas por la **Comision Superior Calificadora de Documentos Administrativos** relativas a la conservacion permanente, y al acceso en su caso, de agrupaciones documentales."

**Por que C es correcta:**
El AGA, como archivo intermedio, ejecuta las decisiones de la Comision Superior Calificadora sobre que documentos conservar permanentemente y cuales pueden eliminarse. Es una funcion propia del archivo intermedio: aplicar los criterios de valoracion documental establecidos por la Comision.

**Por que las demas son incorrectas (son funciones de otros archivos):**

- **A)** "Proporcionar al archivo intermedio las descripciones de las fracciones de serie". Falso: esta es una funcion del **archivo central** (de cada ministerio) cuando transfiere documentos al archivo intermedio. El AGA es el archivo intermedio, no proporciona descripciones a si mismo.

- **B)** "Impulsar programas de difusion y gestion cultural del patrimonio documental custodiado". Falso: esta es una funcion mas propia del **Archivo Historico Nacional** (archivo historico), que custodia documentos de valor permanente y tiene una funcion cultural. El AGA tiene funcion de custodia temporal y valoracion, no tanto de difusion cultural.

- **D)** "Eliminar los documentos de apoyo informativo antes de la transferencia al Archivo central". Falso: la eliminacion de documentos de apoyo informativo es responsabilidad de las **oficinas** (archivos de gestion) antes de enviar la documentacion al archivo central. No es funcion del AGA.

**Fases del ciclo vital del documento:**

| Fase | Archivo | Funcion principal |
|------|---------|------------------|
| Activa | Oficina/Gestion | Uso diario, eliminar apoyo informativo |
| Semiactiva | **Central** (ministerio) | Descripcion, transferir al AGA |
| **Intermedia** | **AGA** | Custodia, aplicar resoluciones de valoracion |
| Historica | Archivo Historico Nacional | Conservacion permanente, difusion |

**Clave:** El AGA aplica las resoluciones de la Comision Calificadora. No confundir con funciones del archivo central (A), historico (B) o de las oficinas (D).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "152ae012-0a21-45ba-9a8a-5eb05697022e");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 1708/2011 Archivo General (" + exp3.length + " chars)");
})();
